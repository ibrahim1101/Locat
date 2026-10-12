import { describe, expect, it } from "vitest";
import { MODULES, moduleDisabledReason } from "./registry";
describe("section connection and permission gates", () => {
  it("keeps planned sections disabled even when connected", () => {
    for (const module of MODULES.filter(m => m.status === "planned")) expect(moduleDisabledReason(module, true, true)).toBe("Not implemented yet");
  });
  it("enables implemented server sections only with a ready server", () => {
    for (const id of ["messages", "sentinel", "link", "vault", "secrets"]) {
      const module = MODULES.find(m => m.id === id)!;
      expect(moduleDisabledReason(module, false, false)).toBe("Connect to server");
      expect(moduleDisabledReason(module, true, false)).toBeNull();
    }
  });
  it("keeps local tools available and preserves administrator authorization", () => {
    for (const id of ["dashboard", "cinema", "music", "search", "performance", "remote"]) expect(moduleDisabledReason(MODULES.find(m => m.id === id)!, false, false)).toBeNull();
    expect(moduleDisabledReason(MODULES.find(m => m.id === "hub")!, true, false)).toBe("Administrator access required");
  });
});
