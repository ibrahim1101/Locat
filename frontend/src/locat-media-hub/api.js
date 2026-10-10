/** Locat Media Hub — dev preview API client.
 *  Mirrors @locat/media-ui `LocatMediaHubProps.apiBaseUrl`. */
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_ROOT = `${BACKEND_URL}/api/media`;

async function j(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  const ctype = res.headers.get("content-type") || "";
  return ctype.includes("application/json") ? res.json() : res.text();
}

export const api = {
  health: () => j(`${API_ROOT}/health`),
  config: () => j(`${API_ROOT}/config`),
  capabilityMatrix: () => j(`${API_ROOT}/capabilities/matrix`),

  libraries: () => j(`${API_ROOT}/libraries`),
  createLibrary: (body) => j(`${API_ROOT}/libraries`, { method: "POST", body: JSON.stringify(body) }),
  scanLibrary: (id) => j(`${API_ROOT}/libraries/${id}/scan`, { method: "POST" }),
  deleteLibrary: (id) => j(`${API_ROOT}/libraries/${id}`, { method: "DELETE" }),

  items: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== ""),
    ).toString();
    return j(`${API_ROOT}/items${qs ? `?${qs}` : ""}`);
  },
  item: (id) => j(`${API_ROOT}/items/${id}`),
  decision: (id, caps) =>
    j(`${API_ROOT}/items/${id}/playback-decision`, { method: "POST", body: JSON.stringify(caps || {}) }),
  diagnostics: (id, sessionId) =>
    j(`${API_ROOT}/items/${id}/diagnostics${sessionId ? `?session_id=${sessionId}` : ""}`),
  saveProgress: (id, seconds) =>
    j(`${API_ROOT}/items/${id}/progress?position_seconds=${seconds}`, { method: "POST" }),
  streamUrl: (id, sessionId) =>
    `${API_ROOT}/items/${id}/stream${sessionId ? `?session_id=${sessionId}` : ""}`,

  tracks: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== ""),
    ).toString();
    return j(`${API_ROOT}/music/tracks${qs ? `?${qs}` : ""}`);
  },
  trackStreamUrl: (id) => `${API_ROOT}/music/tracks/${id}/stream`,
  albums: () => j(`${API_ROOT}/music/albums`),
  artists: () => j(`${API_ROOT}/music/artists`),
  favoriteTrack: (id, value) =>
    j(`${API_ROOT}/music/tracks/${id}/favorite?value=${value ? "true" : "false"}`, { method: "POST" }),

  getAudioMode: (deviceId = "web-preview") =>
    j(`${API_ROOT}/music/audio-mode?device_id=${encodeURIComponent(deviceId)}&runtime=web`),
  setAudioMode: (mode, deviceId = "web-preview") =>
    j(`${API_ROOT}/music/audio-mode`, { method: "POST", body: JSON.stringify({ mode, device_id: deviceId }) }),

  eqPresets: () => j(`${API_ROOT}/music/eq/presets`),
  saveEqPreset: (preset) =>
    j(`${API_ROOT}/music/eq/presets`, { method: "POST", body: JSON.stringify(preset) }),
  deleteEqPreset: (id) => j(`${API_ROOT}/music/eq/presets/${id}`, { method: "DELETE" }),

  playlists: () => j(`${API_ROOT}/music/playlists`),
  savePlaylist: (p) => j(`${API_ROOT}/music/playlists`, { method: "POST", body: JSON.stringify(p) }),

  devices: () => j(`${API_ROOT}/devices`),
};

export function formatBytes(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function formatBps(n) {
  if (!n) return "—";
  return `${(n / 1e6).toFixed(2)} Mbps`;
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
