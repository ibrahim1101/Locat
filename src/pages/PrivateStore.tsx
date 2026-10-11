import { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, KeyRound, Download, Trash2, Plus, RefreshCw } from "lucide-react";
import { z } from "zod";
import { AppShell, ModuleHeader } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/state/auth";
import { trpc } from "@/providers/trpc";
import { nativeServerUrl } from "@/lib/native";
import { b64decode, b64encode } from "@/lib/crypto";
import { downloadBlob } from "@/lib/download";
import { createPrivateStore, unlockPrivateStore, encryptPrivateEntry, decryptPrivateEntry, generatePrivatePassword, type PrivateScope } from "@/lib/privateStoreCrypto";
import { privateConfigSchema, privateEnvelopeSchema, PRIVATE_FILE_LIMIT, PRIVATE_STORE_MAX_OBJECTS, type PrivateModule, type PrivateConfig, type PrivateEntry } from "@contracts/privateStore";
import Login from "./Login";

type DisplayEntry = { id: string; revision: number; entry: PrivateEntry };
const emptyCredential = (): Extract<PrivateEntry, { kind: "credential" }> => ({ kind: "credential", name: "", folder: "", username: "", password: "", url: "", note: "", createdAt: Date.now() });
const backupSchema = z.object({ v: z.literal(1), app: z.literal("Locat private store"),
  scope: z.object({ userId: z.number().int().positive(), origin: z.string().max(2048), module: z.enum(["vault", "secrets"]) }).strict(),
  config: privateConfigSchema,
  objects: z.array(z.object({ id: z.uuid(), envelope: privateEnvelopeSchema }).strict()).max(PRIVATE_STORE_MAX_OBJECTS),
}).strict();

export default function PrivateStore({ module }: { module: PrivateModule }) {
  const { state } = useAuth();
  if (state.status === "loading") return <p role="status" className="p-6">Connecting…</p>;
  if (state.status !== "ready") return <Login />;
  return <PrivateStoreContent key={`${state.user.id}:${module}`} module={module} userId={state.user.id} />;
}

