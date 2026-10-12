import { describe, expect, it } from "vitest";
import { sha256MediaPayload, verifyMediaPayload } from "./mediaTransferIntegrity";

describe("media transfer payload integrity", () => {
  it("accepts a matching SHA-256 digest", async () => {
    const payload = new TextEncoder().encode("Locat encrypted media transfer");
    const digest = await sha256MediaPayload(payload);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(await verifyMediaPayload(payload, digest)).toBe(true);
  });
  it("rejects modified content and malformed digests", async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const digest = await sha256MediaPayload(payload);
    expect(await verifyMediaPayload(new Uint8Array([1, 2, 4]), digest)).toBe(false);
    expect(await verifyMediaPayload(payload, "invalid")).toBe(false);
  });
});
