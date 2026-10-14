import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { isNativeShell } from "@/lib/native";
import { detectPlatform } from "@/lib/platform";

/**
 * Native shell Back navigation: first let overlays consume Back, then navigate
 * within Locat. The dashboard is the safe root; it never unexpectedly exits.
 * The native wrapper should dispatch a cancelable 'locat:back' event for the
 * Android system Back callback (including gesture navigation).
 */
export function NativeBackNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const previous = useRef<string[]>([]);
  const current = location.pathname + location.search;
  const currentRef = useRef(current);
  currentRef.current = current;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    if (!isNativeShell()) return;
    const stack = previous.current;
    if (stack[stack.length - 1] !== current) {
      const existing = stack.lastIndexOf(current);
      if (existing >= 0) stack.splice(existing + 1);
      else stack.push(current);
    }
  }, [current]);

  useEffect(() => {
    if (!isNativeShell()) return;
    const back = (event: Event) => {
      // Dialogs take priority over text fields inside them.
      const overlay = document.querySelector<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
      if (overlay) {
        overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLElement && (
        active.matches("input, textarea, select, [contenteditable='true']") ||
        active.getAttribute("role") === "textbox"
      )) {
        active.blur();
        event.preventDefault();
        return;
      }
      const stack = previous.current;
      if (stack.length > 1) {
        stack.pop();
        navigateRef.current(stack[stack.length - 1], { replace: true });
      } else if (currentRef.current !== "/" && currentRef.current !== "/dashboard") {
        navigateRef.current("/", { replace: true });
      }
      // On the root, consume Back; only the explicit exit action may close Locat.
      event.preventDefault();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && event.isTrusted && !event.defaultPrevented) back(event);
    };
    // Capacitor App's backButton listener overrides the default Activity exit.
    // Keep the listener registered while the native router is mounted.
    let disposed = false;
    let subscription: { remove(): Promise<void> } | undefined;
    if (detectPlatform() === "capacitor-android") {
      const cap = window.Capacitor as unknown as {
        Plugins?: { App?: { addListener(name: "backButton", handler: () => void): Promise<{ remove(): Promise<void> }> } }
      };
      void cap?.Plugins?.App?.addListener("backButton", () => {
        window.dispatchEvent(new Event("locat:back", { cancelable: true }));
      })?.then(listener => {
        if (disposed) void listener.remove();
        else subscription = listener;
      })?.catch(() => { /* Some Android shells do not bundle Capacitor App. */ });
    }
    window.addEventListener("locat:back", back);
    window.addEventListener("keydown", keyboard);
    return () => { disposed = true; void subscription?.remove(); window.removeEventListener("locat:back", back); window.removeEventListener("keydown", keyboard); };
  }, []);
  return null;
}
