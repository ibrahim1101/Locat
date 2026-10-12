import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { nativeServerUrl } from "@/lib/native";
const ConnectionContext = createContext(false);
export function ConnectionProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let running = false;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        if (!nativeServerUrl() || !navigator.onLine) throw new Error("Offline");
        const response = await fetch(`${nativeServerUrl()}/api/ready`, { credentials: "omit", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8000) });
        const health = response.status === 200 ? await response.json() : null;
        if (active) setConnected(health?.app === "Locat" && health?.status === "ready");
      } catch { if (active) setConnected(false); }
      finally { running = false; }
    };
    const offline = () => setConnected(false);
    void check();
    const interval = window.setInterval(() => void check(), 15000);
    window.addEventListener("online", check);
    window.addEventListener("offline", offline);
    return () => { active = false; clearInterval(interval); window.removeEventListener("online", check); window.removeEventListener("offline", offline); };
  }, [enabled]);
  return <ConnectionContext.Provider value={enabled && connected}>{children}</ConnectionContext.Provider>;
}
export const useServerConnection = () => useContext(ConnectionContext);
