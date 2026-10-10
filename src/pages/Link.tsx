import { useEffect, useRef, useState } from "react";
import { Radio, Smartphone, Monitor, Trash2, ShieldCheck, Upload, Download, Clipboard, Check, X, Send } from "lucide-react";
import { useAuth } from "@/state/auth";
import { trpc } from "@/providers/trpc";
import { AppShell, ModuleHeader } from "@/components/shell/AppShell";
import Login from "./Login";
import { downloadBlob } from "@/lib/download";
import {
  generateDeviceIdentity, deviceSharedKey, pairingSas, chunkCount, sliceChunk,
  encryptChunk, decryptChunk, encryptText, decryptText, type DeviceIdentity,
} from "@/lib/link";
import { loadDeviceKeys, saveDeviceKeys, kvGet, kvSet } from "@/lib/localdb";

export default function LinkPage() {
  const { state } = useAuth();
  if (state.status === "loading") return <div className="locat-mesh flex min-h-dvh items-center justify-center"><p className="micro-label animate-pulse">connecting…</p></div>;
  if (state.status !== "ready") return <Login />;
  return <LinkApp userId={state.user.id} />;
}

function platformLabel() { return /android|iphone|ipad|mobile/i.test(navigator.userAgent) ? "mobile" : "web"; }

const deviceBootstrap = new Map<number, Promise<{ identity: DeviceIdentity; id: number }>>();

function useThisDevice(userId: number) {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const register = trpc.link.devices.register.useMutation();
  const registerRef = useRef(register);
  useEffect(() => { registerRef.current = register; }, [register]);
  useEffect(() => {
    let cancelled = false;
    // Memoize bootstrap per account so React StrictMode's double-invoked effect
    // (and remounts) never races two device registrations into existence.
    let promise = deviceBootstrap.get(userId);
    if (!promise) {
      promise = (async () => {
        let keys = await loadDeviceKeys(userId);
        let pub: string | undefined = await kvGet<string>(userId, "link-device-pub");
        if (!keys || !pub) {
          const gen = await generateDeviceIdentity();
          await saveDeviceKeys(userId, { privateKey: gen.privateKey, publicKey: gen.publicKey });
          await kvSet(userId, "link-device-pub", gen.publicKeyB64);
          keys = { privateKey: gen.privateKey, publicKey: gen.publicKey };
          pub = gen.publicKeyB64;
        }
        const defaultName = (await kvGet<string>(userId, "link-device-name")) ?? `${platformLabel() === "mobile" ? "Phone" : "Browser"} device`;
        const { id } = await registerRef.current.mutateAsync({ name: defaultName, platform: platformLabel(), publicKey: pub! });
        return { identity: { privateKey: keys.privateKey, publicKey: keys.publicKey, publicKeyB64: pub! }, id };
      })();
      deviceBootstrap.set(userId, promise);
    }
    void promise.then((r) => { if (!cancelled) { setIdentity(r.identity); setDeviceId(r.id); } }).catch(() => deviceBootstrap.delete(userId));
    return () => { cancelled = true; };
  }, [userId]);
  return { identity, deviceId };
}

