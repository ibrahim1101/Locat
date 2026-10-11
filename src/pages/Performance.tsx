import { AppShell } from "@/components/shell/AppShell";
import { detectPlatform } from "@/lib/platform";
export default function Performance() {
  const runtime = detectPlatform();
  return <AppShell active="performance"><main className="space-y-5 overflow-auto p-6">
    <h1 className="text-2xl font-semibold">Device diagnostics</h1>
    <dl className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
      <div><dt className="text-secondary">Runtime</dt><dd>{runtime}</dd></div>
      <div><dt className="text-secondary">Reported logical processors</dt><dd>{navigator.hardwareConcurrency ?? "Unavailable"}</dd></div>
      <div><dt className="text-secondary">Secure context</dt><dd>{window.isSecureContext ? "Yes" : "No"}</dd></div>
      <div><dt className="text-secondary">WebRTC</dt><dd>{typeof RTCPeerConnection !== "undefined" ? "API present; connection testing required" : "Unavailable"}</dd></div>
      <div><dt className="text-secondary">Media Source Extensions</dt><dd>{typeof MediaSource !== "undefined" ? "Available" : "Unavailable"}</dd></div>
      <div><dt className="text-secondary">Display capture</dt><dd>{typeof navigator.mediaDevices?.getDisplayMedia === "function" ? "API present; permission required" : "Unavailable"}</dd></div>
    </dl><p className="text-sm text-secondary">These values describe API availability, not verified codec, GPU, latency or playback performance. Remote displays negotiated stream statistics inside its client.</p>
  </main></AppShell>;
}
