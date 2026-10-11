import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { privateConfigSchema, privateEnvelopeSchema, privateModuleSchema,
  PRIVATE_STORE_MAX_OBJECTS, PRIVATE_STORE_QUOTA } from "../contracts/privateStore";
import { privateStores, privateObjects, users, adminAudit } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";

const moduleInput = z.object({ module: privateModuleSchema }).strict();
const objectInput = moduleInput.extend({ id: z.uuid() });
const scope = (userId: number, module: "vault" | "secrets") =>
  and(eq(privateObjects.userId, userId), eq(privateObjects.module, module));

export const privateStoreRouter = createRouter({
  status: authedQuery.input(moduleInput).query(async ({ ctx, input }) => {
    const db = getDb();
    const [store] = await db.select().from(privateStores).where(and(eq(privateStores.userId, ctx.user.id), eq(privateStores.module, input.module)));
    const objects = await db.select({ id: privateObjects.id, revision: privateObjects.revision,
      bytes: privateObjects.bytes, updatedAt: privateObjects.updatedAt }).from(privateObjects).where(scope(ctx.user.id, input.module));
    return { config: store ? privateConfigSchema.parse(JSON.parse(store.config)) : null, objects,
      bytes: objects.reduce((n, row) => n + row.bytes, 0), quota: PRIVATE_STORE_QUOTA, maxObjects: PRIVATE_STORE_MAX_OBJECTS };
  }),
  initialize: authedQuery.input(moduleInput.extend({ config: privateConfigSchema })).mutation(async ({ ctx, input }) => {
    return getDb().transaction(async tx => {
      // Same ownership lock serializes initialization, quota changes and writes,
      // including the first insert where an object row does not exist yet.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id)).for("update");
      const [existing] = await tx.select().from(privateStores).where(and(eq(privateStores.userId, ctx.user.id), eq(privateStores.module, input.module)));
      if (existing) {
        if (existing.config !== JSON.stringify(input.config)) throw new TRPCError({ code: "CONFLICT", message: "This store already exists. Unlock it instead." });
        return { initialized: true };
      }
      await tx.insert(privateStores).values({ userId: ctx.user.id, module: input.module, config: JSON.stringify(input.config) });
      await tx.insert(adminAudit).values({ actorId: ctx.user.id, action: `private.${input.module}.initialize` });
      return { initialized: true };
    });
  }),
  get: authedQuery.input(objectInput).query(async ({ ctx, input }) => {
    const [row] = await getDb().select().from(privateObjects).where(and(scope(ctx.user.id, input.module), eq(privateObjects.id, input.id)));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
    return { id: row.id, revision: row.revision, envelope: privateEnvelopeSchema.parse(JSON.parse(row.envelope)) };
  }),
  put: authedQuery.input(objectInput.extend({ expectedRevision: z.number().int().min(0).max(1_000_000_000),
    envelope: privateEnvelopeSchema })).mutation(async ({ ctx, input }) => {
    const encoded = JSON.stringify(input.envelope);
    return getDb().transaction(async tx => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id)).for("update");
      const [store] = await tx.select().from(privateStores).where(and(eq(privateStores.userId, ctx.user.id), eq(privateStores.module, input.module)));
      if (!store) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Initialize this encrypted store first." });
      const rows = await tx.select({ id: privateObjects.id, bytes: privateObjects.bytes, revision: privateObjects.revision })
        .from(privateObjects).where(scope(ctx.user.id, input.module));
      const current = rows.find(row => row.id === input.id);
      if ((current?.revision ?? 0) !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "Entry changed on another device. Refresh before saving." });
      const used = rows.reduce((n, row) => n + row.bytes, 0) - (current?.bytes ?? 0) + encoded.length;
      if (used > PRIVATE_STORE_QUOTA || (!current && rows.length >= PRIVATE_STORE_MAX_OBJECTS))
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Encrypted store quota exceeded." });
      const revision = input.expectedRevision + 1;
      if (current) await tx.update(privateObjects).set({ envelope: encoded, bytes: encoded.length, revision, updatedAt: new Date() })
        .where(and(scope(ctx.user.id, input.module), eq(privateObjects.id, input.id)));
      else await tx.insert(privateObjects).values({ id: input.id, userId: ctx.user.id, module: input.module, envelope: encoded, bytes: encoded.length, revision });
      await tx.insert(adminAudit).values({ actorId: ctx.user.id, action: `private.${input.module}.write` });
      return { revision };
    });
  }),
  remove: authedQuery.input(objectInput.extend({ expectedRevision: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    return getDb().transaction(async tx => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id)).for("update");
      const [row] = await tx.select().from(privateObjects).where(and(scope(ctx.user.id, input.module), eq(privateObjects.id, input.id)));
      if (!row) return { removed: false };
      if (row.revision !== input.expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "Entry changed. Refresh before deleting." });
      await tx.delete(privateObjects).where(and(scope(ctx.user.id, input.module), eq(privateObjects.id, input.id)));
      await tx.insert(adminAudit).values({ actorId: ctx.user.id, action: `private.${input.module}.delete` });
      return { removed: true };
    });
  }),
});
