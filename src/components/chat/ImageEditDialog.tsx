import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { decodeBrowserImage } from "@/lib/browserImage";
import { sniffImageMime } from "@/lib/crypto";
import { DEFAULT_IMAGE_EDIT, editedImageFile, renderImageEdit, type CropPreset, type ImageEdit } from "@/lib/imageEditing";

export function ImageEditDialog({ file, recipient, onSend, onClose }: {
  file: File; recipient: string; onSend: (file: File) => void; onClose: () => void;
}) {
  const [edit, setEdit] = useState<ImageEdit>({ ...DEFAULT_IMAGE_EDIT });
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const source = useRef<Awaited<ReturnType<typeof decodeBrowserImage>> | null>(null);
  const preview = useRef<HTMLCanvasElement>(null), output = useRef<HTMLCanvasElement | null>(null);
  const mounted = useRef(true), busyRef = useRef(false);
  useEffect(() => {
    let active = true; mounted.current = true;
    void (async () => {
      if (file.size > 20_000_000) throw new Error("Choose a picture smaller than 20 MB.");
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      // Raster formats only: do not load vector documents or external references.
      const heic = String.fromCharCode(...header.slice(4, 12));
      if (!sniffImageMime(header) && !/^ftyp(heic|heix|mif1|heif)$/.test(heic)) throw new Error("Choose a JPEG, PNG, GIF, WebP, AVIF or supported HEIC picture.");
      const decoded = await decodeBrowserImage(file);
      if (!active) { decoded.close(); return; }
      source.current = decoded; setReady(true);
    })().catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not read this picture."); });
    return () => { active = false; mounted.current = false; source.current?.close(); source.current = null; output.current = null; };
  }, [file]);
  useEffect(() => {
    if (!ready || !source.current || !preview.current) return;
    try {
      const image = renderImageEdit(source.current, edit); output.current = image;
      const scale = Math.min(1, 560 / Math.max(image.width, image.height));
      const view = preview.current; view.width = Math.max(1, Math.round(image.width * scale)); view.height = Math.max(1, Math.round(image.height * scale));
      const context = view.getContext("2d"); if (!context) throw new Error("Image preview is unavailable.");
      context.drawImage(image, 0, 0, view.width, view.height);
    } catch (e) { output.current = null; setError(e instanceof Error ? e.message : "Could not preview the edit."); }
  }, [edit, ready]);
  async function send(edited: boolean) {
    if (busyRef.current || !ready) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      if (edited && !output.current) throw new Error("Preview the image before sending.");
      const selected = edited ? await editedImageFile(output.current!, file.name) : file;
      if (!mounted.current) return;
      onSend(selected); onClose();
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Could not prepare this picture."); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Picture for {recipient}</DialogTitle>
      <canvas ref={preview} aria-label="Edited picture preview" className="mx-auto max-h-64 max-w-full rounded-xl border" />
      {!ready && !error && <p role="status">Reading picture…</p>}
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm">Crop preset<select className="min-h-11 rounded-xl border bg-background px-2" disabled={!ready || busy} value={edit.crop} onChange={e => setEdit(v => ({ ...v, crop: e.target.value as CropPreset }))}>
          <option value="original">Original ratio</option><option value="square">Square</option><option value="portrait">Portrait 3:4</option><option value="wide">Wide 16:9</option>
        </select></label>
        <button className="min-h-11 rounded-xl border px-3" disabled={!ready || busy} onClick={() => setEdit(v => ({ ...v, turns: (v.turns + 1) % 4 }))}>Rotate 90°</button>
      </div>
      {([['zoom', 'Zoom', 1, 3], ['x', 'Horizontal position', 0, 1], ['y', 'Vertical position', 0, 1]] as const).map(([key, label, min, max]) => <label key={key} className="grid gap-1 text-sm">{label}
        <input type="range" aria-label={label} min={min} max={max} step="0.01" value={edit[key]} disabled={!ready || busy} onChange={e => setEdit(v => ({ ...v, [key]: Number(e.target.value) }))} className="min-h-11 w-full accent-primary" />
      </label>)}
      <p className="text-xs text-muted-foreground">Edits export a still JPEG, up to 1600 pixels. Animation and transparency are not preserved. The original file stays unchanged. Encryption follows your send choice.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="min-h-11 rounded-xl border px-3" disabled={busy} onClick={() => setEdit({ ...DEFAULT_IMAGE_EDIT })}>Reset edits</button>
        <button className="min-h-11 rounded-xl border px-3" disabled={!ready || busy} onClick={() => void send(false)}>Send original</button>
        <button className="min-h-11 rounded-xl bg-primary px-3 text-primary-foreground disabled:opacity-50" disabled={!ready || busy} onClick={() => void send(true)}>{busy ? "Preparing…" : "Send edited"}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
