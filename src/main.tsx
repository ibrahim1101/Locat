import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { TRPCProvider } from "./providers/trpc";
import { AuthProvider } from "./state/auth";
import App from "./App";
import "./index.css";
import { startAppearance } from "./lib/appearance";

const stopAppearance = startAppearance();
if (import.meta.hot) import.meta.hot.dispose(stopAppearance);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider><AuthProvider><App /></AuthProvider></TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(console.error);
  });
}
const resize = () => document.documentElement.style.setProperty("--app-height", `${window.visualViewport?.height ?? window.innerHeight}px`);
resize();
window.visualViewport?.addEventListener("resize", resize);
window.addEventListener("resize", resize);
