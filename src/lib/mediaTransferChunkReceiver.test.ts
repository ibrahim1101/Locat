import { describe, expect, it } from "vitest";
import { importMediaTransferKey, encryptMediaChunk } from "./mediaTransferCrypto";
import { MediaTransferChunkReceiver } from "./mediaTransferChunkReceiver";

describe("media chunk receiver", () => {
  const makeKey = () => importMediaTransferKey(crypto.getRandomValues(new Uint8Array(32)).buffer);
  it("reassembles authenticated chunks in order", async () => {
    const key = await makeKey();
    const receiver = new MediaTransferChunkReceiver(key, "transfer-1", 10);
    await receiver.accept(await encryptMediaChunk(key, "transfer-1", 0, new Uint8Array([1, 2]).buffer));
    await receiver.accept(await encryptMediaChunk(key, "transfer-1", 1, new Uint8Array([3]).buffer));
    expect(receiver.finish(2, 3)).toEqual(new Uint8Array([1, 2, 3]));
    expect(() => receiver.finish(2, 3)).toThrow();
  });
  it("rejects replay and out-of-order chunks", async () => {
    const key = await makeKey();
    const receiver = new MediaTransferChunkReceiver(key, "transfer-2", 10);
    const chunk = await encryptMediaChunk(key, "transfer-2", 0, new Uint8Array([1]).buffer);
    await receiver.accept(chunk);
    await expect(receiver.accept(chunk)).rejects.toThrow("Out-of-order");
    await expect(receiver.accept(await encryptMediaChunk(key, "transfer-2", 2, new Uint8Array([2]).buffer))).rejects.toThrow("Out-of-order");
  });
  it("enforces byte budget and completion metadata", async () => {
    const key = await makeKey();
    const receiver = new MediaTransferChunkReceiver(key, "transfer-3", 1);
    await expect(receiver.accept(await encryptMediaChunk(key, "transfer-3", 0, new Uint8Array([1, 2]).buffer))).rejects.toThrow("maximum");
    await receiver.accept(await encryptMediaChunk(key, "transfer-3", 0, new Uint8Array([1]).buffer));
    expect(() => receiver.finish(2, 1)).toThrow("Incomplete");
    expect(receiver.finish(1, 1)).toEqual(new Uint8Array([1]));
  });
});
