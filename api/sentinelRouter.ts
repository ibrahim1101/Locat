import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, desc, lt, sql, isNull } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { integrationTokens, incidents, incidentEvents } from "@db/schema";
import { generateIntegrationToken } from "./sentinel/tokens";
import { SEVERITIES } from "./sentinel/adapters";
import { limit } from "./rateLimit";

const idInput = z.object({ id: z.number().int().positive() });

/** Load an incident the caller owns, or throw NOT_FOUND (prevents cross-account access). */
async function ownedIncident(userId: number, id: number) {
  const [row] = await getDb().select().from(incidents).where(and(eq(incidents.id, id), eq(incidents.userId, userId))).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });
  return row;
}

export const sentinelRouter = createRouter({
  // ── Integration tokens ────────────────────────────────────────────────────
  tokens: createRouter({
    list: authedQuery.query(async ({ ctx }) => {
      const rows = await getDb()
        .select({
          id: integrationTokens.id,
          name: integrationTokens.name,
          source: integrationTokens.source,
          scope: integrationTokens.scope,
          tokenPrefix: integrationTokens.tokenPrefix,
          lastUsedAt: integrationTokens.lastUsedAt,
          createdAt: integrationTokens.createdAt,
          revokedAt: integrationTokens.revokedAt,
        })
        .from(integrationTokens)
        .where(eq(integrationTokens.userId, ctx.user.id))
        .orderBy(desc(integrationTokens.id))
        .limit(100);
      return rows;
    }),
    create: authedQuery
      .input(z.object({ name: z.string().trim().min(1).max(80), source: z.enum(["custom", "nscout", "pipelineguard"]).default("custom") }))
      .mutation(async ({ ctx, input }) => {
        limit(`sentinel-token-create:${ctx.user.id}`, 20, 60 * 60_000);
        const { token, tokenHash, tokenPrefix } = generateIntegrationToken();
        const [created] = await getDb()
          .insert(integrationTokens)
          .values({ userId: ctx.user.id, name: input.name, source: input.source, scope: "incidents:write", tokenHash, tokenPrefix })
          .$returningId();
        // Plaintext token is returned exactly once and never stored or logged.
        return { id: created.id, token, tokenPrefix };
      }),
    revoke: authedQuery.input(idInput).mutation(async ({ ctx, input }) => {
      const res = await getDb()
        .update(integrationTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(integrationTokens.id, input.id), eq(integrationTokens.userId, ctx.user.id), isNull(integrationTokens.revokedAt)));
      return { ok: true, revoked: Number((res as unknown as { rowsAffected?: number }).rowsAffected ?? 0) > 0 };
    }),
  }),

  // ── Incidents ───────────────────────────────────────────────────────────────
  stats: authedQuery.query(async ({ ctx }) => {
    const rows = await getDb()
      .select({ status: incidents.status, severity: incidents.severity, n: sql<number>`COUNT(*)` })
      .from(incidents)
      .where(eq(incidents.userId, ctx.user.id))
      .groupBy(incidents.status, incidents.severity);
    const byStatus = { open: 0, acknowledged: 0, resolved: 0 };
    const bySeverity = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
    let openCritical = 0;
    for (const r of rows) {
      const n = Number(r.n);
      byStatus[r.status] += n;
      bySeverity[r.severity] += n;
      if (r.status !== "resolved" && (r.severity === "critical" || r.severity === "high")) openCritical += n;
    }
    return { byStatus, bySeverity, openCritical, total: byStatus.open + byStatus.acknowledged + byStatus.resolved };
  }),

  incidents: authedQuery
    .input(
      z
        .object({
          status: z.enum(["open", "acknowledged", "resolved"]).optional(),
          severity: z.enum(SEVERITIES).optional(),
          cursor: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(incidents.userId, ctx.user.id)];
      if (input?.status) conditions.push(eq(incidents.status, input.status));
      if (input?.severity) conditions.push(eq(incidents.severity, input.severity));
      if (input?.cursor) conditions.push(lt(incidents.id, input.cursor));
      const rows = await getDb()
        .select()
        .from(incidents)
        .where(and(...conditions))
        .orderBy(desc(incidents.id))
        .limit(51);
      return { items: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null };
    }),

  incident: authedQuery.input(idInput).query(async ({ ctx, input }) => {
    const incident = await ownedIncident(ctx.user.id, input.id);
    const events = await getDb().select().from(incidentEvents).where(eq(incidentEvents.incidentId, incident.id)).orderBy(desc(incidentEvents.id)).limit(200);
    return { incident, events };
  }),

  acknowledge: authedQuery.input(idInput).mutation(async ({ ctx, input }) => {
    const incident = await ownedIncident(ctx.user.id, input.id);
    if (incident.status === "resolved") throw new TRPCError({ code: "BAD_REQUEST", message: "Resolved incidents cannot be acknowledged" });
    const now = new Date();
    await getDb().update(incidents).set({ status: "acknowledged", acknowledgedBy: ctx.user.id, acknowledgedAt: now, updatedAt: now }).where(eq(incidents.id, incident.id));
    await getDb().insert(incidentEvents).values({ incidentId: incident.id, action: "acknowledged", actorId: ctx.user.id });
    return { ok: true };
  }),

  resolve: authedQuery.input(idInput).mutation(async ({ ctx, input }) => {
    const incident = await ownedIncident(ctx.user.id, input.id);
    const now = new Date();
    await getDb().update(incidents).set({ status: "resolved", resolvedAt: now, updatedAt: now }).where(eq(incidents.id, incident.id));
    await getDb().insert(incidentEvents).values({ incidentId: incident.id, action: "resolved", actorId: ctx.user.id });
    return { ok: true };
  }),

  reopen: authedQuery.input(idInput).mutation(async ({ ctx, input }) => {
    const incident = await ownedIncident(ctx.user.id, input.id);
    const now = new Date();
    await getDb().update(incidents).set({ status: "open", resolvedAt: null, acknowledgedAt: null, acknowledgedBy: null, updatedAt: now }).where(eq(incidents.id, incident.id));
    await getDb().insert(incidentEvents).values({ incidentId: incident.id, action: "reopened", actorId: ctx.user.id });
    return { ok: true };
  }),

  note: authedQuery.input(z.object({ id: z.number().int().positive(), text: z.string().trim().min(1).max(500) })).mutation(async ({ ctx, input }) => {
    const incident = await ownedIncident(ctx.user.id, input.id);
    await getDb().insert(incidentEvents).values({ incidentId: incident.id, action: "note", actorId: ctx.user.id, detail: input.text });
    await getDb().update(incidents).set({ updatedAt: new Date() }).where(eq(incidents.id, incident.id));
    return { ok: true };
  }),
});
