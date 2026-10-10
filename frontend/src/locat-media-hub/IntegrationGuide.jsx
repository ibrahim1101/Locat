import React from "react";
import { PlugZap, FileCode2, GitBranch, Shield } from "lucide-react";

const adapters = [
  {
    name: "AuthAdapter",
    file: "packages/locat-media-adapters/src/locat_media_adapters/auth.py",
    purpose: "Hand off to Locat's existing identity + session system. Media module does not create any new user accounts.",
    api: [
      "verify(authorization_header) -> UserContext | None",
    ],
  },
  {
    name: "StorageAdapter",
    file: "packages/locat-media-adapters/src/locat_media_adapters/storage.py",
    purpose: "Enforces canonical-path guards and the set of library roots the user has authorized on their Windows host.",
    api: [
      "authorized_roots()", "is_authorized_path(path)",
      "canonicalize(path)", "iter_files(root, extensions)",
    ],
  },
  {
    name: "DevicePairingAdapter",
    file: "packages/locat-media-adapters/src/locat_media_adapters/device.py",
    purpose: "Reuses Locat's device pairing / trust model. Media never exposes libraries to untrusted devices.",
    api: ["list_devices(user_id)", "is_trusted(user_id, device_id)"],
  },
  {
    name: "HostAdapter",
    file: "packages/locat-media-adapters/src/locat_media_adapters/host.py",
    purpose: "Native capability bridge. Windows adapter owns WASAPI exclusive output + NVENC. Android adapter owns MediaCodec + AAudio.",
    api: [
      "runtime_name", "start_services()", "stop_services()",
      "native_decoder_matrix()", "native_audio_capabilities()",
    ],
  },
];

const endpoints = [
  "GET  /api/media/health",
  "GET  /api/media/config",
  "GET  /api/media/capabilities/matrix",
  "GET|POST|DELETE /api/media/libraries[/{id}][/scan]",
  "GET  /api/media/items[?library_id&media_type&q]",
  "GET  /api/media/items/{id}",
  "POST /api/media/items/{id}/playback-decision",
  "GET|HEAD /api/media/items/{id}/stream  (HTTP 206 + Range)",
  "GET  /api/media/items/{id}/diagnostics",
  "POST /api/media/items/{id}/progress",
  "GET  /api/media/music/{tracks,albums,artists,playlists}",
  "GET|POST|DELETE /api/media/music/eq/presets",
  "GET|POST /api/media/music/audio-mode",
  "POST /api/media/music/audio-mode/report-verified   // native adapters only",
  "GET  /api/media/devices",
];

export default function IntegrationGuide() {
  return (
    <div className="space-y-10" data-testid="integration-page">
      <header>
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">integration</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
          How this drops into Locat 2.0
        </h1>
        <p className="text-zinc-400 text-sm mt-3 max-w-2xl leading-relaxed">
          Locat Media Hub ships as a monorepo of packages. The parent Locat application wires
          its own authentication, storage, and device pairing into the adapters, then mounts
          the FastAPI router under <code className="text-zinc-200">/api/media</code> behind the
          <code className="text-zinc-200"> LOCAT_MEDIA_ENABLED</code> feature flag.
        </p>
      </header>

      <section className="locat-glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-white font-display text-lg">
          <GitBranch size={16} className="text-sky-300" /> Monorepo layout
        </div>
        <pre className="mt-4 text-xs font-mono text-zinc-300 bg-black/40 rounded-md p-4 border border-white/[0.06] overflow-x-auto">
{`packages/
├── locat-media-core/        # shared pydantic + persistence contract
├── locat-media-adapters/    # Auth, Storage, Device, Host (mocks here)
├── locat-cinema/            # ffprobe indexer, Direct Play decider, HTTP range streamer
├── locat-music/             # mutagen indexer, dual audio-mode service, EQ seeds
├── locat-media-server/      # FastAPI router factory + diagnostics registry
└── locat-media-ui/          # React component contracts (TypeScript)`}
        </pre>
      </section>

      <section>
        <div className="flex items-center gap-2 text-white font-display text-lg mb-4">
          <PlugZap size={16} className="text-emerald-300" /> Adapters to wire
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {adapters.map((a) => (
            <div key={a.name} className="locat-glass rounded-xl p-5" data-testid={`adapter-${a.name}`}>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-emerald-400" />
                <div className="font-display text-sm font-semibold text-white">{a.name}</div>
              </div>
              <div className="text-[11px] font-mono text-zinc-500 mt-1 truncate">{a.file}</div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">{a.purpose}</p>
              <ul className="mt-3 space-y-1">
                {a.api.map((line) => (
                  <li key={line} className="font-mono text-[11px] text-zinc-300">· {line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="locat-glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-white font-display text-lg">
          <FileCode2 size={16} className="text-sky-300" /> HTTP API surface
        </div>
        <pre className="mt-4 text-xs font-mono text-zinc-300 bg-black/40 rounded-md p-4 border border-white/[0.06] overflow-x-auto">
{endpoints.join("\n")}
        </pre>
      </section>

      <section className="locat-glass rounded-2xl p-6">
        <div className="font-display text-lg text-white">Mount into Locat's FastAPI host</div>
        <pre className="mt-4 text-xs font-mono text-zinc-300 bg-black/40 rounded-md p-4 border border-white/[0.06] overflow-x-auto">
{`from locat_media_core.persistence import MongoMediaPersistence
from locat_media_adapters import (
    MockLocalStorageAdapter, MockDevicePairingAdapter, MockLocatAuthAdapter,
    MockWindowsHostAdapter,
)
from locat_media_server import create_media_router, MediaServerSettings

settings = MediaServerSettings.from_env()        # LOCAT_MEDIA_ENABLED flag
persistence = MongoMediaPersistence(locat_db)    # or any MediaPersistence impl
router = create_media_router(
    persistence=persistence,
    auth=LocatRealAuthAdapter(...),              # swap mock for Locat's real auth
    storage=LocatWindowsStorageAdapter(...),     # swap mock for Windows ACL-aware impl
    device_pairing=LocatDevicePairingAdapter(),  # Locat's device-trust system
    host=LocatWindowsHostAdapter(),              # WASAPI exclusive, NVENC, MediaCodec
    settings=settings,
)
app.include_router(router)`}
        </pre>
      </section>

      <section className="locat-glass rounded-2xl p-6">
        <div className="font-display text-lg text-white">What is STILL mocked / what needs native work</div>
        <ul className="mt-4 space-y-2 text-sm text-zinc-300 leading-relaxed">
          <li>• <span className="text-amber-300">Native WASAPI exclusive output</span> for verified bit-perfect Pure Audio on Windows.</li>
          <li>• <span className="text-amber-300">Android MediaCodec + AAudio</span> playback adapter for HEVC, DTS, lossless passthrough.</li>
          <li>• <span className="text-amber-300">NVENC / NVDEC hardware transcoding</span> for 4K remux fallback on RTX-class hardware.</li>
          <li>• <span className="text-amber-300">Dolby Vision / HDR tone mapping</span> — currently detection only; no server tone mapper yet.</li>
          <li>• <span className="text-amber-300">Advanced subtitle rendering</span> for PGS/ASS beyond the browser's native support.</li>
          <li>• <span className="text-amber-300">Real device-trust gating</span> — the mock adapter trusts everything.</li>
        </ul>
      </section>
    </div>
  );
}
