import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { TRPCProvider } from "./providers/trpc";
import { AuthProvider } from "./state/auth";
import App from "./App";
import { DownloadStatusHost } from "./components/DownloadStatusHost";
import "./index.css";
import { startAppearance } from "./lib/appearance";
import { isNativeShell, nativeServerUrl } from "./lib/native";
import { NativeServerSetup } from "./components/NativeServerSetup";
import { NativeOfflineHome } from "./components/NativeOfflineHome";
import { AppLockGate } from "./components/AppLockGate";

if (isNativeShell()) document.documentElement.classList.add("locat-native");

const stopAppearance = startAppearance();
if (import.meta.hot) import.meta.hot.dispose(stopAppearance);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isNativeShell() && !nativeServerUrl() ? (
      <AppLockGate><><NativeOfflineHome /><DownloadStatusHost /></></AppLockGate>
    ) : (
      <BrowserRouter>
        <TRPCProvider><AuthProvider><AppLockGate><><App /><DownloadStatusHost /></></AppLockGate></AuthProvider></TRPCProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);

if (import.meta.env.PROD && !isNativeShell() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(console.error);
  });
}
const resize = () => document.documentElement.style.setProperty("--app-height", `${window.visualViewport?.height ?? window.innerHeight}px`);
resize();
window.visualViewport?.addEventListener("resize", resize);
window.addEventListener("resize", resize);
