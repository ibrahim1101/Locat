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
  it("rejects repeated short motifs and ascending or descending runs", () => {
    for (const password of ["abcabcabcabcabc", "123123123123123", "abcdabcdabcdabcd", "234567890123456", "987654321098765", "abcdefghijklmnop", "qwertyuiopqwertyuiop", "123-123-123-123-123!"])
      expect(registrationPasswordError(password, "alice"), password).not.toBeNull();
    expect(registrationPasswordError("orchard-5937-velvet-2048", "alice")).toBeNull();
  });
});
