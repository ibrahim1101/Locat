import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Source-level guards for the Phase 1 navigation upgrades.
// A real device test lives in the Android QA runbook; these checks catch
// regressions that would re-break the Home button or the de-duplicated drawer
// without requiring a running emulator.
const chat = readFileSync(fileURLToPath(new URL("../pages/Chat.tsx", import.meta.url)), "utf8");
const mobileNav = readFileSync(fileURLToPath(new URL("../components/shell/MobileBottomNav.tsx", import.meta.url)), "utf8");
const appShell = readFileSync(fileURLToPath(new URL("../components/shell/AppShell.tsx", import.meta.url)), "utf8");
const chatWindow = readFileSync(fileURLToPath(new URL("../components/chat/ChatWindow.tsx", import.meta.url)), "utf8");

describe("mobile home navigation", () => {
  it("exposes a single Home affordance in the primary bottom nav", () => {
    expect(mobileNav).toContain('data-testid="mobile-bottom-nav"');
    expect(mobileNav).toContain('data-testid={m.id === "dashboard" ? "bottomnav-home" : `bottomnav-${m.id}`}');
    expect(mobileNav).toContain('const label = m.id === "dashboard" ? "Home" : m.name;');
  });

  it("renders the shared bottom nav on the Messages conversation list", () => {
    expect(chat).toContain('import { MobileBottomNav } from "@/components/shell/MobileBottomNav"');
    expect(chat).toContain('{!activeId && <MobileBottomNav active="messages" />}');
  });

  it("reserves bottom padding for the nav bar on mobile only", () => {
    expect(chat).toContain('className={`${activeId ? "hidden" : "flex"} w-full border-r border-border/70 pb-[72px] md:flex md:w-80 md:shrink-0 md:pb-0 lg:w-96`}');
  });

  it("reuses the shared bottom nav inside the ecosystem AppShell", () => {
    expect(appShell).toContain('import { MobileBottomNav } from "./MobileBottomNav"');
    expect(appShell).toContain("<MobileBottomNav active={active} />");
    // The duplicated inline <nav> block should be gone.
    expect(appShell).not.toContain('aria-label="Primary"');
  });

  it("drops drawer entries that duplicate the primary bottom nav", () => {
    // The hamburger drawer no longer offers Ecosystem home or Chats because
    // Home + Messages are reachable with one tap from the bottom bar.
    expect(chat).not.toContain("Ecosystem home");
    // The duplicate "Chats" button that previously re-opened the message list
    // from inside the drawer is gone. The sidebar's "Chats" / "Hidden chats"
    // visibility toggle is a different control and must still exist.
    expect(chat).not.toContain('<MessageCircle className="h-5 w-5 text-primary" /> Chats</button>');
    // The LayoutGrid / MessageCircle imports used only by those duplicate
    // entries must be removed to keep the bundle lean.
    expect(chat).not.toContain("LayoutGrid");
    expect(chat).not.toMatch(/import[^;]*MessageCircle/);
  });
});

describe("ephemeral composer drafts", () => {
  it("hydrates the composer with an in-memory draft for the active conversation", () => {
    expect(chatWindow).toContain('import { clearDraft, loadDraft, saveDraft } from "@/lib/draft";');
    expect(chatWindow).toContain("useState(() => loadDraft(conversation.id, myId))");
    expect(chatWindow).toContain("setDraft(loadDraft(conversation.id, myId));");
    expect(chatWindow).toContain("saveDraft(conversation.id, myId, e.target.value);");
  });

  it("clears the in-memory draft after a send", () => {
    expect(chatWindow).toContain("clearDraft(conversation.id, myId);");
  });
});
