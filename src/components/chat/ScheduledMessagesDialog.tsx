import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/providers/trpc";
import type { IdentityKeys } from "@/lib/crypto";
import type { ConversationSummary } from "@contracts/types";
import { forgetScheduledCopy, listScheduledCopies, type ScheduledCopy } from "@/lib/scheduledDrafts";
import { scheduleFailureLabel } from "@/lib/scheduleTime";
import { conversationTitle } from "./ChatWindow";

export function ScheduledMessagesDialog({ identity, server, userId, conversations, hiddenIds, hiddenReady, onClose }: {
  identity: IdentityKeys; server: string; userId: number; conversations: ConversationSummary[];
  hiddenIds: Set<number>; hiddenReady: boolean; onClose: () => void;
}) {
  const query = trpc.messages.scheduled.useQuery(undefined, { refetchInterval: 5000 });
  const schedule = trpc.messages.schedule.useMutation();
  const cancel = trpc.messages.cancelScheduled.useMutation();
  const [copies, setCopies] = useState<ScheduledCopy[]>([]);
  const [revision, setRevision] = useState(0);
  const [localError, setLocalError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => {
    let active = true;
    void listScheduledCopies(identity, server, userId).then(result => {
      if (active) { setCopies(result.copies); setLocalError(result.errors ? `${result.errors} encrypted local copies could not be opened.` : ""); }
    }).catch(() => { if (active) setLocalError("Encrypted local copies are unavailable."); });
    return () => { active = false; };
  }, [identity, server, userId, revision]);
  async function run(action: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError("");
    try { await action(); setRevision(n => n + 1); await query.refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : "The request could not be confirmed. Refresh before retrying."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const rows = [...(query.data ?? []).map(row => ({ id: row.clientMessageId, server: row, copy: copies.find(c => c.clientMessageId === row.clientMessageId) })),
    ...copies.filter(copy => !query.data?.some(row => row.clientMessageId === copy.clientMessageId)).map(copy => ({ id: copy.clientMessageId, server: undefined, copy }))];
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogTitle>Scheduled messages</DialogTitle>
      <p className="text-xs text-muted-foreground">Pending messages are held encrypted on the host. This device keeps encrypted text copies for recovery. Host terminal history stays through the scheduled date and for at least seven days; local copies stay until forgotten.</p>
      <p className="text-xs text-muted-foreground">Released means queued for recipients, not received or read.</p>
      {query.error && <p role="alert" className="text-sm text-destructive">Host status unavailable. Saved copies do not prove whether a request was accepted. {query.error.message}</p>}
      {localError && <p role="alert" className="text-sm text-destructive">{localError}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button className="min-h-11 rounded-xl border px-4" disabled={busy || query.isFetching} onClick={() => void query.refetch()}>Refresh host status</button>
      {!rows.length && <p role="status" className="text-sm text-muted-foreground">{query.isPending ? "Loading…" : "No scheduled messages or saved requests."}</p>}
      {rows.map(row => {
        const conversationId = row.server?.conversationId ?? row.copy!.conversationId;
        const privateChat = !hiddenReady || hiddenIds.has(conversationId);
        const conv = conversations.find(c => c.id === conversationId);
        const state = row.server?.state;
        const date = new Date(row.server?.deliverAt ?? row.copy!.deliverAt);
        return <article key={row.id} className="grid gap-2 rounded-xl border p-3 text-sm">
          <p className="font-semibold">{privateChat ? "Hidden conversation" : conv ? conversationTitle(conv, userId).title : "Unavailable conversation"}</p>
          <p className="text-xs text-muted-foreground">{date.toLocaleString()} · {state === "delivered" ? "Released to relay" : state ?? "Not confirmed / no longer in host history"}</p>
          {!privateChat && row.copy?.payload.type === "text" && <p className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words">{row.copy.payload.text}</p>}
          {state === "failed" && <p role="status">{scheduleFailureLabel(row.server!.failureCode)}</p>}
          {state === "pending" && date.getTime() < Date.now() && <p className="text-xs text-muted-foreground">Overdue; waiting for host processing or queue space.</p>}
          <div className="flex flex-wrap gap-2">
            {state === "pending" && <button disabled={busy} className="min-h-11 rounded-xl border px-3" onClick={() => void run(() => cancel.mutateAsync({ id: row.server!.id }))}>Cancel on host</button>}
            {!state && row.copy && <button disabled={busy || privateChat} className="min-h-11 rounded-xl border px-3" onClick={() => void run(() => schedule.mutateAsync({ directKeyContext: row.copy!.directKeyContext, conversationId, clientMessageId: row.copy!.clientMessageId, envelope: row.copy!.envelope, deliverAt: new Date(row.copy!.deliverAt) }))}>Retry exact saved request</button>}
            {row.copy && state && state !== "pending" && <button disabled={busy} className="min-h-11 rounded-xl border px-3" onClick={() => void run(() => forgetScheduledCopy(server, userId, row.id))}>Forget local copy</button>}
            {row.copy && !state && <button disabled={busy} className="min-h-11 rounded-xl border px-3" onClick={() => {
              if (window.confirm("Forget this encrypted local copy? This does not cancel any accepted host schedule. You will lose its exact retry request and recovery text.")) void run(() => forgetScheduledCopy(server, userId, row.id));
            }}>Forget unconfirmed copy</button>}
            {!privateChat && row.copy?.payload.type === "text" && <button disabled={busy} className="min-h-11 rounded-xl border px-3" onClick={() => void run(() => navigator.clipboard.writeText(row.copy!.payload.type === "text" ? row.copy!.payload.text : ""))}>Copy recovery text</button>}
          </div>
          {!state && row.copy && <p className="text-xs text-muted-foreground">Exact retries preserve the original ciphertext, ID and time. A new request with a past time is rejected. Local copies do not enter the normal send queue.</p>}
        </article>;
      })}
    </DialogContent>
  </Dialog>;
}
