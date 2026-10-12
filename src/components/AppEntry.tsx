import { useState } from "react";
import { BrowserRouter, HashRouter } from "react-router";
import { isNativeShell, nativeServerUrl } from "@/lib/native";
import { NonServerModeContext } from "@/state/nonServerMode";
import { ConnectionProvider } from "@/state/connection";
import { TRPCProvider } from "@/providers/trpc";
import { AuthProvider } from "@/state/auth";
import { AuthForm } from "@/pages/Login";
import { NativeOfflineHome } from "./NativeOfflineHome";
import { AppLockGate } from "./AppLockGate";
import { ServerConnectionControl } from "./ServerConnectionControl";
import { DownloadStatusHost } from "./DownloadStatusHost";
import App from "@/App";
const ClientRouter = isNativeShell() ? HashRouter : BrowserRouter;
export function AppEntry() {
  const [local, setLocal] = useState(false);
  const enterLocal = () => { if (isNativeShell()) window.location.hash = "/local"; else window.history.replaceState(null, "", "/local"); setLocal(true); };
  return <NonServerModeContext.Provider value={enterLocal}><ConnectionProvider enabled={!local}><AppLockGate>
    {local ? <ClientRouter><NativeOfflineHome onExit={() => setLocal(false)} /><ServerConnectionControl /></ClientRouter> : isNativeShell() && !nativeServerUrl() ? <><AuthForm disabled onLogin={async () => {}} onRegister={async () => {}} onUseLocalMode={enterLocal} /><ServerConnectionControl /></> : <ClientRouter><TRPCProvider><AuthProvider><App /></AuthProvider></TRPCProvider></ClientRouter>}
    <DownloadStatusHost />
  </AppLockGate></ConnectionProvider></NonServerModeContext.Provider>;
}
