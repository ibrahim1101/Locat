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
  return <AppShell active="photos">
    <ModuleHeader title="Photos" tagline="Browse device photos and authorized server libraries" />
    <main className="flex-1 space-y-5 overflow-y-auto p-4">
      <DeviceMediaLibrary kind="photos" />
      <section className="rounded-2xl border border-border bg-card/80 p-4" aria-label="Server photos">
        <h2 className="font-semibold">Server photo library</h2>
        <p className="mt-1 text-xs text-secondary">Only media from folders explicitly shared by the server administrator appears here.</p>
        {!connected ? <p className="mt-3 text-sm text-secondary">Connect to your Locat server to browse shared photos.</p> : hosted.isLoading ? <p role="status" className="mt-3 text-sm">Loading shared photos…</p> : hosted.isError ? <p role="status" className="mt-3 text-sm text-secondary">Unable to load the server photo library.</p> : photos.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{photos.map(item => <li key={`${item.libraryId}:${item.id}`} className="min-w-0 rounded-xl border border-border p-3"><p className="truncate text-sm font-medium" title={item.name}>{item.name}</p><p className="truncate text-xs text-secondary">{item.library} · {(item.sizeBytes / 1048576).toFixed(1)} MB</p></li>)}</ul> : <p className="mt-3 text-sm text-secondary">No shared photos found.</p>}
      </section>
      <LocalPhotoEditor />
    </main>
  </AppShell>;
}
