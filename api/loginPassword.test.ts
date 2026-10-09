import { describe, expect, it } from "vitest";
import { hashPassword, verifyLoginPassword } from "./crypto";

describe("login password verification", () => {
  it("rejects unknown accounts after dummy scrypt work", async () => {
    expect(await verifyLoginPassword("a sample password")).toBe(false);
  });

  it("accepts the correct password for a stored account", async () => {
    const hash = await hashPassword("valid sample password");
    expect(await verifyLoginPassword("valid sample password", hash)).toBe(true);
  });

  it("rejects an incorrect password for a stored account", async () => {
    const hash = await hashPassword("valid sample password");
    expect(await verifyLoginPassword("different password", hash)).toBe(false);
  });
});
