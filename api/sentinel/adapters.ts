import { z } from "zod";

export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];
const SEVERITY_RANK: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** Return the higher of two severities. */
export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

export const WEBHOOK_FORMATS = ["generic", "nscout", "pipelineguard"] as const;
export type WebhookFormat = (typeof WEBHOOK_FORMATS)[number];

/** Normalized incident any adapter produces. Opaque to transport. */
export type NormalizedIncident = {
  title: string;
  description?: string;
  severity: Severity;
  source: string;
  fingerprint?: string;
  externalId?: string;
  /** When true the webhook is reporting that a prior incident has cleared. */
  resolve: boolean;
};

const str = (max: number) => z.string().trim().max(max);

// ── Generic payload: Locat's own normalized shape ──────────────────────────
const genericSchema = z.object({
  title: str(200).min(1),
  description: str(5000).optional(),
  severity: z.enum(SEVERITIES).optional(),
  source: str(64).optional(),
  fingerprint: str(128).optional(),
  externalId: str(128).optional(),
  status: z.enum(["open", "resolved", "firing"]).optional(),
});

// ── nScout: host/service monitoring alerts ─────────────────────────────────
// Documented mapping (nScout has no public webhook contract we control, so we
// accept its common alert envelope and normalize defensively).
const nscoutSchema = z.object({
  alert: z
    .object({
      name: str(200).optional(),
      service: str(120).optional(),
      host: str(120).optional(),
      level: z.string().trim().optional(),
      state: z.string().trim().optional(),
      message: str(5000).optional(),
      id: str(128).optional(),
    })
    .optional(),
  name: str(200).optional(),
  level: z.string().trim().optional(),
  message: str(5000).optional(),
  host: str(120).optional(),
});

// ── PipelineGuard: CI/CD pipeline run events ───────────────────────────────
const pipelineguardSchema = z.object({
  pipeline: str(120).optional(),
  stage: str(120).optional(),
  status: z.string().trim().optional(),
  branch: str(120).optional(),
  commit: str(120).optional(),
  message: str(5000).optional(),
  runId: str(128).optional(),
});

function clampSeverity(value: string | undefined, fallback: Severity): Severity {
  const v = (value ?? "").toLowerCase();
  if (v === "critical" || v === "fatal" || v === "crit") return "critical";
  if (v === "high" || v === "error" || v === "failed" || v === "failure") return "high";
  if (v === "medium" || v === "warning" || v === "warn") return "medium";
  if (v === "low" || v === "minor") return "low";
  if (v === "info" || v === "ok" || v === "success" || v === "notice") return "info";
  return fallback;
}

function isResolvedState(value: string | undefined): boolean {
  const v = (value ?? "").toLowerCase();
  return ["resolved", "ok", "recovered", "cleared", "closed", "success", "passed"].includes(v);
}

/** Parse + normalize a raw webhook body for the given format.
 * Throws a ZodError on invalid input. Pure and unit-tested. */
export function normalizeWebhook(format: WebhookFormat, raw: unknown): NormalizedIncident {
  if (format === "nscout") {
    const b = nscoutSchema.parse(raw ?? {});
    const a = b.alert ?? {};
    const title = a.name ?? b.name ?? a.service ?? "nScout alert";
    const host = a.host ?? b.host;
    const level = a.level ?? b.level ?? a.state;
    const descriptionParts = [a.message ?? b.message, host ? `Host: ${host}` : undefined].filter(Boolean);
    return {
      title: title.slice(0, 200),
      description: descriptionParts.join("\n") || undefined,
      severity: clampSeverity(level, "high"),
      source: "nscout",
      fingerprint: a.id ?? (a.service && host ? `nscout:${a.service}:${host}` : undefined),
      externalId: a.id,
      resolve: isResolvedState(a.state) || isResolvedState(level),
    };
  }
  if (format === "pipelineguard") {
    const b = pipelineguardSchema.parse(raw ?? {});
    const pipeline = b.pipeline ?? "pipeline";
    const stage = b.stage ? ` · ${b.stage}` : "";
    const status = (b.status ?? "").toLowerCase();
    const failed = ["failed", "failure", "error", "broken"].includes(status);
    const descriptionParts = [
      b.message,
      b.branch ? `Branch: ${b.branch}` : undefined,
      b.commit ? `Commit: ${b.commit}` : undefined,
    ].filter(Boolean);
    return {
      title: `${failed ? "Pipeline failed" : "Pipeline"}: ${pipeline}${stage}`.slice(0, 200),
      description: descriptionParts.join("\n") || undefined,
      severity: failed ? "high" : clampSeverity(status, "info"),
      source: "pipelineguard",
      fingerprint: `pipelineguard:${pipeline}:${b.stage ?? ""}`,
      externalId: b.runId,
      resolve: isResolvedState(status),
    };
  }
  const b = genericSchema.parse(raw ?? {});
  return {
    title: b.title,
    description: b.description,
    severity: b.severity ?? "medium",
    source: b.source ?? "custom",
    fingerprint: b.fingerprint,
    externalId: b.externalId,
    resolve: b.status === "resolved",
  };
}
