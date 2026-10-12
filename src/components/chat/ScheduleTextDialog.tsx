import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { localScheduleValue, parseScheduleTime } from "@/lib/scheduleTime";

export function ScheduleTextDialog({ text, onClose, onManager, onSchedule }: {
  text: string; onClose: () => void; onManager: () => void;
  onSchedule: (date: Date) => Promise<void>;
}) {
  const [time, setTime] = useState(() => localScheduleValue(new Date(Math.ceil((Date.now() + 300_000) / 60_000) * 60_000)));
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  async function submit() {
    if (busyRef.current || uncertain) return;
    let date: Date;
    try { date = parseScheduleTime(time); } catch (e) { setError(e instanceof Error ? e.message : "Choose a valid time."); return; }
    busyRef.current = true; setBusy(true); setError("");
    try { await onSchedule(date); onClose(); }
    catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm the schedule.");
      setUncertain(true);
    } finally { busyRef.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent><DialogTitle>Schedule encrypted text</DialogTitle>
      <p className="whitespace-pre-wrap break-words rounded-xl border bg-muted/30 p-3 text-sm max-h-36 overflow-y-auto">{text}</p>
      <label className="grid gap-2 text-sm">Date and time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
        <input type="datetime-local" value={time} disabled={busy || uncertain} onChange={e => setTime(e.target.value)} className="min-h-11 min-w-0 rounded-xl border bg-background px-3" />
      </label>
      <p className="text-xs text-muted-foreground">One minute to 30 days ahead. The host must be online to release the message. Delivery may be late after downtime or a full queue.</p>
      <p className="text-xs text-muted-foreground">Group key changes and direct identity changes after acceptance stop release. Refresh the chat before scheduling after a key change.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {uncertain ? <button className="min-h-11 rounded-xl border px-4" onClick={() => { onClose(); onManager(); }}>Review saved requests</button>
        : <button className="min-h-11 rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-50" disabled={busy} onClick={() => void submit()}>{busy ? "Scheduling…" : "Schedule"}</button>}
    </DialogContent>
  </Dialog>;
}
