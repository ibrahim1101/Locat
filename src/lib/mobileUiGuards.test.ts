import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Source-level guard for accessibility markup; Android visual QA is separate.
const source = readFileSync(fileURLToPath(new URL("../pages/Chat.tsx", import.meta.url)), "utf8");
const dialog = readFileSync(fileURLToPath(new URL("../components/ui/dialog.tsx", import.meta.url)), "utf8");

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

  it("allows the drawer and dialogs to scroll within small viewports", () => {
    expect(source).toContain("max-h-[100dvh]");
    expect(source).toContain("overflow-y-auto overscroll-contain");
    expect(dialog).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog).toContain("overflow-x-hidden overflow-y-auto overscroll-contain");
  });
});
