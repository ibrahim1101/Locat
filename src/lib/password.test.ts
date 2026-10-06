import { describe, expect, it } from "vitest";
import { registrationPasswordError } from "@contracts/password";

describe("new account password policy", () => {
  it("counts Unicode code points rather than UTF-16 units", () => {
    expect(registrationPasswordError("😀".repeat(7) + "x", "alice")).toMatch(/15 characters/);
    expect(registrationPasswordError("😀🌙🐈🌿🎵🚀🍋🎨🌊🦊⭐🪴🎮☀🍀", "alice")).toBeNull();
  });
  it("accepts long passphrases without mandatory symbol rules", () => {
    expect(registrationPasswordError("velvet orchard moonlight canoe", "alice")).toBeNull();
  });
  it("rejects common, repeated and account-derived choices", () => {
    for (const password of ["Password123456789!", "aaaaaaaaaaaaaaa", "               ", "alice-is-the-best-123"])
      expect(registrationPasswordError(password, "alice")).not.toBeNull();
  });
  it("bounds input and retains original spaces and case", () => {
    const password = "  Velvet Orchard Moonlight  ";
    expect(registrationPasswordError(password, "alice")).toBeNull();
    expect(password).toBe("  Velvet Orchard Moonlight  ");
    expect(registrationPasswordError("x".repeat(1025), "alice")).toMatch(/too long/);
  });
});
