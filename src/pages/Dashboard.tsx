import { useEffect, useState } from "react";
import type { ConversationSummary } from "@contracts/types";
import { cachedConversations, getMessages, hiddenConversationIds, pendingMessages } from "@/lib/localdb";
import { visibleConversations, conversationTitle } from "@/lib/globalSearch";
import { Link } from "react-router";
import { ArrowUpRight, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/state/auth";
import { trpc } from "@/providers/trpc";
import { userCode } from "@contracts/userCode";
import { MODULES, moduleDisabledReason, type LocatModule } from "@/modules/registry";
import { LocatMark, LocatWordmark } from "@/components/LocatBrand";
import { AppShell } from "@/components/shell/AppShell";
import { useServerConnection } from "@/state/connection";
import Login from "./Login";

export default function Dashboard() {
  const { state } = useAuth();
  if (state.status === "loading") {
    return (
      <div className="locat-mesh flex min-h-dvh items-center justify-center">
        <p className="micro-label animate-pulse">connecting…</p>
      </div>
    );
  }
  if (state.status !== "ready") return <Login />;
  return <DashboardHome key={state.user.id} />;
}

function DashboardHome() {
  const connected = useServerConnection();
  const { state, logout } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  const conversationsQ = trpc.conversations.list.useQuery(undefined, { retry: false, enabled: connected });
  const [activity, setActivity] = useState<{ conversations: ConversationSummary[]; recent: { conversation: ConversationSummary; at: number }[]; messages: number; pending: number; cached: boolean } | null>(null);
  const [activityError, setActivityError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setActivity(null);
      if (!user || (connected && conversationsQ.isPending)) return;
      const rows = conversationsQ.data ?? await cachedConversations(user.id);
      const hidden = await hiddenConversationIds(user.id);
      const visible = visibleConversations(user.id, rows, hidden);
      const histories = await Promise.all(visible.map(conversation => getMessages(user.id, conversation.id)));
      const pending = await pendingMessages(user.id);
      const recent = visible.map((conversation, index) => ({ conversation, at: histories[index].reduce((latest, message) => message.hidden || message.deleted ? latest : Math.max(latest, message.createdAt), 0) })).sort((a, b) => b.at - a.at).slice(0, 5);
      if (!cancelled) { setActivity({ conversations: visible, recent, messages: histories.flat().filter(message => !message.hidden && !message.deleted).length, pending: pending.filter(message => visible.some(conversation => conversation.id === message.conversationId)).length, cached: !conversationsQ.data }); setActivityError(""); }
    };
    void load().catch(() => { if (!cancelled) setActivityError("Local activity unavailable; check device storage permissions."); });
    return () => { cancelled = true; };
  }, [user, conversationsQ.data, conversationsQ.isPending, connected]);
  const sentinelStatsQ = trpc.sentinel.stats.useQuery(undefined, { refetchInterval: 15000, enabled: connected });
  const openCritical = sentinelStatsQ.data?.openCritical ?? 0;

  const liveModules = MODULES.filter((m) => m.status !== "planned" && m.id !== "dashboard");
  const plannedModules = MODULES.filter((m) => m.status === "planned");
  const conversationCount = activity?.conversations.length;

  return (
    <AppShell active="dashboard">
      <div className="scroll-slim flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
          {/* Masthead */}
          <header className="locat-fade-up flex items-start justify-between gap-4" data-testid="dashboard-masthead">
            <div className="flex min-w-0 items-center gap-4">
              <LocatMark className="h-14 w-14" />
              <div className="min-w-0">
                <p className="obsidian-kicker">Private digital ecosystem</p>
                <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  <LocatWordmark className="text-2xl sm:text-3xl" />
                </h1>
                {user && (
                  <p className="mt-1 truncate text-sm text-secondary" title={`@${user.username} · ${userCode(user.lcCode)}`}>
                    {user.displayName} · @{user.username} · {userCode(user.lcCode)}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout().catch(() => {})}
              className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs text-secondary hover:bg-accent hover:text-foreground"
              data-testid="dashboard-signout"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </header>

          {/* Stat strip */}
          <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Overview">
            <Stat label="Conversations" value={conversationCount === undefined ? "…" : String(conversationCount)} />
            <Stat label="Live modules" value={String(liveModules.length + 1)} />
            <Stat label="Planned" value={String(plannedModules.length)} />
            <Stat label="Encryption" value="E2EE" hint="device-held keys" />
          </section>

          <section className="mt-7 grid gap-3 sm:grid-cols-2" aria-label="Recent activity and device status">
            <div className="rounded-2xl border bg-card/60 p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Recent conversations</h2><Link to="/search" className="text-xs ember-text">Search history</Link></div>
              {activityError && <p role="alert" className="mt-2 text-xs text-destructive">{activityError}</p>}
              {!activity && !activityError && <p role="status" className="mt-3 text-xs text-secondary">Loading visible local activity…</p>}
              {activity?.cached && <p className="mt-2 text-xs text-secondary">Cached membership; reconnect to verify changes.</p>}
              {activity?.recent.length === 0 && <p className="mt-3 text-xs text-secondary">No visible conversations yet.</p>}
              <ul className="mt-3 space-y-2">{activity?.recent.map(row => <li key={row.conversation.id}>{connected ? <Link to={`/messages?conversation=${row.conversation.id}`} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-accent"><span className="truncate text-sm">{conversationTitle(row.conversation, user!.id)}</span><span className="shrink-0 text-xs text-secondary">{row.at ? new Date(row.at).toLocaleDateString() : "No local history"}</span></Link> : <span aria-disabled className="block p-2 text-sm text-secondary">{conversationTitle(row.conversation, user!.id)} · Connect to server</span>}</li>)}</ul>
            </div>
            <div className="rounded-2xl border bg-card/60 p-4"><h2 className="text-sm font-semibold">Devices, transfers and security</h2><dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt>Devices and transfers</dt><dd>{connected ? <Link to="/link" className="ember-text">Verify this device in Link</Link> : <span aria-disabled>Connect to server</span>}</dd></div>
              <div className="flex justify-between gap-2"><dt>Critical security incidents</dt><dd>{sentinelStatsQ.isError ? "Unavailable" : sentinelStatsQ.data ? openCritical : "…"}</dd></div>
              <div className="flex justify-between gap-2"><dt>Visible messages on this device</dt><dd>{activity?.messages ?? "…"}</dd></div>
              <div className="flex justify-between gap-2"><dt>Queued encrypted messages</dt><dd>{activity?.pending ?? "…"}</dd></div>
            </dl><p className="mt-3 text-xs text-secondary">Device and transfer details require local device verification in Link. Local usage counts exclude hidden/deleted history.</p><div className="mt-3 flex gap-4 text-xs ember-text">{connected ? <><Link to="/link">Manage devices</Link><Link to="/sentinel">Review security</Link></> : <span aria-disabled>Connect to server for device and security options</span>}</div></div>
          </section>

          {/* Live modules */}
          <section className="mt-9" aria-labelledby="live-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="live-heading" className="text-sm font-semibold tracking-tight">Modules</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-secondary"><ShieldCheck className="h-3.5 w-3.5 ember-text" /> self-hosted</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liveModules.map((m) => (
                <ModuleCard key={m.id} module={m} badge={m.id === "sentinel" && openCritical > 0 ? openCritical : undefined} />
              ))}
            </div>
          </section>

          {/* Roadmap */}
          <section className="mt-9" aria-labelledby="roadmap-heading">
            <h2 id="roadmap-heading" className="mb-3 text-sm font-semibold tracking-tight">Roadmap</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plannedModules.map((m) => (
                <ModuleCard key={m.id} module={m} />
              ))}
            </div>
            <p className="mt-4 text-xs text-secondary">
              Planned modules are shown honestly as upcoming. Each ships as a complete, tested feature before it becomes tappable.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 micro-label normal-case tracking-normal">{label}</p>
      {hint && <p className="text-[10px] text-secondary">{hint}</p>}
    </div>
  );
}

function ModuleCard({ module, badge }: { module: LocatModule; badge?: number }) {
  const Icon = module.icon;
  const planned = module.status === "planned";
  const connected = useServerConnection();
  const { state } = useAuth();
  const disabled = moduleDisabledReason(module, connected, state.status === "ready" && !!state.user.isAdmin);
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border ${planned ? "border-border bg-accent text-secondary" : "border-primary/40 bg-primary/10 ember-text"}`}>
          <Icon className="h-5 w-5" />
          {badge !== undefined && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white" data-testid={`module-badge-${module.id}`}>{badge}</span>
          )}
        </span>
        {planned ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary">{module.milestone}</span>
        ) : (
          <ArrowUpRight className="h-4 w-4 text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        )}
      </div>
      {disabled && <p className="mt-2 text-xs text-secondary">{disabled}</p>}
      <h3 className="mt-3 text-sm font-semibold tracking-tight">{module.name}</h3>
      <p className="text-[11px] ember-text">{module.tagline}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-secondary">{module.description}</p>
    </>
  );
  const base = "group block rounded-2xl border p-4 transition-all";
  if (disabled) {
    return (
      <div className={`${base} border-border/60 bg-card/40 opacity-70`} data-testid={`module-card-${module.id}`} aria-disabled>
        {inner}
      </div>
    );
  }
  return (
    <Link to={module.route} className={`${base} border-border/70 bg-card/70 hover:border-primary/50 hover:bg-card active:scale-[0.99]`} data-testid={`module-card-${module.id}`}>
      {inner}
    </Link>
  );
}
