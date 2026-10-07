import { useState } from "react";
import { downloadBlob } from "@/lib/download";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/state/auth";
import Login from "./Login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Action =
  | {
      kind: "disable" | "enable" | "revoke-sessions";
      userId: number;
      username: string;
    }
  | { kind: "cleanup" }
  | { kind: "backup" };
const size = (bytes: number | null) =>
  bytes === null ? "Unavailable" : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export default function Admin() {
  const { state } = useAuth();
  const access = trpc.admin.access.useQuery(undefined, {
    enabled: state.status === "ready",
    retry: false,
  });
  if (state.status === "loading") return <p className="p-6">Loading…</p>;
  if (state.status !== "ready") return <Login />;
  if (access.isLoading)
    return <p className="p-6">Checking administrator access…</p>;
  if (!access.data?.allowed)
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold">Administrator access required</h1>
        <p className="text-sm text-secondary">
          The server owner must grant your account administrator access from the
          server terminal.
        </p>
        <Link to="/" className="text-primary underline">
          Back to chats
        </Link>
      </div>
    );
  return <Dashboard />;
}
function Dashboard() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [auditPage, setAuditPage] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [password, setPassword] = useState(""),
    [backupPassword, setBackupPassword] = useState(""),
    [feedback, setFeedback] = useState("");
  const stats = trpc.admin.stats.useQuery(undefined, {
    refetchInterval: 30000,
    retry: false,
  });
  const accounts = trpc.admin.users.useQuery(
    { search, page },
    { retry: false }
  );
  const audit = trpc.admin.audit.useQuery(
    { page: auditPage },
    { retry: false }
  );
  const change = trpc.admin.accountAction.useMutation();
  const cleanup = trpc.admin.cleanup.useMutation();
  const backup = trpc.admin.backup.useMutation();
  const busy = change.isPending || cleanup.isPending || backup.isPending;
  function select(next: Action) {
    setAction(next);
    setPassword("");
    setBackupPassword("");
    setFeedback("");
  }
  async function perform() {
    if (!action) return;
    setFeedback("");
    try {
      if (action.kind === "backup") {
        const data = await backup.mutateAsync({ password, backupPassword });
        downloadBlob(new Blob([data], { type: "application/json" }), `Locat-server-${new Date().toISOString().slice(0, 10)}.locat-server`);
        setFeedback(
          "Encrypted metadata backup downloaded. Keep its password separately."
        );
      } else if (action.kind === "cleanup") {
        await cleanup.mutateAsync({ password });
        setFeedback(
          "Expired sessions, receipts, and queued messages cleaned up."
        );
      } else {
        await change.mutateAsync({
          password,
          action: action.kind,
          userId: action.userId,
        });
        setFeedback(`Account action completed: ${action.kind}.`);
      }
      setAction(null);
      await Promise.all([
        utils.admin.users.invalidate(),
        utils.admin.stats.invalidate(),
        utils.admin.audit.invalidate(),
      ]);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Administrator action failed."
      );
    } finally {
      setPassword("");
      setBackupPassword("");
    }
  }
  const error = stats.error ?? accounts.error ?? audit.error;
  const info = stats.data;
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-12 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="micro-label">Locat administration</p>
          <h1 className="mt-1 text-2xl font-semibold">Server dashboard</h1>
        </div>
        <Link to="/" className="rounded-lg border px-4 py-2 text-sm">
          Back to chats
        </Link>
      </header>
      <p className="text-sm text-secondary">
        Manage accounts and server metadata. Passwords, session tokens,
        private-key backups, and decrypted chats are never shown here.
      </p>
      {error && (
        <p role="alert" className="rounded-lg border p-3 text-destructive">
          {error.message}
          <Button
            variant="outline"
            className="ml-3"
            onClick={() => void utils.admin.invalidate()}
          >
            Retry
          </Button>
        </p>
      )}
      {feedback && (
        <p role="status" className="rounded-lg border bg-card p-3 text-sm">
          {feedback}
        </p>
      )}
      <section
        aria-label="Server statistics"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        {info &&
          Object.entries({
            Accounts: info.accounts,
            "Disabled accounts": info.disabledAccounts,
            "Active sessions": info.sessions,
            Conversations: info.conversations,
            "Queued messages": info.queuedMessages,
            "Encrypted queue": size(info.queueBytes),
            Database: size(info.databaseBytes),
            "Host disk free": size(info.diskFreeBytes),
          }).map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-secondary">{label}</p>
              <p className="mt-2 text-xl font-semibold">{value}</p>
            </div>
          ))}
      </section>
      {info && (
        <p className="text-xs text-secondary">
          Database ready · Host uptime {Math.floor(info.uptimeSeconds / 3600)}h
          · Host memory free {size(info.memoryFreeBytes)} /{" "}
          {size(info.memoryTotalBytes)}. In containers, host metrics may reflect
          the container or underlying host.
        </p>
      )}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Accounts</h2>
          <Input
            aria-label="Search accounts"
            placeholder="Search name or username"
            value={search}
            className="max-w-sm"
            onChange={e => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card">
              <tr>
                <th className="p-3">Account</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3">Controls</th>
              </tr>
            </thead>
            <tbody>
              {accounts.data?.items.map(user => (
                <tr key={user.id} className="border-t">
                  <td className="p-3">
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-xs text-secondary">
                      @{user.username} · #{user.id}
                    </p>
                  </td>
                  <td className="p-3">
                    {user.disabled
                      ? "Disabled"
                      : user.isAdmin
                        ? "Administrator"
                        : "Active"}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {user.isAdmin ? (
                      <span className="text-xs text-secondary">
                        Managed from terminal
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            select({
                              kind: user.disabled ? "enable" : "disable",
                              userId: user.id,
                              username: user.username,
                            })
                          }
                        >
                          {user.disabled ? "Enable" : "Disable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            select({
                              kind: "revoke-sessions",
                              userId: user.id,
                              username: user.username,
                            })
                          }
                        >
                          Sign out
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {accounts.data?.items.length === 0 && (
          <p className="text-sm text-secondary">No matching accounts.</p>
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm">Page {page + 1}</span>
          <Button
            variant="outline"
            disabled={!accounts.data?.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">Maintenance & recovery</h2>
        <p className="text-sm text-secondary">
          Encrypted backups include accounts and group metadata. Sessions and
          queued messages are excluded. Restore is performed from the server
          terminal into an empty database.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => select({ kind: "backup" })}>
            Download encrypted metadata backup
          </Button>
          <Button variant="outline" onClick={() => select({ kind: "cleanup" })}>
            Clean expired data
          </Button>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Administrator action log</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target</th>
              </tr>
            </thead>
            <tbody>
              {audit.data?.items.map(entry => (
                <tr key={entry.id} className="border-t">
                  <td className="whitespace-nowrap p-3">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {entry.actorId === 0
                      ? "Server terminal"
                      : `Account #${entry.actorId}`}
                  </td>
                  <td className="p-3">{entry.action}</td>
                  <td className="p-3">
                    {entry.targetId ? `Account #${entry.targetId}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={auditPage === 0}
            onClick={() => setAuditPage(auditPage - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={!audit.data?.hasMore}
            onClick={() => setAuditPage(auditPage + 1)}
          >
            Next
          </Button>
        </div>
      </section>
      <Dialog
        open={!!action}
        onOpenChange={open => {
          if (!open && !busy) {
            setAction(null);
            setPassword("");
            setBackupPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.kind === "backup"
                ? "Encrypted server backup"
                : action?.kind === "cleanup"
                  ? "Clean expired server data"
                  : `${action?.kind} account`}
            </DialogTitle>
            <DialogDescription>
              {action && "username" in action
                ? `Confirm this action for @${action.username}.`
                : action?.kind === "cleanup"
                  ? "Deletes expired sessions, seven-day retry receipts, and messages undelivered for more than 30 days. Expired messages cannot be recovered."
                  : "This backup contains sensitive account metadata protected by the backup password."}
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm">
            Your administrator login password
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          {action?.kind === "backup" && (
            <label className="space-y-2 text-sm">
              New backup password (at least 12 characters)
              <Input
                type="password"
                autoComplete="new-password"
                value={backupPassword}
                onChange={e => setBackupPassword(e.target.value)}
                disabled={busy}
              />
            </label>
          )}
          {feedback && (
            <p role="alert" className="text-sm text-destructive">
              {feedback}
            </p>
          )}
          <Button
            disabled={
              busy ||
              !password ||
              (action?.kind === "backup" && backupPassword.length < 12)
            }
            onClick={() => void perform()}
          >
            {busy ? "Working…" : "Confirm"}
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
