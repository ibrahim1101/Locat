import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { isNativeShell, nativeServerUrl } from "@/lib/native";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const MAX_ATTACHMENT_BYTES = 2_900_000;

/** Browse the signed-in user's existing server-authorized media libraries. */
export function ServerMediaPicker({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void; onSelect: (file: File) => void;
}) {
  const utils = trpc.useUtils();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const items = trpc.media.items.useQuery(undefined, { enabled: open, retry: false });
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const visible = useMemo(() => (items.data ?? []).filter(item =>
    (kind === "all" || item.kind === kind) &&
    (item.name + " " + item.library).toLocaleLowerCase().includes(query.toLocaleLowerCase())
  ), [items.data, query, kind]);
  async function attach(item: NonNullable<typeof items.data>[number]) {
    if (busy) return;
    if (item.sizeBytes > MAX_ATTACHMENT_BYTES) {
      setError("Encrypted chat attachments are currently limited to 2.9 MB. Choose a smaller file.");
      return;
    }
    setBusy(item.id); setError("");
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    try {
      const ticket = isNativeShell()
        ? (await utils.media.playbackTicket.fetch({ libraryId: item.libraryId, id: item.id })).ticket
        : null;
      const base = nativeServerUrl();
      const url = new URL(`${base}/api/media/stream?library=${encodeURIComponent(String(item.libraryId))}&id=${encodeURIComponent(item.id)}`, window.location.href);
      if (ticket) url.searchParams.set("ticket", ticket);
      const response = await fetch(url.toString(), { credentials: "include", signal: request.signal });
      if (!response.ok || !response.body) throw new Error("Media download was denied or the device is offline.");
      const lengthHeader = response.headers.get("content-length");
      const declared = lengthHeader === null ? NaN : Number(lengthHeader);
      if (Number.isFinite(declared) && declared > MAX_ATTACHMENT_BYTES) {
        await response.body.cancel(); throw new Error("File exceeds the encrypted attachment size limit.");
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_ATTACHMENT_BYTES) {
          await reader.cancel();
          throw new Error("File exceeds the encrypted attachment size limit.");
        }
        chunks.push(value);
      }
      const blob = new Blob(chunks as BlobPart[], { type: response.headers.get("content-type") ?? "application/octet-stream" });
      if (request.signal.aborted) return;
      onSelect(new File([blob], item.name, { type: blob.type }));
      onClose();
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not attach media."); }
    finally { if (controller.current === request) { controller.current = null; setBusy(""); } }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogTitle>Search & select video, photo or file</DialogTitle>
      <p className="text-xs text-secondary">Browse media explicitly shared with this Locat server. Other devices must first publish an authorized library. Files are sent as encrypted chat attachments, not permanent remote links.</p>
      <input aria-label="Search server media" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or library…" className="w-full rounded-lg border bg-background px-3 py-2" />
      <select aria-label="Media type" value={kind} onChange={e => setKind(e.target.value)} className="rounded-lg border bg-background px-3 py-2"><option value="all">All media</option><option value="cinema">Videos</option><option value="photos">Photos</option><option value="music">Music</option></select>
      {items.isPending && <p role="status">Loading authorized server libraries…</p>}
      {items.isError && <p role="alert">Cannot access the server media index. Check your connection and permissions.</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <ul className="max-h-72 space-y-2 overflow-y-auto">{visible.map(item =>
        <li key={`${item.libraryId}:${item.id}`}><button type="button" disabled={!!busy || item.sizeBytes > MAX_ATTACHMENT_BYTES} onClick={() => void attach(item)} className="w-full rounded-lg border p-3 text-left disabled:opacity-50"><span className="block truncate">{item.name}</span><span className="text-xs text-secondary">{item.library} · {(item.sizeBytes / 1048576).toFixed(2)} MB {item.sizeBytes > MAX_ATTACHMENT_BYTES ? "· Too large for chat" : busy === item.id ? "· Attaching…" : "· Select"}</span></button></li>)}</ul>
      {!items.isPending && !visible.length && <p className="text-sm text-secondary">No authorized matching files.</p>}
    </DialogContent>
  </Dialog>;
}
