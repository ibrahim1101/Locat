import { Notifications } from "./Notifications";
import { downloadBlob } from "@/lib/download";
import { Preferences } from "./Preferences";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { allMessages, importMessages } from "@/lib/localdb";
import { decodeArchive, encodeArchive, MAX_BACKUP_BYTES } from "@/lib/archive";
import type { SessionUser } from "@/state/auth";

export function StorageDialog({ user, open, onOpenChange, onImported }: {
  user: SessionUser; open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [storage, setStorage] = useState("Checking device storage…");
  const fileInput = useRef<HTMLInputElement>(null);
  const account = { userId: user.id, username: user.username, origin: location.origin };
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const estimate = await navigator.storage?.estimate?.();
      const persistent = await navigator.storage?.persisted?.();
      if (!cancelled) setStorage(`${((estimate?.usage ?? 0) / 1024 / 1024).toFixed(1)} MB used by Locat on this browser · ${persistent ? "persistent storage enabled" : "storage may be cleared by the browser"}`);
    })().catch(() => { if (!cancelled) setStorage("Storage information unavailable in this browser."); });
    return () => { cancelled = true; };
  }, [open]);

  async function perform(work: () => Promise<void>) {
    setBusy(true); setFeedback("");
    try { await work(); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Could not access local history."); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={(next) => {
    if (busy) return;
    if (!next) { setPassword(""); setFeedback(""); }
    onOpenChange(next);
  }}>
    <DialogContent className="surface-2 max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>Settings & backups</DialogTitle>
        <DialogDescription>Your chat history lives on this device. Keep a backup before clearing browser data or changing phones.</DialogDescription>
      </DialogHeader>
      <Preferences />
      <Notifications />
      <p className="text-xs text-secondary">One active login per account. Signing in on another device ends this session; saved history stays here.</p>
      <p className="text-sm text-secondary">{storage}</p>
      <Button variant="outline" disabled={busy} onClick={() => void perform(async () => {
        const allowed = await navigator.storage?.persist?.();
        setFeedback(allowed ? "Persistent storage enabled. Backups are still recommended." : "Your browser did not grant persistent storage. Keep regular backups.");
      })}>Protect device storage</Button>
      <div className="space-y-2">
        <Label htmlFor="backup-password">Backup password</Label>
        <Input id="backup-password" type="password" autoComplete="new-password" minLength={8}
          value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} placeholder="At least 8 characters" />
        <p className="text-xs text-secondary">Backups are encrypted. Keep this password safe; Locat cannot recover it. Files contain history and images, not your identity keys.</p>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy || password.length < 8} onClick={() => void perform(async () => {
          const text = await encodeArchive(account, await allMessages(user.id), password);
          downloadBlob(new Blob([text], { type: "application/json" }), `Locat-${user.username}-${new Date().toISOString().slice(0, 10)}.locat`);
          setFeedback("Encrypted backup downloaded. Store it somewhere safe.");
        })}>{busy ? "Working…" : "Export backup"}</Button>
        <Button className="flex-1" variant="outline" disabled={busy || password.length < 8}
          onClick={() => fileInput.current?.click()}>Import backup</Button>
      </div>
      <input ref={fileInput} type="file" accept=".locat,application/json" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        void perform(async () => {
          if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup must be smaller than 50 MB.");
          const messages = await decodeArchive(await file.text(), account, password);
          const count = await importMessages(user.id, messages);
          onImported(); setFeedback(`Imported ${count} messages. Existing messages were kept.`);
        });
      }} />
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      <p className="text-xs text-secondary">Import merges history for this account on this server. Limit: 50 MB per file. History on the device itself is not encrypted at rest.</p>
    </DialogContent>
  </Dialog>;
}
