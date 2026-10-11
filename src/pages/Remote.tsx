import { AppShell } from "@/components/shell/AppShell";
export default function Remote() {
  return <AppShell active="remote"><main className="flex min-h-0 flex-1 flex-col p-3">
    <h1 className="mb-2 text-xl font-semibold">Locat Remote · experimental</h1>
    <p className="mb-3 text-sm text-secondary">Connect to your separately started Remote host. Viewing depends on this device’s WebRTC support; native capture and control require Windows.</p>
    <iframe title="Locat Remote client" src={`${import.meta.env.BASE_URL}remote-client/index.html`} sandbox="allow-scripts allow-same-origin" allow="display-capture; autoplay" className="min-h-[560px] w-full flex-1 rounded-xl border" />
  </main></AppShell>;
}