function LinkApp({ userId }: { userId: number }) {
  const { identity, deviceId } = useThisDevice(userId);
  const [tab, setTab] = useState<"devices" | "transfers" | "clipboard">("devices");
  return (
    <AppShell active="link">
      <ModuleHeader title="Link" tagline="Secure device pairing & encrypted transfer" icon={Radio}
        actions={
          <div className="flex rounded-xl border border-border p-0.5" role="tablist">
            {(["devices", "transfers", "clipboard"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`link-tab-${t}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${tab === t ? "bg-primary/15 ember-text" : "text-secondary hover:text-foreground"}`}>{t}</button>
            ))}
          </div>
        } />
      <div className="scroll-slim flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
          {!identity || !deviceId ? <p className="micro-label py-10 text-center animate-pulse">registering this device…</p> : (
            <>
              {tab === "devices" && <Devices userId={userId} myId={deviceId} identity={identity} />}
              {tab === "transfers" && <Transfers myId={deviceId} identity={identity} />}
              {tab === "clipboard" && <Clip myId={deviceId} identity={identity} />}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Devices({ userId, myId, identity }: { userId: number; myId: number; identity: DeviceIdentity }) {
  const utils = trpc.useUtils();
  const devicesQ = trpc.link.devices.list.useQuery(undefined, { refetchInterval: 8000 });
  const pairingsQ = trpc.link.pair.list.useQuery(undefined, { refetchInterval: 6000 });
  const start = trpc.link.pair.start.useMutation();
  const revoke = trpc.link.devices.revoke.useMutation({ onSuccess: () => void utils.link.devices.list.invalidate() });
  const [pairId, setPairId] = useState<number | null>(null);

  const devices = devicesQ.data ?? [];
  const pairings = pairingsQ.data ?? [];
  const me = devices.find((d) => d.id === myId);
  const others = devices.filter((d) => d.id !== myId && !d.revokedAt);
  const pairStatus = (otherId: number) => {
    const [lo, hi] = myId < otherId ? [myId, otherId] : [otherId, myId];
    return pairings.find((p) => p.deviceA === lo && p.deviceB === hi);
  };

  return (
    <div className="locat-fade-up space-y-5">
      <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4" data-testid="link-this-device">
        <p className="obsidian-kicker">This device</p>
        <div className="mt-2 flex items-center gap-3">
          {platformLabel() === "mobile" ? <Smartphone className="h-6 w-6 ember-text" /> : <Monitor className="h-6 w-6 ember-text" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me?.name ?? "This device"}</p>
            <p className="font-mono-ui text-[11px] text-secondary">key {identity.publicKeyB64.slice(0, 16)}…</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Paired &amp; available devices</h2>
        {others.length === 0 && <p className="rounded-2xl border border-border/70 bg-card/50 px-4 py-8 text-center text-sm text-secondary">Open Locat Link on another device while signed in to this account. It registers automatically and appears here to pair.</p>}
        <div className="space-y-2" data-testid="link-device-list">
          {others.map((d) => {
            const pair = pairStatus(d.id);
            return (
              <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
                {d.platform === "mobile" ? <Smartphone className="h-5 w-5 text-secondary" /> : <Monitor className="h-5 w-5 text-secondary" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.name}</p>
                  <p className="text-xs text-secondary">
                    {pair?.status === "verified" ? <span className="inline-flex items-center gap-1 text-green-500"><ShieldCheck className="h-3.5 w-3.5" /> verified</span>
                      : pair?.status === "pending" ? <span className="ember-text">pairing… verify the code</span>
                      : "not paired"}
                  </p>
                </div>
                {pair?.status === "verified" ? null : (
                  <button data-testid={`link-pair-${d.id}`} onClick={async () => { const r = await start.mutateAsync({ deviceA: myId, deviceB: d.id }); setPairId(r.id); void utils.link.pair.list.invalidate(); }} className="h-9 rounded-xl border border-border px-3 text-xs font-medium hover:bg-accent">Pair</button>
                )}
                <button onClick={() => revoke.mutate({ id: d.id })} aria-label={`Revoke ${d.name}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      </section>

      {pairId !== null && <PairModal pairId={pairId} myId={myId} userId={userId} onClose={() => { setPairId(null); void utils.link.pair.list.invalidate(); }} />}
    </div>
  );
}

function PairModal({ pairId, myId, onClose }: { pairId: number; myId: number; userId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.link.pair.get.useQuery({ id: pairId }, { refetchInterval: 4000 });
  const confirm = trpc.link.pair.confirm.useMutation();
  const reject = trpc.link.pair.reject.useMutation();
  const [sas, setSas] = useState<string | null>(null);
  useEffect(() => {
    const devs = q.data?.devices;
    if (devs && devs.length === 2) void pairingSas(devs[0].publicKey, devs[1].publicKey).then(setSas).catch(() => {});
  }, [q.data]);
  const verified = q.data?.pairing.status === "verified";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="link-pair-modal">
      <button className="absolute inset-0 bg-black/70" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,380px)] rounded-3xl border border-border bg-card p-6 text-center">
        <p className="obsidian-kicker">Verify this code on both devices</p>
        <p className="my-4 font-mono-ui text-4xl font-bold tracking-[0.3em] ember-text" data-testid="link-sas">{sas ?? "······"}</p>
        {verified ? (
          <p className="flex items-center justify-center gap-2 text-sm text-green-500"><ShieldCheck className="h-5 w-5" /> Devices verified &amp; paired</p>
        ) : (
          <p className="text-xs text-secondary">Only confirm if the same 6 digits appear on your other device. A mismatch means the key exchange was tampered with — reject it.</p>
        )}
        <div className="mt-5 flex gap-2">
          <button data-testid="link-pair-reject" onClick={() => { reject.mutate({ id: pairId }); onClose(); }} className="h-10 flex-1 rounded-xl border border-border text-sm hover:bg-accent"><X className="mx-auto h-4 w-4" /></button>
          <button disabled={verified} data-testid="link-pair-confirm" onClick={async () => { await confirm.mutateAsync({ id: pairId, myDevice: myId }); void utils.link.pair.get.invalidate({ id: pairId }); void utils.link.pair.list.invalidate(); }} className="locat-metal-button h-10 flex-[2] rounded-xl text-sm font-semibold disabled:opacity-50">{verified ? "Verified" : "Codes match — confirm"}</button>
        </div>
      </div>
    </div>
  );
}

function Transfers({ myId, identity }: { myId: number; identity: DeviceIdentity }) {
  const utils = trpc.useUtils();
  const devicesQ = trpc.link.devices.list.useQuery();
  const pairingsQ = trpc.link.pair.list.useQuery();
  const listQ = trpc.link.transfers.list.useQuery(undefined, { refetchInterval: 3000 });
  const create = trpc.link.transfers.create.useMutation();
  const upload = trpc.link.transfers.uploadChunk.useMutation();
  const complete = trpc.link.transfers.complete.useMutation();
  const cancel = trpc.link.transfers.cancel.useMutation();
  const [target, setTarget] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ id: number; pct: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const devices = devicesQ.data ?? [];
  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const verifiedTargets = devices.filter((d) => d.id !== myId && !d.revokedAt && (pairingsQ.data ?? []).some((p) => p.status === "verified" && ((p.deviceA === Math.min(myId, d.id) && p.deviceB === Math.max(myId, d.id)))));
  const transfers = (listQ.data ?? []).filter((t) => t.fromDevice === myId || t.toDevice === myId);

  async function send(file: File) {
    if (!target) return;
    const dev = deviceMap.get(target); if (!dev) return;
    const key = await deviceSharedKey(identity.privateKey, dev.publicKey);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const n = chunkCount(bytes.length);
    const { id } = await create.mutateAsync({ fromDevice: myId, toDevice: target, filename: file.name.slice(0, 255), mime: file.type || "application/octet-stream", size: bytes.length, chunkCount: n });
    cancelRef.current = false;
    setProgress({ id, pct: 0 });
    try {
      for (let s = 0; s < n; s++) {
        if (cancelRef.current) { await cancel.mutateAsync({ id }); break; }
        const { iv, data } = await encryptChunk(key, sliceChunk(bytes, s));
        await upload.mutateAsync({ transferId: id, seq: s, iv, data });
        setProgress({ id, pct: Math.round(((s + 1) / n) * 100) });
      }
    } catch { /* recipient can re-request; left active */ } finally { setProgress(null); void utils.link.transfers.list.invalidate(); }
  }

  async function receive(t: NonNullable<typeof listQ.data>[number]) {
    const sender = deviceMap.get(t.fromDevice); if (!sender) return;
    const key = await deviceSharedKey(identity.privateKey, sender.publicKey);
    setProgress({ id: t.id, pct: 0 });
    try {
      const parts: Uint8Array[] = [];
      for (let s = 0; s < t.chunkCount; s++) {
        const c = await utils.link.transfers.chunk.fetch({ id: t.id, seq: s });
        parts.push(await decryptChunk(key, c.iv, c.data));
        setProgress({ id: t.id, pct: Math.round(((s + 1) / t.chunkCount) * 100) });
      }
      const merged = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let off = 0; for (const p of parts) { merged.set(p, off); off += p.length; }
      await downloadBlob(new Blob([merged as BlobPart], { type: t.mime }), t.filename);
      await complete.mutateAsync({ id: t.id });
    } catch { /* keep chunks for retry */ } finally { setProgress(null); void utils.link.transfers.list.invalidate(); }
  }

  return (
    <div className="locat-fade-up space-y-5">
      <section className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <h2 className="text-sm font-semibold">Send a file</h2>
        <p className="mt-1 text-xs text-secondary">Encrypted on this device, relayed through your Locat server (not direct peer-to-peer), decrypted only on the paired device.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select value={target ?? ""} onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : null)} aria-label="Target device" className="h-10 flex-1 rounded-xl border border-border bg-background/60 px-3 text-sm outline-none" data-testid="link-transfer-target">
            <option value="">Choose a verified device…</option>
            {verifiedTargets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); e.target.value = ""; }} />
          <button disabled={!target || !!progress} onClick={() => fileRef.current?.click()} data-testid="link-transfer-pick" className="locat-metal-button flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"><Upload className="h-4 w-4" /> Pick file</button>
        </div>
        {verifiedTargets.length === 0 && <p className="mt-2 text-xs text-secondary">Pair and verify a device first (Devices tab).</p>}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Transfers</h2>
        <div className="space-y-2" data-testid="link-transfer-list">
          {transfers.length === 0 && <p className="rounded-2xl border border-border/70 bg-card/50 px-4 py-8 text-center text-sm text-secondary">No transfers yet.</p>}
          {transfers.map((t) => {
            const incoming = t.toDevice === myId;
            const other = deviceMap.get(incoming ? t.fromDevice : t.toDevice);
            const pct = progress?.id === t.id ? progress.pct : t.status === "complete" ? 100 : Math.round((t.receivedChunks / t.chunkCount) * 100);
            const canDownload = incoming && (t.status === "active" || t.status === "pending") && t.receivedChunks >= t.chunkCount;
            return (
              <div key={t.id} className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  {incoming ? <Download className="h-4 w-4 ember-text" /> : <Upload className="h-4 w-4 text-secondary" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.filename}</span>
                  <span className="text-[10px] uppercase tracking-wide text-secondary">{t.status}</span>
                </div>
                <p className="mt-0.5 text-xs text-secondary">{incoming ? "from" : "to"} {other?.name ?? "device"} · {(t.size / 1024).toFixed(0)} KB</p>
                {(t.status === "active" || t.status === "pending" || progress?.id === t.id) && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
                )}
                <div className="mt-2 flex gap-2">
                  {canDownload && <button data-testid={`link-download-${t.id}`} disabled={!!progress} onClick={() => void receive(t)} className="h-8 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50">Download</button>}
                  {incoming && !canDownload && (t.status === "active" || t.status === "pending") && <span className="text-xs text-secondary">{t.receivedChunks}/{t.chunkCount} chunks received…</span>}
                  {(t.status === "active" || t.status === "pending") && <button onClick={() => { cancelRef.current = true; cancel.mutate({ id: t.id }); }} className="h-8 rounded-lg border border-border px-3 text-xs text-destructive hover:bg-destructive/10">Cancel</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Clip({ myId, identity }: { myId: number; identity: DeviceIdentity }) {
  const utils = trpc.useUtils();
  const devicesQ = trpc.link.devices.list.useQuery();
  const pairingsQ = trpc.link.pair.list.useQuery();
  const inboxQ = trpc.link.messages.inbox.useQuery({ deviceId: myId }, { refetchInterval: 4000 });
  const push = trpc.link.messages.push.useMutation();
  const ack = trpc.link.messages.ack.useMutation();
  const [target, setTarget] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [received, setReceived] = useState<{ id: number; text: string; kind: string }[]>([]);

  const devices = devicesQ.data ?? [];
  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const verifiedTargets = devices.filter((d) => d.id !== myId && !d.revokedAt && (pairingsQ.data ?? []).some((p) => p.status === "verified" && p.deviceA === Math.min(myId, d.id) && p.deviceB === Math.max(myId, d.id)));

  useEffect(() => {
    let cancelled = false;
    const items = inboxQ.data ?? [];
    const senders = new Map((devicesQ.data ?? []).map((d) => [d.id, d]));
    void (async () => {
      const out: { id: number; text: string; kind: string }[] = [];
      for (const m of items) {
        const sender = senders.get(m.fromDevice);
        if (!sender) continue;
        try {
          const key = await deviceSharedKey(identity.privateKey, sender.publicKey);
          out.push({ id: m.id, text: await decryptText(key, m.iv, m.data), kind: m.kind });
        } catch { /* skip undecryptable */ }
      }
      if (!cancelled) setReceived(out);
    })();
    return () => { cancelled = true; };
  }, [inboxQ.data, devicesQ.data, identity.privateKey]);

  async function sendClip(kind: "clipboard" | "text" | "url") {
    if (!target || !text.trim()) return;
    const dev = deviceMap.get(target); if (!dev) return;
    const key = await deviceSharedKey(identity.privateKey, dev.publicKey);
    const { iv, data } = await encryptText(key, text.trim());
    await push.mutateAsync({ fromDevice: myId, toDevice: target, kind, iv, data });
    setText("");
  }

  return (
    <div className="locat-fade-up space-y-5">
      <section className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <h2 className="text-sm font-semibold">Send to a device</h2>
        <p className="mt-1 text-xs text-secondary">Encrypted clipboard / text / link, delivered to a verified device.</p>
        <select value={target ?? ""} onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : null)} aria-label="Target device" className="mt-3 h-10 w-full rounded-xl border border-border bg-background/60 px-3 text-sm outline-none" data-testid="link-clip-target">
          <option value="">Choose a verified device…</option>
          {verifiedTargets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text or a link…" data-testid="link-clip-input" className="mt-2 min-h-20 w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/50" />
        <div className="mt-2 flex gap-2">
          <button disabled={!target || !text.trim()} onClick={() => void sendClip("clipboard")} data-testid="link-clip-send" className="locat-metal-button flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"><Send className="h-4 w-4" /> Send</button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Received on this device</h2>
        <div className="space-y-2" data-testid="link-clip-inbox">
          {received.length === 0 && <p className="rounded-2xl border border-border/70 bg-card/50 px-4 py-8 text-center text-sm text-secondary">Nothing received yet.</p>}
          {received.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
              <Clipboard className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              <p className="min-w-0 flex-1 break-words text-sm">{r.text}</p>
              <button onClick={() => { void navigator.clipboard?.writeText(r.text); ack.mutate({ ids: [r.id] }, { onSuccess: () => void utils.link.messages.inbox.invalidate({ deviceId: myId }) }); }} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs hover:bg-accent"><Check className="h-3.5 w-3.5" /> Got it</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
