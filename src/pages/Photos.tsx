import { useState } from "react";
import { isNativeShell, nativeServerUrl } from "@/lib/native";
import { AppShell, ModuleHeader } from "@/components/shell/AppShell";
import { LocalPhotoEditor } from "@/components/media/LocalPhotoEditor";
import { DeviceMediaLibrary } from "@/components/media/DeviceMediaLibrary";
import { trpc } from "@/providers/trpc";
import { useServerConnection } from "@/state/connection";
import { useAuth } from "@/state/auth";

export default function Photos() {
  const connected = useServerConnection();
  const { state } = useAuth();
  const hosted = trpc.media.items.useQuery(undefined, { enabled: connected && state.status === "ready", retry: false });
  const photos = (hosted.data ?? []).filter(item => item.kind === "photos");
  const [selected, setSelected] = useState<{ id: string; libraryId: number; name: string } | null>(null);
  const ticket = trpc.media.playbackTicket.useQuery({ libraryId: selected?.libraryId ?? 0, id: selected?.id ?? "" }, { enabled: connected && state.status === "ready" && !!selected && isNativeShell(), retry: false });
  const canPreview = selected && (!isNativeShell() || ticket.data);
  const photoUrl = selected ? `${nativeServerUrl()}/api/media/stream?library=${selected.libraryId}&id=${encodeURIComponent(selected.id)}${isNativeShell() && ticket.data ? `&ticket=${encodeURIComponent(ticket.data.ticket)}` : ""}` : "";
  return <AppShell active="photos">
    <ModuleHeader title="Photos" tagline="Browse device photos and authorized server libraries" />
    <main className="flex-1 space-y-5 overflow-y-auto p-4">
      <DeviceMediaLibrary kind="photos" />
      <section className="rounded-2xl border border-border bg-card/80 p-4" aria-label="Server photos">
        <h2 className="font-semibold">Server photo library</h2>
        <p className="mt-1 text-xs text-secondary">Only media from folders explicitly shared by the server administrator appears here.</p>
        {selected && <div className="my-4 rounded-xl border border-primary/30 p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{selected.name}</p><button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-3 py-1 text-xs">Close</button></div>{ticket.isError && isNativeShell() ? <p role="alert" className="text-sm text-destructive">Photo authorization failed.</p> : canPreview ? <img key={photoUrl} src={photoUrl} alt={selected.name} className="max-h-[65vh] w-full rounded-lg object-contain" /> : <p role="status" className="text-sm text-secondary">Authorizing photo preview…</p>}</div>}
        {!connected ? <p className="mt-3 text-sm text-secondary">Connect to your Locat server to browse shared photos.</p> : hosted.isLoading ? <p role="status" className="mt-3 text-sm">Loading shared photos…</p> : hosted.isError ? <p role="status" className="mt-3 text-sm text-secondary">Unable to load the server photo library.</p> : photos.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{photos.map(item => <li key={`${item.libraryId}:${item.id}`} className="min-w-0 rounded-xl border border-border p-3"><button type="button" onClick={() => setSelected({ id: item.id, libraryId: item.libraryId, name: item.name })} className="w-full truncate text-left text-sm font-medium underline-offset-2 hover:underline" title={`Preview ${item.name}`}>{item.name}</button><p className="truncate text-xs text-secondary">{item.library} · {(item.sizeBytes / 1048576).toFixed(1)} MB</p></li>)}</ul> : <p className="mt-3 text-sm text-secondary">No shared photos found.</p>}
      </section>
      <LocalPhotoEditor />
    </main>
  </AppShell>;
}
