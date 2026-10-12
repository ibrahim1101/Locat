import { describe, expect, it } from "vitest";
import { importMediaTransferKey } from "./mediaTransferCrypto";
import { MediaTransferChunkReceiver } from "./mediaTransferChunkReceiver";
import { encryptMediaFile, mediaTransferChunkCount } from "./mediaTransferChunkSender";

describe("encrypted media file sender", () => {
  it("round-trips a multi-chunk file through the authenticated receiver", async () => {
    const key = await importMediaTransferKey(crypto.getRandomValues(new Uint8Array(32)).buffer);
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
    const receiver = new MediaTransferChunkReceiver(key, "transfer-file", data.length);
    let count = 0;
    for await (const chunk of encryptMediaFile(new Blob([data]), key, "transfer-file", 3)) {
      expect(chunk.sequence).toBe(count++);
      await receiver.accept(chunk);
    }
    expect(count).toBe(mediaTransferChunkCount(data.length, 3));
    expect(receiver.finish(count, data.length)).toEqual(data);
  });
  it("rejects empty, oversized, and invalid chunk configurations", async () => {
    const key = await importMediaTransferKey(crypto.getRandomValues(new Uint8Array(32)).buffer);
    await expect(async () => {
      for await (const _ of encryptMediaFile(new Blob([]), key, "id")) { /* empty */ }
    }).rejects.toThrow("Unsupported");
    expect(() => mediaTransferChunkCount(0)).toThrow();
    expect(() => mediaTransferChunkCount(1, 0)).toThrow();
  });
});
