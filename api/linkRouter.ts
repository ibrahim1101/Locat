import { issueLinkChallenge, answerLinkChallenge, verifyLinkProof, validateLinkPublicKey, canonicalLinkPublicKey, revokeLinkProofs } from "./linkProof";
import { z } from "zod";
import { createMediaAccessRequest, listMediaAccessRequests, getMediaAccessRequest, decideMediaAccessRequest, revokeMediaAccessRequests } from "./deviceMediaAccess";
import { publishDeviceLibraries, discoverDeviceLibraries, unpublishDeviceLibraries, hasPublishedLibrary } from "./deviceMediaDiscovery";
import { TRPCError } from "@trpc/server";
import { getTableColumns, and, eq, desc, inArray, isNull, ne, lt, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { linkDevices, linkPairings, linkTransfers, linkTransferChunks, linkMessages, users } from "@db/schema";
import { limit } from "./rateLimit";

const b64 = z.string().min(1).max(20000);
const ivSchema = z.string().min(8).max(32);
const MAX_CHUNK_B64 = 1_400_000; // ~1 MB plaintext per chunk after base64
const MAX_CHUNKS = 20000;
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB transfer ceiling

/** Load a device the caller owns (and that is not revoked), or throw. */
async function ownedDevice(userId: number, id: number) {
  const [row] = await getDb().select().from(linkDevices).where(and(eq(linkDevices.id, id), eq(linkDevices.userId, userId))).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Device not found" });
  if (row.revokedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Device was revoked; register a new device key" });
  return row;
}

/** A pairing between two owned devices must exist and be verified. Order-agnostic. */
async function requireVerifiedPair(userId: number, d1: number, d2: number) {
  const [lo, hi] = d1 < d2 ? [d1, d2] : [d2, d1];
  const [pair] = await getDb().select().from(linkPairings)
    .where(and(eq(linkPairings.userId, userId), eq(linkPairings.deviceA, lo), eq(linkPairings.deviceB, hi)))
    .limit(1);
  if (!pair || pair.status !== "verified" || pair.proofVersion !== 1) throw new TRPCError({ code: "FORBIDDEN", message: "Devices are not paired and verified" });
  return pair;
}

const deviceQuery = authedQuery.input(z.object({ proof: z.string().max(100).optional() })).use(async ({ ctx, input, next }) => {
  const linkDeviceId = verifyLinkProof(ctx.user.id, ctx.sessionToken ?? "", input.proof);
  await ownedDevice(ctx.user.id, linkDeviceId);
  return next({ ctx: { ...ctx, linkDeviceId } });
});
function requireActor(actual: number, expected: number) {
  if (actual !== expected) throw new TRPCError({ code: "FORBIDDEN", message: "Command belongs to another device" });
}
/** Serialize upload/purge/revocation so terminal transfers cannot regain ciphertext. */
async function finishTransfer(userId: number, actor: number, id: number, status: "complete" | "cancelled") {
  return getDb().transaction(async tx => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const [t] = await tx.select().from(linkTransfers).where(and(eq(linkTransfers.id, id), eq(linkTransfers.userId, userId))).for("update");
    if (!t) throw new TRPCError({ code: "NOT_FOUND" });
    if (![t.fromDevice, t.toDevice].includes(actor)) throw new TRPCError({ code: "FORBIDDEN" });
    if (status === "complete") requireActor(actor, t.toDevice);
    await ownedDevice(userId, t.fromDevice);
    await ownedDevice(userId, t.toDevice);
    await requireVerifiedPair(userId, t.fromDevice, t.toDevice);
    if ((t.status === "complete" || t.status === "cancelled") && t.status !== status) throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer is closed" });
    await tx.update(linkTransfers).set({ status, updatedAt: new Date() }).where(eq(linkTransfers.id, t.id));
    await tx.delete(linkTransferChunks).where(eq(linkTransferChunks.transferId, t.id));
    return { ok: true };
  });
}

export const linkRouter = createRouter({
  devices: createRouter({
    challenge: authedQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      limit(`link-proof:${ctx.user.id}`, 30, 60_000);
      const device = await ownedDevice(ctx.user.id, input.id);
      return issueLinkChallenge(ctx.user.id, device.id, ctx.sessionToken ?? "", device.publicKey);
    }),
    prove: authedQuery.input(z.object({ id: z.string().min(20).max(100), answer: z.string().max(100) })).mutation(async ({ ctx, input }) => {
      limit(`link-proof-answer:${ctx.user.id}`, 30, 60_000);
      const proof = answerLinkChallenge(ctx.user.id, ctx.sessionToken ?? "", input.id, input.answer);
      await ownedDevice(ctx.user.id, proof.deviceId);
      return proof;
    }),
    // Register (or re-register) this device by its ECDH public key.
    register: authedQuery
      .input(z.object({ name: z.string().trim().min(1).max(80), platform: z.string().trim().max(32).default("web"), publicKey: b64 }))
      .mutation(async ({ ctx, input }) => {
        limit(`link-register:${ctx.user.id}`, 60, 60_000);
        await validateLinkPublicKey(input.publicKey);
        return getDb().transaction(async db => {
          await db.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id)).for("update");
        const historical = await db.select().from(linkDevices).where(eq(linkDevices.userId, ctx.user.id));
        const equivalent = [];
        for (const device of historical) {
          try { if ((await canonicalLinkPublicKey(device.publicKey)).publicKey === input.publicKey) equivalent.push(device); }
          catch (error) { if (!(error instanceof TRPCError)) throw error; }
        }
        // A historical base64 alias must not bypass revocation of the same key.
        if (equivalent.some(device => device.revokedAt)) throw new TRPCError({ code: "FORBIDDEN", message: "Device key revoked. Reset this device identity to register again." });
        if (equivalent[0]) {
          if (equivalent[0].publicKey !== input.publicKey) await db.update(linkDevices).set({ publicKey: input.publicKey }).where(eq(linkDevices.id, equivalent[0].id));
          return { id: equivalent[0].id };
        }
        const count = await db.select({ n: sql<number>`COUNT(*)` }).from(linkDevices).where(eq(linkDevices.userId, ctx.user.id));
        if (Number(count[0].n) >= 50) throw new TRPCError({ code: "BAD_REQUEST", message: "Device limit reached" });
        const [created] = await db.insert(linkDevices).values({ userId: ctx.user.id, name: input.name, platform: input.platform, publicKey: input.publicKey }).$returningId();
        return { id: created.id };
        });
      }),
    list: deviceQuery.query(async ({ ctx }) => {
      return getDb().select({ id: linkDevices.id, name: linkDevices.name, platform: linkDevices.platform, publicKey: linkDevices.publicKey, createdAt: linkDevices.createdAt, lastSeenAt: linkDevices.lastSeenAt, revokedAt: linkDevices.revokedAt })
        .from(linkDevices).where(eq(linkDevices.userId, ctx.user.id)).orderBy(desc(linkDevices.lastSeenAt)).limit(100);
    }),
    rename: deviceQuery.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(80) })).mutation(async ({ ctx, input }) => {
      requireActor(ctx.linkDeviceId, input.id);
      await ownedDevice(ctx.user.id, input.id);
      await getDb().update(linkDevices).set({ name: input.name }).where(eq(linkDevices.id, input.id));
      return { ok: true };
    }),
    heartbeat: deviceQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireActor(ctx.linkDeviceId, input.id);
      await ownedDevice(ctx.user.id, input.id);
      await getDb().update(linkDevices).set({ lastSeenAt: new Date() }).where(eq(linkDevices.id, input.id));
      return { ok: true };
    }),
    revoke: deviceQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await getDb().transaction(async tx => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id)).for("update");
        const devs = await tx.select().from(linkDevices).where(and(eq(linkDevices.userId, ctx.user.id), inArray(linkDevices.id, [input.id, ctx.linkDeviceId]))).for("update");
        if (!devs.find(d => d.id === input.id) || !devs.find(d => d.id === ctx.linkDeviceId && !d.revokedAt)) throw new TRPCError({ code: "FORBIDDEN" });
      await tx.update(linkDevices).set({ revokedAt: new Date() }).where(eq(linkDevices.id, input.id));
      revokeLinkProofs(ctx.user.id, input.id);
      unpublishDeviceLibraries(ctx.user.id, input.id);
      revokeMediaAccessRequests(ctx.user.id, input.id);
      await tx.update(linkPairings).set({ status: "rejected", confirmedA: false, confirmedB: false, updatedAt: new Date() })
        .where(and(eq(linkPairings.userId, ctx.user.id), sql`(${linkPairings.deviceA} = ${input.id} OR ${linkPairings.deviceB} = ${input.id})`));
      const affected = await tx.select({ id: linkTransfers.id }).from(linkTransfers).where(and(eq(linkTransfers.userId, ctx.user.id), sql`(${linkTransfers.fromDevice} = ${input.id} OR ${linkTransfers.toDevice} = ${input.id})`));
      if (affected.length) await tx.delete(linkTransferChunks).where(inArray(linkTransferChunks.transferId, affected.map(t => t.id)));
      await tx.delete(linkMessages).where(and(eq(linkMessages.userId, ctx.user.id), sql`(${linkMessages.fromDevice} = ${input.id} OR ${linkMessages.toDevice} = ${input.id})`));
      await tx.update(linkTransfers).set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(linkTransfers.userId, ctx.user.id), sql`(${linkTransfers.fromDevice} = ${input.id} OR ${linkTransfers.toDevice} = ${input.id})`));
      });
      return { ok: true };
    }),
  }),

  mediaDiscovery: createRouter({
    publish: deviceQuery.input(z.object({
      libraries: z.array(z.object({
        id: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(120),
        kind: z.enum(["cinema", "music", "photos"]),
        count: z.number().int().min(0).max(1_000_000),
      })).max(30),
    })).mutation(({ ctx, input }) => {
      limit(`media-publish:${ctx.user.id}:${ctx.linkDeviceId}`, 60, 60_000);
      publishDeviceLibraries(ctx.user.id, ctx.linkDeviceId, input.libraries);
      return { ok: true };
    }),
    unpublish: deviceQuery.mutation(({ ctx }) => {
      unpublishDeviceLibraries(ctx.user.id, ctx.linkDeviceId);
      return { ok: true };
    }),
    requestAccess: deviceQuery.input(z.object({
      deviceId: z.number().int().positive(),
      libraryId: z.string().trim().min(1).max(80),
    })).mutation(async ({ ctx, input }) => {
      limit(`media-access-request:${ctx.user.id}:${ctx.linkDeviceId}`, 30, 60_000);
      if (ctx.linkDeviceId === input.deviceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose another device" });
      await ownedDevice(ctx.user.id, input.deviceId);
      await requireVerifiedPair(ctx.user.id, ctx.linkDeviceId, input.deviceId);
      if (!hasPublishedLibrary(ctx.user.id, input.deviceId, input.libraryId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Library is no longer published" });
      }
      const request = createMediaAccessRequest({
        userId: ctx.user.id, sourceDeviceId: input.deviceId,
        requesterDeviceId: ctx.linkDeviceId, libraryId: input.libraryId,
      });
      return { requestId: request.id, status: request.status, requiresSourceApproval: true };
    }),
    pendingRequests: deviceQuery.query(({ ctx }) => {
      return listMediaAccessRequests(ctx.user.id, ctx.linkDeviceId);
    }),
    requestStatus: deviceQuery.input(z.object({ requestId: z.string().uuid() })).query(({ ctx, input }) => {
      const request = getMediaAccessRequest(ctx.user.id, ctx.linkDeviceId, input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Request expired or unavailable" });
      return { status: request.status, libraryId: request.libraryId, sourceDeviceId: request.sourceDeviceId };
    }),
    decideRequest: deviceQuery.input(z.object({ requestId: z.string().uuid(), approve: z.boolean() })).mutation(async ({ ctx, input }) => {
      limit(`media-access-decision:${ctx.user.id}:${ctx.linkDeviceId}`, 60, 60_000);
      const pending = listMediaAccessRequests(ctx.user.id, ctx.linkDeviceId).find(item => item.id === input.requestId && item.status === "pending");
      if (!pending) throw new TRPCError({ code: "NOT_FOUND", message: "Request expired, unavailable, or already decided" });
      if (input.approve) {
        await ownedDevice(ctx.user.id, pending.requesterDeviceId);
        await requireVerifiedPair(ctx.user.id, ctx.linkDeviceId, pending.requesterDeviceId);
        if (!hasPublishedLibrary(ctx.user.id, ctx.linkDeviceId, pending.libraryId)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Library is no longer published" });
        }
      }
      const request = decideMediaAccessRequest(ctx.user.id, ctx.linkDeviceId, input.requestId, input.approve);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Request already decided" });
      return { requestId: request.id, status: request.status };
    }),
    discover: deviceQuery.input(z.object({ deviceId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await ownedDevice(ctx.user.id, input.deviceId);
      if (ctx.linkDeviceId !== input.deviceId) {
        await requireVerifiedPair(ctx.user.id, ctx.linkDeviceId, input.deviceId);
      }
      return { deviceId: input.deviceId, libraries: discoverDeviceLibraries(ctx.user.id, input.deviceId) };
    }),
  }),

  pair: createRouter({
    start: deviceQuery.input(z.object({ deviceA: z.number().int().positive(), deviceB: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireActor(ctx.linkDeviceId, input.deviceA);
      if (input.deviceA === input.deviceB) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick two different devices" });
      await ownedDevice(ctx.user.id, input.deviceA);
      await ownedDevice(ctx.user.id, input.deviceB);
      const [lo, hi] = input.deviceA < input.deviceB ? [input.deviceA, input.deviceB] : [input.deviceB, input.deviceA];
      const db = getDb();
      const [existing] = await db.select().from(linkPairings).where(and(eq(linkPairings.deviceA, lo), eq(linkPairings.deviceB, hi))).limit(1);
      if (existing) {
        if (existing.status === "rejected") await db.update(linkPairings).set({ status: "pending", confirmedA: false, confirmedB: false, proofVersion: 1, updatedAt: new Date() }).where(eq(linkPairings.id, existing.id));
        return { id: existing.id };
      }
      const [created] = await db.insert(linkPairings).values({ userId: ctx.user.id, deviceA: lo, deviceB: hi, proofVersion: 1 }).$returningId();
      return { id: created.id };
    }),
    list: deviceQuery.query(async ({ ctx }) => {
      const rows = await getDb().select().from(linkPairings).where(eq(linkPairings.userId, ctx.user.id)).orderBy(desc(linkPairings.id)).limit(200);
      return rows.map(row => row.status === "verified" && row.proofVersion !== 1 ? { ...row, status: "pending" as const, confirmedA: false, confirmedB: false } : row);
    }),
    // Returns both device public keys so the client can derive the SAS locally.
    get: deviceQuery.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const [pair] = await getDb().select().from(linkPairings).where(and(eq(linkPairings.id, input.id), eq(linkPairings.userId, ctx.user.id))).limit(1);
      if (!pair) throw new TRPCError({ code: "NOT_FOUND" });
      const devs = await getDb().select({ id: linkDevices.id, name: linkDevices.name, publicKey: linkDevices.publicKey }).from(linkDevices).where(inArray(linkDevices.id, [pair.deviceA, pair.deviceB]));
      if (![pair.deviceA, pair.deviceB].includes(ctx.linkDeviceId)) throw new TRPCError({ code: "FORBIDDEN" });
      return { pairing: pair.proofVersion !== 1 && pair.status === "verified" ? { ...pair, status: "pending" as const, confirmedA: false, confirmedB: false } : pair, devices: devs };
    }),
    // The caller confirms the SAS from the perspective of `myDevice`.
    confirm: deviceQuery.input(z.object({ id: z.number().int().positive(), myDevice: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireActor(ctx.linkDeviceId, input.myDevice);
      await ownedDevice(ctx.user.id, input.myDevice);
      const db = getDb();
      return db.transaction(async (tx) => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id)).for("update");
        const [pair] = await tx.select().from(linkPairings).where(and(eq(linkPairings.id, input.id), eq(linkPairings.userId, ctx.user.id))).for("update");
        if (!pair) throw new TRPCError({ code: "NOT_FOUND" });
        const devices = await tx.select().from(linkDevices).where(and(eq(linkDevices.userId, ctx.user.id), inArray(linkDevices.id, [pair.deviceA, pair.deviceB]))).for("update");
        if (devices.length !== 2 || devices.some(device => device.revokedAt)) throw new TRPCError({ code: "FORBIDDEN", message: "A paired device was revoked" });
        if (pair.status === "rejected") throw new TRPCError({ code: "BAD_REQUEST", message: "Pairing was rejected; start a new one" });
        const set: Record<string, unknown> = { updatedAt: new Date(), proofVersion: 1, status: "pending", confirmedA: pair.proofVersion === 1 && pair.confirmedA, confirmedB: pair.proofVersion === 1 && pair.confirmedB };
        if (input.myDevice === pair.deviceA) set.confirmedA = true;
        else if (input.myDevice === pair.deviceB) set.confirmedB = true;
        else throw new TRPCError({ code: "BAD_REQUEST", message: "Device is not part of this pairing" });
        const confirmedA = (pair.proofVersion === 1 && pair.confirmedA) || input.myDevice === pair.deviceA;
        const confirmedB = (pair.proofVersion === 1 && pair.confirmedB) || input.myDevice === pair.deviceB;
        if (confirmedA && confirmedB) set.status = "verified";
        await tx.update(linkPairings).set(set).where(eq(linkPairings.id, pair.id));
        return { ok: true, verified: Boolean(confirmedA && confirmedB) };
      });
    }),
    reject: deviceQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const [pair] = await getDb().select().from(linkPairings).where(and(eq(linkPairings.id, input.id), eq(linkPairings.userId, ctx.user.id))).limit(1);
      if (!pair || ![pair.deviceA, pair.deviceB].includes(ctx.linkDeviceId)) throw new TRPCError({ code: "FORBIDDEN" });
      await getDb().update(linkPairings).set({ status: "rejected", updatedAt: new Date() }).where(and(eq(linkPairings.id, input.id), eq(linkPairings.userId, ctx.user.id)));
      return { ok: true };
    }),
  }),

  transfers: createRouter({
    create: deviceQuery
      .input(z.object({ fromDevice: z.number().int().positive(), toDevice: z.number().int().positive(), filename: z.string().trim().min(1).max(255), mime: z.string().trim().max(128).default("application/octet-stream"), size: z.number().int().nonnegative().max(MAX_SIZE), chunkCount: z.number().int().min(1).max(MAX_CHUNKS) }))
      .mutation(async ({ ctx, input }) => {
        requireActor(ctx.linkDeviceId, input.fromDevice);
        await ownedDevice(ctx.user.id, input.fromDevice);
        await ownedDevice(ctx.user.id, input.toDevice);
        await requireVerifiedPair(ctx.user.id, input.fromDevice, input.toDevice);
        limit(`link-transfer:${ctx.user.id}`, 120, 60_000);
        const [created] = await getDb().insert(linkTransfers).values({ userId: ctx.user.id, fromDevice: input.fromDevice, toDevice: input.toDevice, filename: input.filename, mime: input.mime, size: input.size, chunkCount: input.chunkCount, status: "pending" }).$returningId();
        return { id: created.id };
      }),
    uploadChunk: deviceQuery
      .input(z.object({ transferId: z.number().int().positive(), seq: z.number().int().nonnegative(), iv: ivSchema, data: z.string().min(1).max(MAX_CHUNK_B64) }))
      .mutation(async ({ ctx, input }) => {
        limit(`link-chunk:${ctx.user.id}`, 6000, 60_000);
        return getDb().transaction(async tx => {
          await tx.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id)).for("update");
          const [t] = await tx.select().from(linkTransfers).where(and(eq(linkTransfers.id, input.transferId), eq(linkTransfers.userId, ctx.user.id))).for("update");
          if (!t) throw new TRPCError({ code: "NOT_FOUND" });
          requireActor(ctx.linkDeviceId, t.fromDevice);
          await ownedDevice(ctx.user.id, t.fromDevice);
          await ownedDevice(ctx.user.id, t.toDevice);
          await requireVerifiedPair(ctx.user.id, t.fromDevice, t.toDevice);
          if (t.status === "cancelled" || t.status === "complete") throw new TRPCError({ code: "BAD_REQUEST", message: "Transfer is closed" });
          if (input.seq >= t.chunkCount) throw new TRPCError({ code: "BAD_REQUEST", message: "Chunk out of range" });
          const [existing] = await tx.select().from(linkTransferChunks).where(and(eq(linkTransferChunks.transferId, t.id), eq(linkTransferChunks.seq, input.seq)));
          if (existing) {
            if (existing.iv !== input.iv || existing.data !== input.data) throw new TRPCError({ code: "CONFLICT", message: "Chunk was already published" });
            return { ok: true };
          }
          await tx.insert(linkTransferChunks).values({ transferId: t.id, seq: input.seq, iv: input.iv, data: input.data });
          if (t.status === "pending") await tx.update(linkTransfers).set({ status: "active", updatedAt: new Date() }).where(eq(linkTransfers.id, t.id));
          return { ok: true };
        });
      }),
    list: deviceQuery.query(async ({ ctx }) => {
      const rows = await getDb().select().from(linkTransfers).where(and(eq(linkTransfers.userId, ctx.user.id), sql`(${linkTransfers.fromDevice} = ${ctx.linkDeviceId} OR ${linkTransfers.toDevice} = ${ctx.linkDeviceId})`)).orderBy(desc(linkTransfers.id)).limit(100);
      const counts = rows.length ? await getDb().select({ transferId: linkTransferChunks.transferId, n: sql<number>`COUNT(*)` }).from(linkTransferChunks).where(inArray(linkTransferChunks.transferId, rows.map((r) => r.id))).groupBy(linkTransferChunks.transferId) : [];
      const map = new Map(counts.map((c) => [c.transferId, Number(c.n)]));
      return rows.map((r) => ({ ...r, receivedChunks: map.get(r.id) ?? 0 }));
    }),
    get: deviceQuery.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const [t] = await getDb().select().from(linkTransfers).where(and(eq(linkTransfers.id, input.id), eq(linkTransfers.userId, ctx.user.id))).limit(1);
      if (!t) throw new TRPCError({ code: "NOT_FOUND" });
      await ownedDevice(ctx.user.id, t.fromDevice);
      await ownedDevice(ctx.user.id, t.toDevice);
      await requireVerifiedPair(ctx.user.id, t.fromDevice, t.toDevice);
      if (![t.fromDevice, t.toDevice].includes(ctx.linkDeviceId)) throw new TRPCError({ code: "FORBIDDEN" });
      const present = await getDb().select({ seq: linkTransferChunks.seq }).from(linkTransferChunks).where(eq(linkTransferChunks.transferId, t.id)).orderBy(linkTransferChunks.seq);
      return { transfer: t, seqs: present.map((p) => p.seq) };
    }),
    chunk: deviceQuery.input(z.object({ id: z.number().int().positive(), seq: z.number().int().nonnegative() })).query(async ({ ctx, input }) => {
      const [t] = await getDb().select().from(linkTransfers).where(and(eq(linkTransfers.id, input.id), eq(linkTransfers.userId, ctx.user.id))).limit(1);
      if (!t) throw new TRPCError({ code: "NOT_FOUND" });
      await ownedDevice(ctx.user.id, t.fromDevice);
      await ownedDevice(ctx.user.id, t.toDevice);
      await requireVerifiedPair(ctx.user.id, t.fromDevice, t.toDevice);
      if (![t.fromDevice, t.toDevice].includes(ctx.linkDeviceId)) throw new TRPCError({ code: "FORBIDDEN" });
      requireActor(ctx.linkDeviceId, t.toDevice);
      const [c] = await getDb().select({ iv: linkTransferChunks.iv, data: linkTransferChunks.data }).from(linkTransferChunks).where(and(eq(linkTransferChunks.transferId, t.id), eq(linkTransferChunks.seq, input.seq))).limit(1);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Chunk not available" });
      return c;
    }),
    complete: deviceQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      return finishTransfer(ctx.user.id, ctx.linkDeviceId, input.id, "complete");
    }),
    cancel: deviceQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      return finishTransfer(ctx.user.id, ctx.linkDeviceId, input.id, "cancelled");
    }),
  }),

  messages: createRouter({
    // Reserve the durable row ID before encrypting so ciphertext can bind to it.
    prepare: deviceQuery
      .input(z.object({ fromDevice: z.number().int().positive(), toDevice: z.number().int().positive(), kind: z.enum(["clipboard", "text", "url"]) }))
      .mutation(async ({ ctx, input }) => {
        requireActor(ctx.linkDeviceId, input.fromDevice);
        limit(`link-msg:${ctx.user.id}`, 240, 60_000);
        return getDb().transaction(async tx => {
          await tx.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id)).for("update");
          await ownedDevice(ctx.user.id, input.fromDevice);
          await ownedDevice(ctx.user.id, input.toDevice);
          await requireVerifiedPair(ctx.user.id, input.fromDevice, input.toDevice);
          await tx.delete(linkMessages).where(and(eq(linkMessages.userId, ctx.user.id), eq(linkMessages.data, ""), lt(linkMessages.createdAt, sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)`)));
          const [pending] = await tx.select({ n: sql<number>`COUNT(*)` }).from(linkMessages).where(and(eq(linkMessages.userId, ctx.user.id), eq(linkMessages.data, "")));
          if (Number(pending.n) >= 100) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many pending messages; retry after reservations expire" });
          const [created] = await tx.insert(linkMessages).values({ userId: ctx.user.id,
            ...input, iv: "", data: "" }).$returningId();
          return { id: created.id };
        });
      }),
    push: deviceQuery
      .input(z.object({ id: z.number().int().positive(), iv: ivSchema, data: b64 }))
      .mutation(async ({ ctx, input }) => {
        limit(`link-msg-publish:${ctx.user.id}`, 240, 60_000);
        return getDb().transaction(async tx => {
          // Same account lock order as revocation; recheck devices after acquiring it.
          await tx.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id)).for("update");
          const [row] = await tx.select({ ...getTableColumns(linkMessages), expired: sql<number>`${linkMessages.createdAt} < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)` }).from(linkMessages).where(and(eq(linkMessages.id, input.id), eq(linkMessages.userId, ctx.user.id))).for("update");
          if (!row) throw new TRPCError({ code: "NOT_FOUND" });
          requireActor(ctx.linkDeviceId, row.fromDevice);
          await ownedDevice(ctx.user.id, row.fromDevice);
          await ownedDevice(ctx.user.id, row.toDevice);
          await requireVerifiedPair(ctx.user.id, row.fromDevice, row.toDevice);
          // Exact retries never reset delivery or replace already published ciphertext.
          if (row.data) {
            if (row.iv !== input.iv || row.data !== input.data) throw new TRPCError({ code: "CONFLICT", message: "Message was already published" });
            return { id: row.id };
          }
          if (row.deliveredAt || Boolean(row.expired)) throw new TRPCError({ code: "BAD_REQUEST", message: "Message reservation expired" });
          await tx.update(linkMessages).set({ iv: input.iv, data: input.data }).where(eq(linkMessages.id, row.id));
          return { id: row.id };
        });
      }),
    inbox: deviceQuery.input(z.object({ deviceId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireActor(ctx.linkDeviceId, input.deviceId);
      await ownedDevice(ctx.user.id, input.deviceId);
      const rows = await getDb().select().from(linkMessages).where(and(eq(linkMessages.userId, ctx.user.id), eq(linkMessages.toDevice, input.deviceId), ne(linkMessages.data, ""), isNull(linkMessages.deliveredAt))).orderBy(desc(linkMessages.id)).limit(50);
      const visible = [];
      for (const row of rows) {
        try { await ownedDevice(ctx.user.id, row.fromDevice); await requireVerifiedPair(ctx.user.id, row.fromDevice, row.toDevice); visible.push(row); }
        catch (error) { if (!(error instanceof TRPCError)) throw error; }
      }
      return visible;
    }),
    ack: deviceQuery.input(z.object({ ids: z.array(z.number().int().positive()).max(100) })).mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { ok: true };
      await getDb().update(linkMessages).set({ deliveredAt: new Date() }).where(and(eq(linkMessages.userId, ctx.user.id), eq(linkMessages.toDevice, ctx.linkDeviceId), ne(linkMessages.data, ""), inArray(linkMessages.id, input.ids)));
      return { ok: true };
    }),
  }),
});
