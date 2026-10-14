import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deviceMediaBridge, folderMedia, groupMedia, readLibraryPhoto, sortMedia, supportsMedia, type DeviceMedia, type MediaAccess, type MediaKind, type MediaSort } from "@/lib/deviceMedia";
import { LocalCinemaPlayer } from "./LocalCinemaPlayer";
import { MusicEqualizer } from "./MusicEqualizer";

export function DeviceMediaLibrary({ kind, onPhoto }: { kind: MediaKind; onPhoto?: (file: File) => void }) {
  const bridge = useMemo(deviceMediaBridge, []);
  const [rows, setRows] = useState<DeviceMedia[]>([]), [access, setAccess] = useState<MediaAccess>("denied");
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [grouping, setGrouping] = useState<"folder" | "album" | "artist">("folder"), [sort, setSort] = useState<MediaSort>("name"), [search, setSearch] = useState("");
  const [autoplay, setAutoplay] = useState(false);
  const [active, setActive] = useState<DeviceMedia | null>(null), [source, setSource] = useState("");
  const lease = useRef(0), photoRequest = useRef<AbortController | null>(null), blobUrl = useRef("");
  const activeRef = useRef<DeviceMedia | null>(null);
  const close = useCallback(() => { photoRequest.current?.abort(); if (blobUrl.current) URL.revokeObjectURL(blobUrl.current); blobUrl.current = ""; activeRef.current = null; setActive(null); setSource(""); }, []);
  const scan = useCallback(async (ask: boolean, preservePlayback = false) => {
    if (!bridge) return;
    const ticket = ++lease.current;
    // A new scan supersedes any in-flight photo read; otherwise an older
    // photo selection could still complete after permissions or files change.
    photoRequest.current?.abort();
    if (!preservePlayback) { close(); setRows([]); }
    setBusy(true); setNotice("");
    try {
      const permission = await (ask ? bridge.plugin.authorize({ kind }) : bridge.plugin.status({ kind }));
      if (ticket !== lease.current) return; setAccess(permission.access);
      if (permission.access === "denied") { close(); setRows([]); setNotice("Allow media access to show this device’s library. You can also open files manually."); return; }
      let before = ""; const collected = new Map<string, DeviceMedia>();
      do {
        const page = await bridge.plugin.list({ kind, before });
        if (ticket !== lease.current) return;
        setAccess(page.access);
        if (page.access === "denied") { close(); setRows([]); setNotice("Media access was revoked. Allow access to refresh your library."); return; }
        for (const row of page.items) if (supportsMedia(row, kind)) collected.set(row.id, row);
        if (page.next && page.next === before) throw new Error("Library cursor did not advance. Try refreshing.");
        before = page.next;
        // Metadata-only pages; bounded UI display below. No movie/music bytes loaded here.
      } while (before);
      if (ticket === lease.current) {
        const current = activeRef.current;
        if (current && !collected.has(current.id)) close();
        setRows([...collected.values()]);
        setNotice(collected.size ? "" : "No supported indexed media is available with this permission.");
      }
    } catch (error) { if (ticket === lease.current) { if (!preservePlayback) setRows([]); setNotice(error instanceof Error ? error.message : "Could not read library."); } }
    finally { if (ticket === lease.current) setBusy(false); }
  }, [bridge, close, kind]);
  useEffect(() => { void scan(false); return () => {
    // Invalidate the latest asynchronous scan, including scans started by refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    lease.current++; photoRequest.current?.abort(); if (blobUrl.current) URL.revokeObjectURL(blobUrl.current); }; }, [scan]);
  useEffect(() => { if (!bridge) return; const refresh = () => { if (document.visibilityState === "visible") void scan(false, true); }; document.addEventListener("visibilitychange", refresh); return () => document.removeEventListener("visibilitychange", refresh); }, [bridge, scan]);
  const activeFile = useMemo(() => active ? { name: active.name, size: active.size, lastModified: active.modified } : null, [active]);
  const groups = groupMedia(sortMedia(rows.filter(row => `${row.name} ${row.folder} ${row.album ?? ""} ${row.artist ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), sort), grouping);
  const [expanded, setExpanded] = useState(""); const [page, setPage] = useState(0);
  const chosen = groups.find(([name]) => name === expanded)?.[1] ?? [];
  const open = async (row: DeviceMedia, play = false) => {
    close(); setNotice("");
    const url = row.file ? URL.createObjectURL(row.file) : bridge?.source(row.uri);
    if (!url) { setNotice("Native media access unavailable."); return; }
    if (row.file) blobUrl.current = url;
    if (kind !== "photos") { activeRef.current = row; setActive(row); setSource(url); setAutoplay(play); return; }
    const controller = new AbortController(); photoRequest.current = controller;
    const selectionLease = lease.current;
    try {
      const file = await readLibraryPhoto(row, url, controller.signal);
      if (!controller.signal.aborted && photoRequest.current === controller && selectionLease === lease.current) onPhoto?.(file);
    } catch (error) {
      if (!controller.signal.aborted && photoRequest.current === controller && selectionLease === lease.current) setNotice(error instanceof Error ? error.message : "Could not open photo.");
    }
    finally { if (photoRequest.current === controller) { photoRequest.current = null; if (blobUrl.current) URL.revokeObjectURL(blobUrl.current); blobUrl.current = ""; } }
  };
  return <section aria-label="Device media library" className="my-4 space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Device {kind === "cinema" ? "videos" : kind === "music" ? "music" : "photos"}</h2>
    <p className="text-xs text-secondary">{bridge ? `Device-indexed media · ${access === "full" ? "Full access" : access === "limited" ? "Selected photos/videos only" : "Permission needed"}. Folder names follow Android’s media index.` : "Choose a device folder to browse its supported files, grouped by their original folders. Browser/desktop access requires a folder selection each session."} Files stay on this device. Playback depends on installed codecs.</p>
    {bridge ? <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void scan(true)} className="min-h-11 rounded-xl border px-3">{access === "denied" ? "Allow media access" : "Change media access"}</button><button type="button" disabled={busy} onClick={() => void scan(false)} className="min-h-11 rounded-xl border px-3">Refresh library</button></div> : <input aria-label="Choose media folder" type="file" multiple {...{ webkitdirectory: "", directory: "" }} onChange={event => { close(); setRows(folderMedia([...(event.target.files ?? [])], kind)); setExpanded(""); setPage(0); event.target.value = ""; }} />}
    {busy && <p role="status">Reading device library…</p>}{notice && <p role="status" className="text-sm text-secondary">{notice}</p>}
    <div className="flex flex-wrap gap-3"><label>Group by <select aria-label="Media grouping" value={grouping} onChange={event => { setGrouping(event.target.value as typeof grouping); setExpanded(""); setPage(0); }} className="min-h-11 rounded-xl border bg-background px-2"><option value="folder">Folders</option>{kind === "music" && bridge && <><option value="album">Albums</option><option value="artist">Artists</option></>}</select></label><label>Sort <select aria-label="Media sorting" value={sort} onChange={event => { setSort(event.target.value as MediaSort); setPage(0); }} className="min-h-11 rounded-xl border bg-background px-2"><option value="name">Name A–Z</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="size">Largest first</option>{kind !== "photos" && bridge && <option value="duration">Longest first</option>}</select></label><input aria-label="Search device media" placeholder="Search names, folders, albums…" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} className="min-h-11 rounded-xl border bg-background px-3" /></div>
    <p className="text-xs text-secondary">{rows.length} supported files · {groups.length} groups</p>
    <div className="grid max-h-64 gap-2 overflow-auto sm:grid-cols-3">{groups.map(([name, items]) => <button type="button" aria-pressed={expanded === name} key={name} onClick={() => { setExpanded(name); setPage(0); }} className="min-h-16 break-words rounded-xl border p-3 text-left"><span className="block text-sm">{name}</span><span className="text-xs text-secondary">{items.length} files</span></button>)}</div>
    {expanded && chosen.length > 0 && <div><h3 className="break-words font-semibold">{expanded}</h3><ul className="max-h-80 overflow-auto">{chosen.slice(page * 60, page * 60 + 60).map(row => <li key={row.id}><button type="button" onClick={() => void open(row)} className="min-h-14 w-full rounded-xl border p-3 text-left"><MediaThumbnail row={row} kind={kind} /><span className="block truncate">{row.name}</span><span className="text-xs text-secondary">{(row.size / 1_000_000).toFixed(1)} MB · {row.modified ? new Date(row.modified).toLocaleDateString() : "Date unavailable"}{row.artist ? ` · ${row.artist}` : ""}</span></button></li>)}</ul><div className="flex gap-3"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous page</button><span>{page + 1} / {Math.max(1, Math.ceil(chosen.length / 60))}</span><button type="button" disabled={(page + 1) * 60 >= chosen.length} onClick={() => setPage(value => value + 1)}>Next page</button></div></div>}
    {active && source && <div className="space-y-2"><h3 className="truncate">{active.name}</h3>{kind === "music" ? <MusicEqualizer key={source} src={source} autoplay={autoplay} onEnded={() => { const index = chosen.findIndex(row => row.id === active.id); if (index >= 0 && index + 1 < chosen.length) void open(chosen[index + 1], true); }} /> : <LocalCinemaPlayer key={source} src={source} file={activeFile!} onEnded={() => {}} />}<button type="button" onClick={close} className="min-h-11 rounded-xl border px-3">Close library media</button></div>}
  </section>;
}

function MediaThumbnail({ row, kind }: { row: DeviceMedia; kind: MediaKind }) {
  const ref = useRef<HTMLSpanElement>(null), [image, setImage] = useState("");
  useEffect(() => {
    if (kind === "music" || !ref.current) return;
    let active = true, started = false, local = "";
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || started) return;
      started = true; observer.disconnect();
      if (row.file && row.size <= 20_000_000 && kind === "photos") { local = URL.createObjectURL(row.file); setImage(local); }
      else { const bridge = deviceMediaBridge(); if (bridge) void bridge.plugin.thumbnail({ kind, id: row.id }).then(result => { if (active) setImage(result.data); }).catch(() => {}); }
    });
    observer.observe(ref.current);
    return () => { active = false; observer.disconnect(); if (local) URL.revokeObjectURL(local); };
  }, [row, kind]);
  return <span ref={ref} className="float-left mr-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-background">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">{kind === "photos" ? "▧" : kind === "music" ? "♫" : "▶"}</span>}</span>;
}
