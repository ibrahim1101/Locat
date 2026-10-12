import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";

type Peer = { id: number; name: string };
type MediaKind = "cinema" | "music" | "photos";
const kinds: Record<string, MediaKind> = {
  mp4: "cinema", m4v: "cinema", mov: "cinema", mkv: "cinema", webm: "cinema", avi: "cinema",
  mp3: "music", m4a: "music", aac: "music", flac: "music", wav: "music", ogg: "music", opus: "music",
  jpg: "photos", jpeg: "photos", png: "photos", webp: "photos", gif: "photos", bmp: "photos", avif: "photos", heic: "photos", heif: "photos",
};

/** Folder permission stays local: only the chosen library's name and media counts leave this device. */
export function DeviceLibrarySharing({ proof, peers }: { proof: string; peers: Peer[] }) {
  const publish = trpc.link.mediaDiscovery.publish.useMutation();
  const unpublish = trpc.link.mediaDiscovery.unpublish.useMutation();
  const [libraryName, setLibraryName] = useState("");
  const [counts, setCounts] = useState<Record<MediaKind, number>>({ cinema: 0, music: 0, photos: 0 });
  const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState("");
  const [peerId, setPeerId] = useState<number | null>(null);
  useEffect(() => { if (peerId !== null && !peers.some(peer => peer.id === peerId)) setPeerId(null); }, [peerId, peers]);
  const discovery = trpc.link.mediaDiscovery.discover.useQuery({ proof, deviceId: peerId ?? 0 }, { enabled: !!peerId, retry: false });
  const selected = Object.entries(counts).filter(([, count]) => count > 0).map(([kind, count]) => ({
    id: `folder-${kind}`, name: libraryName, kind: kind as MediaKind, count,
  }));
  async function share() {
    if (!selected.length || !libraryName || unpublish.isPending) return;
    try {
      await publish.mutateAsync({ proof, libraries: selected });
      setEnabled(true);
      setNotice("Library summary shared for five minutes. Refresh to keep it discoverable.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not publish library."); }
  }
  async function stop() {
    try { await unpublish.mutateAsync({ proof }); setEnabled(false); setNotice("Library sharing stopped."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not stop sharing."); }
  }
  return <section className="space-y-3 rounded-2xl border border-border bg-card/60 p-4" aria-label="Device library sharing">
    <h2 className="font-semibold">Share device library discovery</h2>
    <p className="text-xs text-secondary">Choose a folder to publish its name and supported media counts to your verified paired devices. No file names, paths, or contents are uploaded. Discovery expires after five minutes; remote file access is not yet available.</p>
    <input aria-label="Choose library folder for discovery" type="file" multiple {...{ webkitdirectory: "", directory: "" }}
      disabled={publish.isPending || unpublish.isPending}
      onChange={event => {
        const files = Array.from(event.target.files ?? []);
        // Withdraw the old publication before accepting another folder. Do not
        // silently leave the previously authorized folder discoverable.
        if (enabled) {
          setNotice("Withdrawing previous library summary…");
          void unpublish.mutateAsync({ proof }).then(() => {
            setEnabled(false);
            setNotice("Previous sharing stopped. Choose the new folder again to publish it.");
          }).catch(() => setNotice("Could not withdraw the previous library. Use Stop sharing and retry."));
          event.target.value = "";
          return;
        }
        const next = { cinema: 0, music: 0, photos: 0 };
        for (const file of files) { const kind = kinds[file.name.split(".").pop()?.toLowerCase() ?? ""]; if (kind) next[kind]++; }
        setCounts(next);
        setLibraryName(files[0]?.webkitRelativePath.split("/")[0]?.slice(0, 120) || "Selected folder");
        setEnabled(false);
        setNotice(files.length ? "Review and explicitly publish this library summary." : "");
        event.target.value = "";
      }} />
    <p className="text-xs text-secondary">{libraryName || "No folder selected"} · {counts.cinema} videos · {counts.music} audio · {counts.photos} photos</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!selected.length || publish.isPending || unpublish.isPending} onClick={() => void share()} className="rounded-lg border px-3 py-2 text-sm">{enabled ? "Refresh sharing" : "Publish library summary"}</button>
      <button type="button" disabled={unpublish.isPending} onClick={() => void stop()} className="rounded-lg border px-3 py-2 text-sm">Stop sharing</button>
    </div>
    {notice && <p role="status" className="text-xs text-secondary">{notice}</p>}
    <h3 className="text-sm font-semibold">Discover paired libraries</h3>
    <select aria-label="Paired device libraries" className="w-full rounded-lg border bg-background p-2" value={peerId ?? ""} onChange={event => setPeerId(event.target.value ? Number(event.target.value) : null)}>
      <option value="">Select verified paired device</option>
      {peers.map(peer => <option key={peer.id} value={peer.id}>{peer.name}</option>)}
    </select>
    {discovery.isFetching && <p role="status" className="text-xs">Loading shared libraries…</p>}
    {discovery.isError && <p role="alert" className="text-xs text-destructive">Unable to discover this device's libraries.</p>}
    {discovery.data && <ul className="space-y-1 text-sm">{discovery.data.libraries.map(item => <li key={item.id} className="rounded-lg border p-2">{item.name} · {item.kind} · {item.count} files</li>)}{!discovery.data.libraries.length && <li className="text-secondary">No active shared libraries.</li>}</ul>}
    {peerId && <button type="button" onClick={() => void discovery.refetch()} className="rounded-lg border px-3 py-2 text-sm">Refresh discovery</button>}
  </section>;
}
