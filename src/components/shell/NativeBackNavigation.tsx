import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { isNativeShell } from "@/lib/native";

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
      const overlay = document.querySelector<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
      if (overlay) {
        const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
        overlay.dispatchEvent(escape);
        event.preventDefault();
        return;
      }
      const stack = previous.current;
      if (stack.length > 1) {
        stack.pop();
        navigate(stack[stack.length - 1], { replace: true });
      } else if (current !== "/" && current !== "/dashboard") {
        navigate("/", { replace: true });
      }
      // On the root, consume Back; only the explicit exit action may close Locat.
      event.preventDefault();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && event.isTrusted && !event.defaultPrevented) back(event);
    };
    window.addEventListener("locat:back", back);
    window.addEventListener("keydown", keyboard);
    return () => { window.removeEventListener("locat:back", back); window.removeEventListener("keydown", keyboard); };
  }, [current, navigate]);
  return null;
}
