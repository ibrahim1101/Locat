import { Link } from "react-router";
import { ArrowUpRight, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/state/auth";
import { trpc } from "@/providers/trpc";
import { userCode } from "@contracts/userCode";
import { MODULES, type LocatModule } from "@/modules/registry";
import { LocatMark, LocatWordmark } from "@/components/LocatBrand";
import { AppShell } from "@/components/shell/AppShell";
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
  return <DashboardHome />;
}

function DashboardHome() {
  const { state, logout } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  const conversationsQ = trpc.conversations.list.useQuery();

  const liveModules = MODULES.filter((m) => m.status !== "planned" && m.id !== "dashboard");
  const plannedModules = MODULES.filter((m) => m.status === "planned");
  const conversationCount = conversationsQ.data?.length ?? 0;

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
            <Stat label="Conversations" value={conversationsQ.isLoading ? "…" : String(conversationCount)} />
            <Stat label="Live modules" value={String(liveModules.length + 1)} />
            <Stat label="Planned" value={String(plannedModules.length)} />
            <Stat label="Encryption" value="E2EE" hint="device-held keys" />
          </section>

          {/* Live modules */}
          <section className="mt-9" aria-labelledby="live-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="live-heading" className="text-sm font-semibold tracking-tight">Modules</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-secondary"><ShieldCheck className="h-3.5 w-3.5 ember-text" /> self-hosted</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liveModules.map((m) => (
                <ModuleCard key={m.id} module={m} />
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

function ModuleCard({ module }: { module: LocatModule }) {
  const Icon = module.icon;
  const planned = module.status === "planned";
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${planned ? "border-border bg-accent text-secondary" : "border-primary/40 bg-primary/10 ember-text"}`}>
          <Icon className="h-5 w-5" />
        </span>
        {planned ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary">{module.milestone}</span>
        ) : (
          <ArrowUpRight className="h-4 w-4 text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        )}
      </div>
      <h3 className="mt-3 text-sm font-semibold tracking-tight">{module.name}</h3>
      <p className="text-[11px] ember-text">{module.tagline}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-secondary">{module.description}</p>
    </>
  );
  const base = "group block rounded-2xl border p-4 transition-all";
  if (planned) {
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
