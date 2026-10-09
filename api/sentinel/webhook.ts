import type { Context } from "hono";
import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { integrationTokens, incidents, incidentEvents } from "@db/schema";
import { hashToken, scopeAllows } from "./tokens";
import { normalizeWebhook, maxSeverity, WEBHOOK_FORMATS, type WebhookFormat, type NormalizedIncident } from "./adapters";
import { MAX_WEBHOOK_BODY_BYTES, exceedsByteLimit, parseContentLength } from "./limits";
import { notifyUsers } from "../push";
import { limit } from "../rateLimit";

function bearer(c: Context): string | undefined {
  const auth = c.req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = c.req.header("x-locat-token");
  return header?.trim() || undefined;
}

/**
 * POST /api/sentinel/webhook?format=generic|nscout|pipelineguard
 * Authenticated ONLY by a scoped integration token (never a user session).
 * Creates or updates an incident owned by the token's owner, with a full audit
 * trail in incident_events. Rate limited per token.
 */
export async function handleSentinelWebhook(c: Context): Promise<Response> {
  const token = bearer(c);
  if (!token) return c.json({ error: "Missing integration token" }, 401);

  const db = getDb();
  const [record] = await db
    .select()
    .from(integrationTokens)
    .where(and(eq(integrationTokens.tokenHash, hashToken(token)), isNull(integrationTokens.revokedAt)))
    .limit(1);
  if (!record) return c.json({ error: "Invalid or revoked integration token" }, 401);
  if (!scopeAllows(record.scope, "incidents:write")) return c.json({ error: "Token missing incidents:write scope" }, 403);

  try {
    limit(`sentinel-webhook:${record.id}`, 120, 60_000);
  } catch {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  // Reject oversized bodies before buffering when the client declares a length,
  // then enforce the real UTF-8 byte size (string .length would undercount
  // multibyte payloads and let them slip past the limit).
  const declared = parseContentLength(c.req.header("content-length"));
  if (declared !== null && declared > MAX_WEBHOOK_BODY_BYTES) return c.json({ error: "Payload too large" }, 413);
  const raw = await c.req.text();
  if (exceedsByteLimit(raw, MAX_WEBHOOK_BODY_BYTES)) return c.json({ error: "Payload too large" }, 413);
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const formatParam = (c.req.query("format") ?? "generic").toLowerCase();
  const format: WebhookFormat = (WEBHOOK_FORMATS as readonly string[]).includes(formatParam)
    ? (formatParam as WebhookFormat)
    : "generic";

  let incident: NormalizedIncident;
  try {
    incident = normalizeWebhook(format, body);
  } catch {
    return c.json({ error: "Payload did not match the selected format" }, 400);
  }

  await db.update(integrationTokens).set({ lastUsedAt: new Date() }).where(eq(integrationTokens.id, record.id));

  const result = await db.transaction(async (tx) => {
    const existing = incident.fingerprint
      ? (
          await tx
            .select()
            .from(incidents)
            .where(
              and(
                eq(incidents.userId, record.userId),
                eq(incidents.fingerprint, incident.fingerprint),
                inArray(incidents.status, ["open", "acknowledged"]),
              ),
            )
            .orderBy(desc(incidents.id))
            .limit(1)
        )[0]
      : undefined;

    // Resolve signal clears a matching open incident.
    if (incident.resolve) {
      if (!existing) return { action: "noop" as const, incidentId: null, status: "resolved" };
      const now = new Date();
      await tx.update(incidents).set({ status: "resolved", resolvedAt: now, updatedAt: now }).where(eq(incidents.id, existing.id));
      await tx.insert(incidentEvents).values({ incidentId: existing.id, action: "resolved", detail: "Resolved by integration" });
      return { action: "resolved" as const, incidentId: existing.id, status: "resolved" };
    }

    if (existing) {
      const now = new Date();
      const severity = maxSeverity(existing.severity, incident.severity);
      await tx
        .update(incidents)
        .set({ severity, description: incident.description ?? existing.description, updatedAt: now })
        .where(eq(incidents.id, existing.id));
      await tx.insert(incidentEvents).values({
        incidentId: existing.id,
        action: "updated",
        detail: `Re-triggered via ${incident.source} (severity ${severity})`,
      });
      return { action: "updated" as const, incidentId: existing.id, status: existing.status };
    }

    const [created] = await tx
      .insert(incidents)
      .values({
        userId: record.userId,
        tokenId: record.id,
        source: incident.source,
        severity: incident.severity,
        status: "open",
        title: incident.title,
        description: incident.description ?? null,
        fingerprint: incident.fingerprint ?? null,
        externalId: incident.externalId ?? null,
      })
      .$returningId();
    await tx.insert(incidentEvents).values({
      incidentId: created.id,
      action: "created",
      detail: `Created via ${incident.source} webhook (${format})`,
    });
    return { action: "created" as const, incidentId: created.id, status: "open" };
  });

  // Critical/high NEW incidents trigger a notification via the existing Web Push
  // channel (no-op when push is unconfigured). Fire-and-forget; never blocks the
  // webhook response or leaks token/body details.
  if (result.action === "created" && (incident.severity === "critical" || incident.severity === "high")) {
    void notifyUsers([record.userId]).catch(() => {});
  }

  return c.json({ ok: true, ...result }, result.action === "created" ? 201 : 200);
}
