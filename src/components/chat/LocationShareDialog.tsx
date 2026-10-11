import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { captureLocation, type LocationPayload } from "@/lib/location";

export function LocationShareDialog({ recipient, onSend, onClose }: {
  recipient: string; onSend: (location: LocationPayload) => void; onClose: () => void;
}) {
  const [point, setPoint] = useState<LocationPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function close() { alive.current = false; onClose(); }
  async function locate() {
    setBusy(true); setError(""); setPoint(null);
    try { const result = await captureLocation(); if (alive.current) setPoint(result); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Location unavailable."); }
    finally { if (alive.current) setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent>
      <DialogTitle>Share a location with {recipient}</DialogTitle>
      <p className="text-sm text-secondary">Request your current location, review it, then send an encrypted snapshot to this conversation. This does not track you or update as you move.</p>
      <button type="button" disabled={busy} onClick={() => void locate()} className="min-h-11 rounded-md border px-3">{busy ? "Finding location…" : point ? "Refresh location" : "Allow one-time location lookup"}</button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {point && <div className="space-y-3">
        <p className="text-sm">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)} · accuracy approximately {Math.ceil(point.accuracyMeters)} m</p>
        <p className="text-xs text-secondary">Captured {new Date(point.capturedAt).toLocaleString()}. Recipients can save this snapshot.</p>
        <button type="button" className="min-h-11 rounded-md bg-primary px-3 text-primary-foreground" onClick={() => { onSend(point); close(); }}>Send this location</button>
      </div>}
      <button type="button" onClick={close} className="min-h-11 rounded-md border px-3">Cancel</button>
    </DialogContent>
  </Dialog>;
}
