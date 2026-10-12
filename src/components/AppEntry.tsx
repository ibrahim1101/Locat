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
  return <NonServerModeContext.Provider value={() => setLocal(true)}><ConnectionProvider enabled={!local}><AppLockGate>
    {local ? <><NativeOfflineHome onExit={() => setLocal(false)} /><ServerConnectionControl /></> : isNativeShell() && !nativeServerUrl() ? <><AuthForm disabled onLogin={async () => {}} onRegister={async () => {}} onUseLocalMode={() => setLocal(true)} /><ServerConnectionControl /></> : <ClientRouter><TRPCProvider><AuthProvider><App /></AuthProvider></TRPCProvider></ClientRouter>}
    <DownloadStatusHost />
  </AppLockGate></ConnectionProvider></NonServerModeContext.Provider>;
}
