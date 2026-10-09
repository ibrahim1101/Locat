import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Source-level guard for accessibility markup; Android visual QA is separate.
const source = readFileSync(fileURLToPath(new URL("../pages/Chat.tsx", import.meta.url)), "utf8");
const dialog = readFileSync(fileURLToPath(new URL("../components/ui/dialog.tsx", import.meta.url)), "utf8");
const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");
const brand = readFileSync(fileURLToPath(new URL("../components/LocatBrand.tsx", import.meta.url)), "utf8");
const login = readFileSync(fileURLToPath(new URL("../pages/Login.tsx", import.meta.url)), "utf8");
const chatWindow = readFileSync(fileURLToPath(new URL("../components/chat/ChatWindow.tsx", import.meta.url)), "utf8");

describe("mobile navigation and dialog accessibility guards", () => {
  it("exposes a modal navigation landmark and an accessible close action", () => {
    expect(source).toContain('aria-label="Locat navigation" aria-modal="true" role="dialog"');
    expect(source).toContain('ref={navCloseRef} type="button" aria-label="Close navigation"');
    expect(source).toContain('ref={navTriggerRef} type="button" aria-label="Open navigation"');
  });

  it("restores focus and traps keyboard tabbing in the drawer", () => {
    expect(source).toContain('navCloseRef.current?.focus()');
    expect(source).toContain('navTriggerRef.current?.focus()');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain('event.preventDefault(); last.focus()');
    expect(source).toContain('event.preventDefault(); first.focus()');
  });

  it("preserves the official transparent logo without blend-mode hacks", () => {
    expect(css).toContain(".locat-official-mark {");
    expect(css).toContain("mix-blend-mode: normal;");
    expect(css).not.toContain("mix-blend-mode: screen;");
    expect(css).not.toContain(".locat-official-mark { mix-blend-mode: multiply; }");
  });

  it("uses the same approved logo asset in login and live chat", () => {
    expect(brand).toContain('src="/locat-official-logo.png"');
    expect(brand).toContain('className={`locat-official-mark shrink-0 object-contain ${className}`}');
    expect(login).toContain("<LocatMark");
    expect(source).toContain("<LocatMark");
    expect(brand).not.toContain("data:image/svg+xml");
  });

  it("announces unread counts and provides touch and keyboard feedback for live chats", () => {
    expect(source).toContain('aria-current={activeId === c.id ? "true" : undefined}');
    expect(source).toContain('aria-label={`${title}${n > 0 ? `, ${n} unread message${n === 1 ? "" : "s"}` : ""}`}');
    expect(source).toContain("focus-visible:outline-[#c7d2e0] active:bg-white/[0.12]");
  });

  it("retains mobile composer keyboard assistance without changing send semantics", () => {
    expect(chatWindow).toContain('autoComplete="off"');
    expect(chatWindow).toContain('autoCorrect="on"');
    expect(chatWindow).toContain("spellCheck={true}");
    expect(chatWindow).toContain('enterKeyHint="enter"');
    expect(chatWindow).toContain('aria-label="Message"');
  });

  it("prevents modified Enter from accidentally sending chat messages", () => {
    expect(chatWindow).toContain('e.key === "Enter"');
    expect(chatWindow).toContain("!e.shiftKey");
    expect(chatWindow).toContain("!e.ctrlKey");
    expect(chatWindow).toContain("!e.altKey");
    expect(chatWindow).toContain("!e.metaKey");
    expect(chatWindow).toContain("!e.nativeEvent.isComposing");
    expect(chatWindow).toContain('window.matchMedia("(min-width: 768px)").matches');
  });

  it("keeps the Android drawer close control tappable below the status bar", () => {
    expect(source).toContain('className="locat-nav-overlay fixed inset-0 z-50 flex"');
    expect(source).toContain('ref={navCloseRef} type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)}');
    expect(source).toContain("relative z-10 flex h-12 w-12 shrink-0 touch-manipulation");
    expect(css).toContain(".locat-native .locat-nav-overlay { top: 32px; }");
  });

  it("allows the drawer and dialogs to scroll within small viewports", () => {
    expect(source).toContain("max-h-[100dvh]");
    expect(source).toContain("overflow-y-auto overscroll-contain");
    expect(dialog).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog).toContain("overflow-x-hidden overflow-y-auto overscroll-contain");
  });
});
