import { Server, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "@/state/auth";
import { trpc } from "@/providers/trpc";
import { AppShell, ModuleHeader } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import Login from "./Login";

const size = (bytes: number | null) => bytes === null ? "Unavailable" : `${(bytes / 1048576).toFixed(1)} MiB`;
export default function Hub() {
  const { state } = useAuth();
  if (state.status === "loading") return <p role="status" className="p-6">Connecting…</p>;
  if (state.status !== "ready") return <Login />;
  return <HubMetrics />;
}
function HubMetrics() {
  // Server authorization is authoritative, including administrator role changes.
  const metrics = trpc.admin.stats.useQuery(undefined, { retry: false, refetchInterval: 15_000 });
  const data = metrics.data;
  const rows = data ? [
    ["Database", data.database], ["Accounts", String(data.accounts)], ["Disabled accounts", String(data.disabledAccounts)],
    ["Active sessions", String(data.sessions)], ["Conversations", String(data.conversations)],
    ["Queued encrypted messages", String(data.queuedMessages)], ["Relay ciphertext size", size(data.queueBytes)],
    ["Database storage", size(data.databaseBytes)], ["Filesystem free", size(data.diskFreeBytes)],
    ["Filesystem total", size(data.diskTotalBytes)], ["OS-reported free RAM", size(data.memoryFreeBytes)],
    ["OS-reported total RAM", size(data.memoryTotalBytes)], ["OS uptime", `${Math.floor(data.uptimeSeconds / 3600)}h ${Math.floor(data.uptimeSeconds % 3600 / 60)}m`],
  ] : [];
  return <AppShell active="hub"><ModuleHeader title="Hub" tagline="Read-only server health · administrator access" icon={Server}
    actions={<Button variant="outline" disabled={metrics.isFetching} onClick={() => void metrics.refetch()}><RefreshCw className="h-4 w-4" /> Refresh</Button>} />
    <main className="scroll-slim flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-4xl space-y-5">
      <p className="text-sm text-secondary">Health readings come from Locat's existing least-privilege backend. No Docker socket, host agent or privileged host access is required.</p>
      {metrics.isPending && <p role="status">Loading server metrics…</p>}
      {metrics.error && <p role="alert" className="text-destructive">Server metrics unavailable. This page requires a current administrator session and a reachable database.</p>}
      {data && <><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-card p-4"><dt className="text-xs text-secondary">{label}</dt><dd className="mt-2 text-lg font-semibold">{value}</dd></div>)}</dl>
        <p className="text-xs text-secondary">Updated {new Date(metrics.dataUpdatedAt).toLocaleTimeString()}. OS RAM and uptime can describe the host rather than container limits. Filesystem values describe the app's filesystem; CPU usage, transcoding activity, update health, scheduled backups and warning notifications remain unfinished.</p>
      </>}
      <Link to="/admin" className="inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm">Open server administration and audit history</Link>
    </div></main>
  </AppShell>;
}
