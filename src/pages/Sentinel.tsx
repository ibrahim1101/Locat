import { useState } from "react";
import { ShieldAlert, Copy, Check, Plus, Trash2, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/state/auth";
import { trpc } from "@/providers/trpc";
import { AppShell, ModuleHeader } from "@/components/shell/AppShell";
import Login from "./Login";

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  critical: { label: "Critical", color: "#ef4444" },
  high: { label: "High", color: "#f97316" },
  medium: { label: "Medium", color: "#eab308" },
  low: { label: "Low", color: "#3b82f6" },
  info: { label: "Info", color: "#9ca3af" },
};
const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "#f97316" },
  acknowledged: { label: "Acknowledged", color: "#eab308" },
  resolved: { label: "Resolved", color: "#22c55e" },
};

function timeAgo(d: Date | string) {
  const t = new Date(d).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Sentinel() {
  const { state } = useAuth();
  if (state.status === "loading") {
    return <div className="locat-mesh flex min-h-dvh items-center justify-center"><p className="micro-label animate-pulse">connecting…</p></div>;
  }
  if (state.status !== "ready") return <Login />;
  return <SentinelApp />;
}

function SentinelApp() {
  const [tab, setTab] = useState<"incidents" | "integrations">("incidents");
  return (
    <AppShell active="sentinel">
      <ModuleHeader
        title="Sentinel"
        tagline="Security incidents & integration alerts"
        icon={ShieldAlert}
        actions={
          <div className="flex rounded-xl border border-border p-0.5" role="tablist">
            {(["incidents", "integrations"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                data-testid={`sentinel-tab-${t}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${tab === t ? "bg-primary/15 ember-text" : "text-secondary hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />
      <div className="scroll-slim flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
          {tab === "incidents" ? <Incidents /> : <Integrations />}
        </div>
      </div>
    </AppShell>
  );
}

function Incidents() {
  const [filter, setFilter] = useState<"all" | "open" | "acknowledged" | "resolved">("open");
  const [openId, setOpenId] = useState<number | null>(null);
  const statsQ = trpc.sentinel.stats.useQuery();
  const listQ = trpc.sentinel.incidents.useQuery(filter === "all" ? {} : { status: filter });

  const stats = statsQ.data;
  return (
    <div className="locat-fade-up">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Incident overview">
        <Stat label="Open" value={stats ? String(stats.byStatus.open) : "…"} />
        <Stat label="Acknowledged" value={stats ? String(stats.byStatus.acknowledged) : "…"} />
        <Stat label="Resolved" value={stats ? String(stats.byStatus.resolved) : "…"} />
        <Stat label="Open critical/high" value={stats ? String(stats.openCritical) : "…"} accent={!!stats && stats.openCritical > 0} />
      </section>

      <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Status filter">
        {(["open", "acknowledged", "resolved", "all"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            data-testid={`sentinel-filter-${f}`}
            style={{ flexShrink: 0 }}
            className={`h-9 rounded-full border px-4 text-xs font-medium capitalize transition-colors ${filter === f ? "border-primary/50 bg-primary/15 ember-text" : "border-border text-secondary hover:text-foreground"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <section className="mt-4 space-y-2" aria-label="Incidents" data-testid="sentinel-incident-list">
        {listQ.isLoading && <p className="micro-label py-8 text-center">loading incidents…</p>}
        {listQ.data?.items.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-card/50 px-4 py-10 text-center">
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-secondary" />
            <p className="text-sm font-medium">No {filter === "all" ? "" : filter} incidents</p>
            <p className="mt-1 text-xs text-secondary">Incidents arrive from your integration webhooks. Create a token in the Integrations tab.</p>
          </div>
        )}
        {listQ.data?.items.map((inc) => {
          const sev = SEVERITY_META[inc.severity];
          const st = STATUS_META[inc.status];
          return (
            <button
              key={inc.id}
              onClick={() => setOpenId(inc.id)}
              data-testid={`sentinel-incident-${inc.id}`}
              className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-card"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sev.color }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{inc.title}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-secondary">{timeAgo(inc.createdAt)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-secondary">
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase">{inc.source}</span>
                  <span style={{ color: sev.color }}>{sev.label}</span>
                  <span>·</span>
                  <span style={{ color: st.color }}>{st.label}</span>
                </span>
              </span>
            </button>
          );
        })}
      </section>

      {openId !== null && <IncidentDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function IncidentDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.sentinel.incident.useQuery({ id });
  const [note, setNote] = useState("");
  const invalidate = () => {
    void utils.sentinel.incident.invalidate({ id });
    void utils.sentinel.incidents.invalidate();
    void utils.sentinel.stats.invalidate();
  };
  const ack = trpc.sentinel.acknowledge.useMutation({ onSuccess: invalidate });
  const resolve = trpc.sentinel.resolve.useMutation({ onSuccess: invalidate });
  const reopen = trpc.sentinel.reopen.useMutation({ onSuccess: invalidate });
  const addNote = trpc.sentinel.note.useMutation({ onSuccess: () => { setNote(""); invalidate(); } });

  const inc = q.data?.incident;
  const sev = inc ? SEVERITY_META[inc.severity] : null;
  const st = inc ? STATUS_META[inc.status] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" data-testid="sentinel-incident-detail">
      <button className="absolute inset-0 bg-black/70" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {sev && <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: sev.color }}>{sev.label}</span>}
            <h2 className="text-base font-semibold leading-tight">{inc?.title ?? "…"}</h2>
            {inc && <p className="mt-0.5 text-xs text-secondary">{inc.source} · {st?.label} · {timeAgo(inc.createdAt)}</p>}
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <div className="scroll-slim flex-1 overflow-y-auto px-5 py-4">
          {inc?.description && <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-background/40 p-3 text-sm text-foreground/90">{inc.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={inc?.status === "resolved" || inc?.status === "acknowledged"} onClick={() => ack.mutate({ id })} data-testid="incident-ack" className="h-9 rounded-xl border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-40">Acknowledge</button>
            <button disabled={inc?.status === "resolved"} onClick={() => resolve.mutate({ id })} data-testid="incident-resolve" className="locat-metal-button h-9 rounded-xl px-3 text-xs font-semibold disabled:opacity-40">Resolve</button>
            {inc?.status === "resolved" && <button onClick={() => reopen.mutate({ id })} data-testid="incident-reopen" className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium hover:bg-accent"><RefreshCw className="h-3.5 w-3.5" /> Reopen</button>}
          </div>
          <div className="mt-5">
            <p className="obsidian-kicker mb-2">Timeline</p>
            <ul className="space-y-2">
              {q.data?.events.map((e) => (
                <li key={e.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="font-medium capitalize text-foreground">{e.action}</span>
                    {e.detail && <span className="text-secondary"> — {e.detail}</span>}
                    <span className="ml-1 text-secondary">· {timeAgo(e.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            data-testid="incident-note-input"
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 text-sm outline-none focus:border-primary/50"
            onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) addNote.mutate({ id, text: note.trim() }); }}
          />
          <button disabled={!note.trim()} onClick={() => addNote.mutate({ id, text: note.trim() })} className="h-10 rounded-xl border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-40">Note</button>
        </div>
      </div>
    </div>
  );
}

function Integrations() {
  const utils = trpc.useUtils();
  const tokensQ = trpc.sentinel.tokens.list.useQuery();
  const [name, setName] = useState("");
  const [source, setSource] = useState<"custom" | "nscout" | "pipelineguard">("custom");
  const [created, setCreated] = useState<{ token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const create = trpc.sentinel.tokens.create.useMutation({
    onSuccess: (data) => { setCreated({ token: data.token }); setName(""); void utils.sentinel.tokens.list.invalidate(); },
  });
  const revoke = trpc.sentinel.tokens.revoke.useMutation({ onSuccess: () => void utils.sentinel.tokens.list.invalidate() });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/sentinel/webhook?format=${source}`;

  return (
    <div className="locat-fade-up space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <h2 className="text-sm font-semibold">Create integration token</h2>
        <p className="mt-1 text-xs text-secondary">Scoped to <span className="ember-text">incidents:write</span>. Shown once, stored only as a hash. Revoke anytime.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name e.g. nScout prod" data-testid="token-name-input" className="h-10 flex-1 rounded-xl border border-border bg-background/60 px-3 text-sm outline-none focus:border-primary/50" />
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} aria-label="Integration source" className="h-10 rounded-xl border border-border bg-background/60 px-3 text-sm outline-none">
            <option value="custom">Custom / generic</option>
            <option value="nscout">nScout</option>
            <option value="pipelineguard">PipelineGuard</option>
          </select>
          <button disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name: name.trim(), source })} data-testid="token-create" className="locat-metal-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>
        <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-3">
          <p className="obsidian-kicker mb-1">Webhook URL</p>
          <code className="break-all font-mono-ui text-xs text-foreground/90">{webhookUrl}</code>
          <p className="mt-2 text-[11px] text-secondary">Send <code className="font-mono-ui">POST</code> with header <code className="font-mono-ui">Authorization: Bearer &lt;token&gt;</code>.</p>
        </div>
        {created && (
          <div className="mt-3 rounded-xl border border-primary/40 bg-primary/10 p-3" data-testid="token-created">
            <p className="text-xs font-semibold ember-text">Copy your token now — it won't be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono-ui text-xs">{created.token}</code>
              <button
                onClick={() => { void navigator.clipboard?.writeText(created.token).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
                className="flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs hover:bg-accent"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Tokens</h2>
        <div className="space-y-2" data-testid="token-list">
          {tokensQ.data?.length === 0 && <p className="rounded-2xl border border-border/70 bg-card/50 px-4 py-8 text-center text-sm text-secondary">No integration tokens yet.</p>}
          {tokensQ.data?.map((t) => (
            <div key={t.id} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${t.revokedAt ? "border-border/50 bg-card/30 opacity-60" : "border-border/70 bg-card/60"}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.name} {t.revokedAt && <span className="text-xs font-normal text-destructive">(revoked)</span>}</p>
                <p className="text-xs text-secondary">
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase">{t.source}</span>
                  <span className="ml-2 font-mono-ui">{t.tokenPrefix}…</span>
                  <span className="ml-2">{t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : "never used"}</span>
                </p>
              </div>
              {!t.revokedAt && (
                <button onClick={() => revoke.mutate({ id: t.id })} data-testid={`token-revoke-${t.id}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-destructive hover:bg-destructive/10" aria-label={`Revoke ${t.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-destructive/50 bg-destructive/10" : "border-border/70 bg-card/60"}`}>
      <p className={`text-2xl font-semibold ${accent ? "text-destructive" : ""}`}>{value}</p>
      <p className="mt-1 micro-label normal-case tracking-normal">{label}</p>
    </div>
  );
}
