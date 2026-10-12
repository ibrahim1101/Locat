import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scheduledKeyContext } from "./scheduledKeyContext";
const members = [{ id: 2, publicKey: "key-b" }, { id: 1, publicKey: "key-a" }];
describe("direct scheduling key snapshot", () => {
  it("agrees between WebCrypto clients and server hashing independently of member ordering", async () => {
    const expected = createHash("sha256").update('[9,[{"id":1,"publicKey":"key-a"},{"id":2,"publicKey":"key-b"}]]').digest("hex");
    expect(await scheduledKeyContext(9, members)).toBe(expected);
    expect(await scheduledKeyContext(9, [...members].reverse())).toBe(expected);
  });
  it("binds the conversation and each member identity/public key", async () => {
    const original = await scheduledKeyContext(9, members);
    expect(await scheduledKeyContext(10, members)).not.toBe(original);
    for (const index of [0, 1]) {
      expect(await scheduledKeyContext(9, members.map((m, i) => i === index ? { ...m, publicKey: "rotated" } : m))).not.toBe(original);
    }
  });
});
