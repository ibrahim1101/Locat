import { describe, expect, it } from "vitest";
import { decryptMediaChunk, encryptMediaChunk, importMediaTransferKey } from "./mediaTransferCrypto";

describe("authenticated media transfer chunks", () => {
  const keyBytes = () => crypto.getRandomValues(new Uint8Array(32)).buffer;
  it("round-trips a chunk with AES-GCM", async () => {
    const key = await importMediaTransferKey(keyBytes());
    const original = new TextEncoder().encode("Locat media payload").buffer;
    const encrypted = await encryptMediaChunk(key, "transfer-one", 0, original);
    const decrypted = await decryptMediaChunk(key, "transfer-one", encrypted);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(original));
  });
  it("rejects tampering, mismatched transfer IDs and mismatched sequence numbers", async () => {
    const key = await importMediaTransferKey(keyBytes());
    const encrypted = await encryptMediaChunk(key, "transfer-one", 2, new Uint8Array([1, 2, 3]).buffer);
    await expect(decryptMediaChunk(key, "transfer-two", encrypted)).rejects.toThrow();
    await expect(decryptMediaChunk(key, "transfer-one", { ...encrypted, sequence: 3 })).rejects.toThrow();
    const corrupted = new Uint8Array(encrypted.ciphertext.slice(0));
    corrupted[0] ^= 1;
    await expect(decryptMediaChunk(key, "transfer-one", { ...encrypted, ciphertext: corrupted.buffer })).rejects.toThrow();
  });
  it("enforces key length and chunk bounds", async () => {
    await expect(importMediaTransferKey(new Uint8Array(16).buffer)).rejects.toThrow();
    const key = await importMediaTransferKey(keyBytes());
    await expect(encryptMediaChunk(key, "id", -1, new Uint8Array([1]).buffer)).rejects.toThrow();
    await expect(encryptMediaChunk(key, "id", 0, new ArrayBuffer(0))).rejects.toThrow();
    await expect(encryptMediaChunk(key, "id", 0, new ArrayBuffer(1024 * 1024 + 1))).rejects.toThrow();
  });
});