function PrivateStoreContent({ module, userId }: { module: PrivateModule; userId: number }) {
  const status = trpc.privateStore.status.useQuery({ module }, { retry: false });
  const initialize = trpc.privateStore.initialize.useMutation();
  const put = trpc.privateStore.put.useMutation();
  const remove = trpc.privateStore.remove.useMutation();
  const utils = trpc.useUtils();
  const key = useRef<CryptoKey | null>(null);
  const config = useRef<PrivateConfig | null>(null);
  const generation = useRef(0);
  const lastActivity = useRef(Date.now());
  const [unlocked, setUnlocked] = useState(false);
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(emptyCredential);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRevision, setEditingRevision] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const scope: PrivateScope = { module, userId, origin: nativeServerUrl() || window.location.origin };
  const lock = useCallback(() => {
    generation.current++;
    key.current = null; config.current = null;
    setEntries([]); setUnlocked(false); setPassphrase(""); setConfirmation("");
    setDraft(emptyCredential()); setEditingId(null); setEditingRevision(0); setSearch(""); setShowPassword(false); setPendingDelete(null); setError(""); setNotice(""); setBusy(false);
  }, []);
  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") lock(); };
    const activity = () => { lastActivity.current = Date.now(); };
    const timer = window.setInterval(() => { if (Date.now() - lastActivity.current >= 5 * 60_000) lock(); }, 10_000);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", lock);
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    const currentKey = key; const epoch = generation;
    return () => { currentKey.current = null; epoch.current++; window.clearInterval(timer);
      document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", lock);
      window.removeEventListener("pointerdown", activity); window.removeEventListener("keydown", activity); };
  }, [lock]);

  const run = async (operation: (epoch: number) => Promise<void>) => {
    const epoch = generation.current;
    setBusy(true); setError(""); setNotice("");
    try { await operation(epoch); }
    catch (e) { if (epoch === generation.current) setError(e instanceof Error ? e.message : "Operation failed."); }
    finally { if (epoch === generation.current) setBusy(false); }
  };
  const reload = async (epoch: number, activeKey = key.current, activeConfig = config.current) => {
    if (!activeKey || !activeConfig) return;
    const result = await status.refetch();
    if (!result.data) throw new Error("Could not load encrypted store.");
    if (result.data.config?.storeId !== activeConfig.storeId) { lock(); throw new Error("Store changed. Unlock again."); }
    const loaded: DisplayEntry[] = [];
    for (const row of result.data.objects) {
      if (epoch !== generation.current) return;
      const object = await utils.client.privateStore.get.query({ module, id: row.id });
      const entry = await decryptPrivateEntry(activeKey, activeConfig, scope, row.id, object.envelope);
      loaded.push({ id: row.id, revision: object.revision, entry });
    }
    if (epoch === generation.current) setEntries(loaded);
  };
  const unlock = () => void run(async epoch => {
    const result = await status.refetch();
    if (!result.data) throw new Error("Server unavailable. Try again.");
    let activeConfig = result.data.config; let activeKey: CryptoKey;
    const secret = passphrase;
    setPassphrase(""); setConfirmation("");
    if (!activeConfig) {
      if (secret !== confirmation) throw new Error("Passphrases must match.");
      const created = await createPrivateStore(secret, scope);
      if (epoch !== generation.current) return;
      await initialize.mutateAsync({ module, config: created.config });
      activeConfig = created.config; activeKey = created.key;
    } else {
      try { activeKey = await unlockPrivateStore(secret, activeConfig, scope); }
      catch { throw new Error("Could not unlock: check the passphrase, account and server address."); }
    }
    if (epoch !== generation.current) return;
    key.current = activeKey; config.current = activeConfig;
    lastActivity.current = Date.now();
    await reload(epoch, activeKey, activeConfig);
    if (epoch === generation.current) setUnlocked(true);
  });
  const saveEntry = async (entry: PrivateEntry, id: string, revision: number, epoch: number) => {
    const activeKey = key.current; const activeConfig = config.current;
    if (!activeKey || !activeConfig) throw new Error("Unlock first.");
    const envelope = await encryptPrivateEntry(activeKey, activeConfig, scope, id, entry);
    if (epoch !== generation.current) return;
    await put.mutateAsync({ module, id, envelope, expectedRevision: revision });
    await reload(epoch);
  };
  const addFile = (file: File) => void run(async epoch => {
    if (file.size > PRIVATE_FILE_LIMIT) throw new Error("This preview supports files up to 2 MiB.");
    const data = b64encode(await file.arrayBuffer());
    if (epoch !== generation.current) return;
    await saveEntry({ kind: "file", name: file.name.slice(0, 255), folder, mime: file.type.slice(0, 128), bytes: file.size, data, createdAt: Date.now() }, crypto.randomUUID(), 0, epoch);
  });
  const saveCredential = () => void run(async epoch => {
    await saveEntry(draft, editingId ?? crypto.randomUUID(), editingRevision, epoch);
    if (epoch === generation.current) { setDraft(emptyCredential()); setEditingId(null); setEditingRevision(0); setShowPassword(false); }
  });
  const exportBackup = () => void run(async epoch => {
    const result = await status.refetch();
    if (!result.data?.config) throw new Error("No store to export.");
    const objects = [];
    for (const row of result.data.objects) {
      if (epoch !== generation.current) return;
      const object = await utils.client.privateStore.get.query({ module, id: row.id });
      objects.push({ id: row.id, envelope: object.envelope });
    }
    if (epoch !== generation.current) return;
    const backup = backupSchema.parse({ v: 1, app: "Locat private store", scope, config: result.data.config, objects });
    const destination = await downloadBlob(new Blob([JSON.stringify(backup)], { type: "application/json" }), `locat-${module}-encrypted-backup.json`);
    if (epoch === generation.current) setNotice(destination === "browser" ? "Encrypted backup sent to your browser download manager." : destination === "cancelled" ? "Save cancelled." : "Encrypted backup saved.");
  });
  const restoreBackup = (file: File) => void run(async epoch => {
    if (file.size > 70 * 1024 * 1024) throw new Error("Backup is too large.");
    const backup = backupSchema.parse(JSON.parse(await file.text()));
    if (backup.scope.userId !== scope.userId || backup.scope.origin !== scope.origin || backup.scope.module !== scope.module)
      throw new Error("Backup belongs to a different account, server address or module.");
    if (new Set(backup.objects.map(o => o.id)).size !== backup.objects.length) throw new Error("Duplicate backup identifiers.");
    const result = await status.refetch();
    if (!result.data) throw new Error("Could not refresh store.");
    if (result.data.config && JSON.stringify(result.data.config) !== JSON.stringify(backup.config)) throw new Error("Backup belongs to another encrypted store. Existing keys will not be replaced.");
    let activeKey = key.current;
    if (!activeKey) {
      const secret = passphrase; setPassphrase(""); setConfirmation("");
      if (!secret) throw new Error("Enter the original backup's store passphrase before selecting its file.");
      try { activeKey = await unlockPrivateStore(secret, backup.config, scope); }
      catch { throw new Error("Backup could not be unlocked with that passphrase."); }
    }
    // Validate every ciphertext before making any write; restore only missing IDs.
    for (const object of backup.objects) {
      if (epoch !== generation.current) return;
      await decryptPrivateEntry(activeKey, backup.config, scope, object.id, object.envelope);
    }
    const missing = backup.objects.filter(object => !result.data!.objects.some(row => row.id === object.id));
    const additionalBytes = missing.reduce((total, object) => total + JSON.stringify(object.envelope).length, 0);
    if (result.data.objects.length + missing.length > result.data.maxObjects || result.data.bytes + additionalBytes > result.data.quota)
      throw new Error("Not enough encrypted-store capacity to restore these missing entries.");
    if (epoch !== generation.current) return;
    if (!result.data.config) await initialize.mutateAsync({ module, config: backup.config });
    if (epoch !== generation.current) return;
    key.current = activeKey; config.current = backup.config;
    const existing = new Set(result.data.objects.map(o => o.id));
    let restored = 0;
    for (const object of backup.objects) {
      if (epoch !== generation.current) return;
      if (existing.has(object.id)) continue;
      await put.mutateAsync({ module, id: object.id, expectedRevision: 0, envelope: object.envelope });
      restored++;
    }
    await reload(epoch);
    if (epoch === generation.current) { setUnlocked(true); setNotice(`Restored ${restored} missing entries. Existing entries were preserved.`); }
  });

  const filtered = entries.filter(({ entry }) => `${entry.name} ${entry.folder} ${entry.kind === "credential" ? entry.username : ""}`.toLowerCase().includes(search.toLowerCase()));
  const title = module === "vault" ? "Vault" : "Secrets";
  const initialized = Boolean(status.data?.config);
  return <AppShell active={module}>
    <ModuleHeader title={title} tagline="Client-encrypted private storage · preview" icon={module === "vault" ? LockKeyhole : KeyRound}
      actions={unlocked ? <Button variant="outline" onClick={lock}>Lock</Button> : undefined} />
    <div className="scroll-slim flex-1 overflow-y-auto"><div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <p className="text-sm text-secondary">Names, folders and contents are encrypted on this device before upload. Use a separate strong passphrase and keep it safe: Locat cannot recover it. Locks when hidden or after five minutes idle.</p>
      {status.error && <p role="alert" className="text-destructive">Server storage unavailable. {status.error.message}</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!unlocked ? <form className="max-w-md space-y-3 rounded-2xl border border-border bg-card p-5" onSubmit={event => { event.preventDefault(); unlock(); }}>
        <h2 className="font-semibold">{initialized ? `Unlock ${title}` : `Create encrypted ${title}`}</h2>
        <label className="block text-sm">Store passphrase<Input type="password" autoComplete={initialized ? "current-password" : "new-password"} value={passphrase} onChange={event => setPassphrase(event.target.value)} minLength={initialized ? 1 : 15} maxLength={1024} required /></label>
        {!initialized && <label className="block text-sm">Confirm passphrase<Input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required /></label>}
        <Button disabled={busy || status.isLoading || Boolean(status.error)} type="submit">{busy ? "Opening…" : initialized ? "Unlock" : "Create store"}</Button>
        <label className="block cursor-pointer rounded-lg border px-3 py-2 text-sm">Restore encrypted backup<input aria-label="Restore locked encrypted backup" className="sr-only" type="file" accept="application/json,.json" disabled={busy || status.isLoading || Boolean(status.error)} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) restoreBackup(file); }} /></label>
        <p className="text-xs text-secondary">To recover an empty store, enter its original passphrase, then choose its encrypted backup. The account and server address must match the backup.</p>
        <p className="text-xs text-secondary">AES-256-GCM with a random master key; PBKDF2-SHA256, 600,000 rounds. Account, server address and module are authenticated with every record.</p>
      </form> : <>
        <div className="flex flex-wrap items-center gap-3"><Input aria-label={`Search ${title}`} placeholder="Search decrypted names and folders on this device" value={search} onChange={event => setSearch(event.target.value)} className="flex-1" />
          <Button variant="outline" disabled={busy} onClick={() => void run(epoch => reload(epoch))}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button variant="outline" disabled={busy} onClick={exportBackup}>Encrypted backup</Button>
          <label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">Restore missing entries<input aria-label="Restore encrypted backup" className="sr-only" type="file" accept="application/json,.json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) restoreBackup(file); }} /></label>
        </div>
        <p className="text-xs text-secondary">{entries.length} entries · {((status.data?.bytes ?? 0) / 1048576).toFixed(2)} MiB encrypted / 64 MiB · 128 entries maximum per module</p>
        {module === "vault" ? <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
          <label className="text-sm">Folder path<Input value={folder} maxLength={200} onChange={event => setFolder(event.target.value)} placeholder="e.g. Projects/Locat" /></label>
          <label className="cursor-pointer rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm ember-text">Upload encrypted file<input aria-label="Upload Vault file" type="file" className="sr-only" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) addFile(file); }} /></label>
          <p className="text-xs text-secondary">2 MiB per file in this preview. Files download as inert binary data.</p>
        </section> : <form className="space-y-3 rounded-2xl border border-border bg-card p-4" onSubmit={event => { event.preventDefault(); saveCredential(); }}>
          <h2 className="font-semibold">{editingId ? "Edit credential or note" : "New credential or note"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["name", "folder", "username", "url"] as const).map(field => <label key={field} className="text-sm capitalize">{field}<Input value={draft[field]} required={field === "name"} maxLength={field === "name" || field === "folder" ? 200 : field === "url" ? 2048 : 500} autoComplete="off" onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))} /></label>)}
          </div>
          <label className="block text-sm">Password<Input type={showPassword ? "text" : "password"} value={draft.password} autoComplete="new-password" maxLength={4096} onChange={event => setDraft(previous => ({ ...previous, password: event.target.value }))} /></label>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setShowPassword(previous => !previous)}>{showPassword ? "Hide" : "Show"} password</Button><Button type="button" variant="outline" onClick={() => setDraft(previous => ({ ...previous, password: generatePrivatePassword() }))}>Generate 24 characters</Button></div>
          <label className="block text-sm">Secure note<textarea className="mt-1 w-full rounded-lg border bg-background p-2" value={draft.note} maxLength={16000} rows={3} onChange={event => setDraft(previous => ({ ...previous, note: event.target.value }))} /></label>
          <Button type="submit" disabled={busy || !draft.name.trim()}><Plus className="h-4 w-4" /> {busy ? "Saving…" : "Save encrypted"}</Button>
          {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setEditingRevision(0); setDraft(emptyCredential()); setShowPassword(false); }}>Cancel edit</Button>}
          <p className="text-xs text-secondary">Passwords are masked and clipboard copying is intentionally unavailable until a native clipboard lifecycle is verified.</p>
        </form>}
        <section aria-label={`${title} entries`} className="space-y-2">{!filtered.length && <p className="text-secondary">No matching entries.</p>}{filtered.map(row => <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1"><p className="break-words font-medium">{row.entry.name}</p><p className="break-words text-xs text-secondary">{row.entry.folder || "Root"} · {row.entry.kind === "file" ? `${row.entry.bytes.toLocaleString()} bytes` : row.entry.username || "Secure note"}</p></div>
          {row.entry.kind === "file" ? <Button variant="outline" disabled={busy} onClick={() => void run(async epoch => {
            if (row.entry.kind !== "file") return;
            const filename = [...row.entry.name].map(c => c === "/" || c === "\\" || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? "_" : c).join("").replace(/^\.+/, "_") || "download.bin";
            const destination = await downloadBlob(new Blob([b64decode(row.entry.data) as BlobPart], { type: "application/octet-stream" }), filename);
            if (epoch === generation.current) setNotice(destination === "browser" ? "File sent to the browser download manager." : destination === "cancelled" ? "Save cancelled." : "File saved.");
          })}><Download className="h-4 w-4" /> Download</Button> : <Button variant="outline" disabled={busy} onClick={() => { if (row.entry.kind === "credential") { setDraft(row.entry); setEditingId(row.id); setEditingRevision(row.revision); setShowPassword(false); } }}>Edit</Button>}
          {pendingDelete === row.id ? <><Button disabled={busy} onClick={() => void run(async epoch => { await remove.mutateAsync({ module, id: row.id, expectedRevision: row.revision }); if (epoch === generation.current) setPendingDelete(null); await reload(epoch); })}>Confirm deletion</Button><Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button></> : <Button variant="outline" disabled={busy} aria-label={`Delete ${row.entry.name}`} onClick={() => setPendingDelete(row.id)}><Trash2 className="h-4 w-4" /></Button>}
        </div>)}</section>
        <p className="text-xs text-secondary">Deletion removes active server ciphertext; backups, downloaded copies and storage remnants may remain. Backups restore missing entries into the same store and server address; large-file streaming, folder moves, previews and biometric unlock remain unfinished.</p>
      </>}
    </div></div>
  </AppShell>;
}
