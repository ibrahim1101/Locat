import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
// Provide WebCrypto globally for the browser-oriented link lib under Node/vitest.
if (!globalThis.crypto) (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;

const { generateDeviceIdentity, deviceSharedKey, pairingSas, chunkCount, sliceChunk, encryptChunk, decryptChunk, encryptText, decryptText, CHUNK_SIZE } = await import("./link");

describe("link SAS (MITM protection)", () => {
  it("is identical regardless of argument order", async () => {
    const a = await generateDeviceIdentity();
    const b = await generateDeviceIdentity();
    const sas1 = await pairingSas(a.publicKeyB64, b.publicKeyB64);
    const sas2 = await pairingSas(b.publicKeyB64, a.publicKeyB64);
    expect(sas1).toBe(sas2);
    expect(sas1).toMatch(/^\d{6}$/);
  });
  it("differs when a key is swapped (detects a man-in-the-middle)", async () => {
    const a = await generateDeviceIdentity();
    const b = await generateDeviceIdentity();
    const mitm = await generateDeviceIdentity();
    const honest = await pairingSas(a.publicKeyB64, b.publicKeyB64);
    const attacked = await pairingSas(a.publicKeyB64, mitm.publicKeyB64);
    expect(attacked).not.toBe(honest);
  });
});

describe("link shared key", () => {
  it("both devices derive the same AES key (round-trips ciphertext)", async () => {
    const a = await generateDeviceIdentity();
    const b = await generateDeviceIdentity();
    const ka = await deviceSharedKey(a.privateKey, b.publicKeyB64);
    const kb = await deviceSharedKey(b.privateKey, a.publicKeyB64);
    const { iv, data } = await encryptChunk(ka, new TextEncoder().encode("secret-bytes"));
    const out = await decryptChunk(kb, iv, data);
    expect(new TextDecoder().decode(out)).toBe("secret-bytes");
  });
  it("a third device cannot decrypt the transfer", async () => {
    const a = await generateDeviceIdentity();
    const b = await generateDeviceIdentity();
    const c = await generateDeviceIdentity();
    const ka = await deviceSharedKey(a.privateKey, b.publicKeyB64);
    const kc = await deviceSharedKey(c.privateKey, a.publicKeyB64);
    const { iv, data } = await encryptChunk(ka, new TextEncoder().encode("top secret"));
    await expect(decryptChunk(kc, iv, data)).rejects.toBeDefined();
  });
});

describe("link chunking", () => {
  it("computes chunk counts", () => {
    expect(chunkCount(0)).toBe(1);
    expect(chunkCount(1)).toBe(1);
    expect(chunkCount(CHUNK_SIZE)).toBe(1);
    expect(chunkCount(CHUNK_SIZE + 1)).toBe(2);
    expect(chunkCount(CHUNK_SIZE * 3)).toBe(3);
  });
  it("reassembles a file from encrypted chunks in order", async () => {
    const a = await generateDeviceIdentity();
    const b = await generateDeviceIdentity();
    const key = await deviceSharedKey(a.privateKey, b.publicKeyB64);
    const original = new Uint8Array(CHUNK_SIZE * 2 + 1234);
    for (let i = 0; i < original.length; i++) original[i] = (i * 7) & 0xff;
    const n = chunkCount(original.length);
    const parts: { iv: string; data: string }[] = [];
    for (let s = 0; s < n; s++) parts.push(await encryptChunk(key, sliceChunk(original, s)));
    const recvKey = await deviceSharedKey(b.privateKey, a.publicKeyB64);
    const chunks: Uint8Array[] = [];
    for (let s = 0; s < n; s++) chunks.push(await decryptChunk(recvKey, parts[s].iv, parts[s].data));
    const merged = new Uint8Array(chunks.reduce((t, c) => t + c.length, 0));
    let off = 0; for (const c of chunks) { merged.set(c, off); off += c.length; }
    expect(merged.length).toBe(original.length);
    expect(Array.from(merged.slice(0, 50))).toEqual(Array.from(original.slice(0, 50)));
    expect(Array.from(merged.slice(-50))).toEqual(Array.from(original.slice(-50)));
  });
});

describe("link clipboard text", () => {
  it("round-trips clipboard text between paired devices", async () => {
    const a = await generateDeviceIdentity();
    const b = await generateDeviceIdentity();
    const ka = await deviceSharedKey(a.privateKey, b.publicKeyB64);
    const kb = await deviceSharedKey(b.privateKey, a.publicKeyB64);
    const { iv, data } = await encryptText(ka, "https://example.com/secret?token=abc");
    expect(await decryptText(kb, iv, data)).toBe("https://example.com/secret?token=abc");
  });
});

describe("authenticated file transfer context", () => {
  const context = { id: 10, userId: 1, fromDevice: 2, toDevice: 3,
    filename: "file.bin", mime: "application/octet-stream", size: CHUNK_SIZE * 2, chunkCount: 2 };
  it("round-trips paired devices but rejects reordered chunks and every changed metadata field", async () => {
    const { encryptTransferChunk, decryptTransferChunk } = await import("./link");
    const a = await generateDeviceIdentity(), b = await generateDeviceIdentity();
    const send = await deviceSharedKey(a.privateKey, b.publicKeyB64);
    const receive = await deviceSharedKey(b.privateKey, a.publicKeyB64);
    const bytes = new Uint8Array(CHUNK_SIZE).fill(42);
    const c = await encryptTransferChunk(send, bytes, context, 0);
    expect(await decryptTransferChunk(receive, c.iv, c.data, context, 0)).toEqual(bytes);
    await expect(decryptTransferChunk(receive, c.iv, c.data, context, 1)).rejects.toBeDefined();
    const changes = [{ id: 11 }, { userId: 4 }, { fromDevice: 4 }, { toDevice: 4 },
      { fromDevice: 3, toDevice: 2 }, { filename: "other.bin" }, { mime: "text/plain" },
      { size: context.size - 1 }, { size: CHUNK_SIZE * 3, chunkCount: 3 }];
    for (const change of changes) await expect(decryptTransferChunk(receive, c.iv, c.data,
      { ...context, ...change }, 0)).rejects.toBeDefined();
    const legacy = await encryptChunk(send, bytes);
    await expect(decryptTransferChunk(receive, legacy.iv, legacy.data, context, 0)).rejects.toBeDefined();
    const corrupted = c.data.slice(0, 4) + (c.data[4] === "A" ? "B" : "A") + c.data.slice(5);
    await expect(decryptTransferChunk(receive, c.iv, corrupted, context, 0)).rejects.toBeDefined();
  });
  it("handles zero-byte files and rejects invalid positions, size/count and truncated chunks", async () => {
    const { encryptTransferChunk, decryptTransferChunk } = await import("./link");
    const a = await generateDeviceIdentity(), b = await generateDeviceIdentity();
    const key = await deviceSharedKey(a.privateKey, b.publicKeyB64);
    const empty = { ...context, size: 0, chunkCount: 1 };
    const c = await encryptTransferChunk(key, new Uint8Array(), empty, 0);
    expect(await decryptTransferChunk(key, c.iv, c.data, empty, 0)).toHaveLength(0);
    await expect(encryptTransferChunk(key, new Uint8Array(1), empty, 0)).rejects.toThrow("length");
    for (const seq of [-1, 2, 0.5, NaN]) await expect(encryptTransferChunk(key,
      new Uint8Array(CHUNK_SIZE), context, seq)).rejects.toThrow("context");
    await expect(encryptTransferChunk(key, new Uint8Array(CHUNK_SIZE),
      { ...context, chunkCount: 1 }, 0)).rejects.toThrow("context");
  });
});

describe("authenticated clipboard context", () => {
  it("rejects replay under another row, account, direction or kind, and unbound legacy payloads", async () => {
    const { encryptLinkMessage, decryptLinkMessage } = await import("./link");
    const a = await generateDeviceIdentity(), b = await generateDeviceIdentity();
    const send = await deviceSharedKey(a.privateKey, b.publicKeyB64);
    const receive = await deviceSharedKey(b.privateKey, a.publicKeyB64);
    const context = { id: 21, userId: 1, fromDevice: 2, toDevice: 3, kind: "clipboard" as const };
    const c = await encryptLinkMessage(send, "copy me", context);
    expect(await decryptLinkMessage(receive, c.iv, c.data, context)).toBe("copy me");
    const changes = [{ id: 22 }, { userId: 2 }, { fromDevice: 4 }, { toDevice: 4 },
      { fromDevice: 3, toDevice: 2 }, { kind: "text" as const }, { kind: "url" as const }];
    for (const change of changes) await expect(decryptLinkMessage(receive, c.iv, c.data,
      { ...context, ...change })).rejects.toBeDefined();
    const legacy = await encryptText(send, "copy me");
    await expect(decryptLinkMessage(receive, legacy.iv, legacy.data, context)).rejects.toBeDefined();
    await expect(encryptLinkMessage(send, "x", { ...context, id: 0 })).rejects.toThrow("context");
  });
});
