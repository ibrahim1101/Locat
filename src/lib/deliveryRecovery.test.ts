import { beforeEach, describe, expect, it, vi } from "vitest";
import { acknowledgeArchivedDeliveries } from "./deliveryAck";
import { decryptPayload, encryptPayload, generateGroupKey } from "./crypto";
import { allMessages, applyMessageControl, applyReadReceipt, storeMessage, wipeAll } from "./localdb";
import type { LocalMessage } from "./localdb";
import "fake-indexeddb/auto";

/** A small real-WebCrypto/IndexedDB recovery harness. No mocked successful
 * archive: a delivery becomes ack-eligible only after storeMessage resolves.
 * This tests the required order independently from the React view lifecycle.
 */
describe("encrypted relay delivery recovery boundaries", () => {
  beforeEach(async () => { await Promise.all([91, 92, 93, 94, 95].map(wipeAll)); });
  it("keeps malformed and wrong-key envelopes unacknowledged until recovered", async () => {
    await wipeAll(91);
    const key = await generateGroupKey();
    const wrongKey = await generateGroupKey();
    const sealed = await encryptPayload(key, { type: "text", text: "recoverable" });
    const ack = vi.fn(async (...ids: number[][]) => ids.length);
    const process = async (envelope: string, decryptionKey: CryptoKey) => {
      const payload = await decryptPayload(decryptionKey, envelope);
      if (payload.type === "control") throw new Error("Unexpected control");
      await storeMessage(91, { mid: 901, conversationId: 12, senderId: 4,
        senderName: "Peer", outgoing: false, payload, createdAt: 1000 });
      await acknowledgeArchivedDeliveries([901], ack);
    };
    await expect(process("{invalid", key)).rejects.toThrow();
    await expect(process(sealed, wrongKey)).rejects.toThrow();
    expect(ack).not.toHaveBeenCalled();
    expect(await allMessages(91)).toEqual([]);
    await process(sealed, key);
    expect(ack).toHaveBeenCalledExactlyOnceWith([901]);
    expect(await allMessages(91)).toHaveLength(1);
  });

  it("does not acknowledge a missing key or failed IndexedDB archive; replays without duplicates", async () => {
    await wipeAll(92);
    const key = await generateGroupKey();
    const envelope = await encryptPayload(key, { type: "text", text: "durable" });
    const ack = vi.fn(async (ids: number[]) => ids.length);
    const replay = async (resolveKey: () => Promise<CryptoKey>, persist: (msg: LocalMessage) => Promise<boolean>) => {
      const payload = await decryptPayload(await resolveKey(), envelope);
      if (payload.type === "control") throw new Error("Unexpected control");
      const msg: LocalMessage = { mid: 902, conversationId: 12, senderId: 4,
        senderName: "Peer", outgoing: false, payload, createdAt: 1000 };
      await persist(msg);
      await acknowledgeArchivedDeliveries([902], ack);
    };
    await expect(replay(async () => { throw new Error("Missing group key"); }, msg => storeMessage(92, msg))).rejects.toThrow("Missing group key");
    await expect(replay(async () => key, async msg => storeMessage(92, {
      ...msg, payload: { ...msg.payload, badClone: () => undefined },
    } as unknown as LocalMessage))).rejects.toThrow();
    expect(ack).not.toHaveBeenCalled();
    expect(await allMessages(92)).toEqual([]);
    await replay(async () => key, msg => storeMessage(92, msg));
    // SSE and poll may both replay a successfully committed message.
    await Promise.all([replay(async () => key, msg => storeMessage(92, msg)),
      replay(async () => key, msg => storeMessage(92, msg))]);
    expect(await allMessages(92)).toHaveLength(1);
    expect(ack).toHaveBeenCalledTimes(3);
    expect(ack.mock.calls.every(([ids]) => ids[0] === 902)).toBe(true);
  });

  it("recovers when the process stops after archive commit but before relay acknowledgement", async () => {
    await wipeAll(93);
    const key = await generateGroupKey();
    const payload = await decryptPayload(key, await encryptPayload(key, { type: "text", text: "crash boundary" }));
    if (payload.type === "control") throw new Error("Unexpected control");
    const msg: LocalMessage = { mid: 903, conversationId: 12, senderId: 4,
      senderName: "Peer", outgoing: false, payload, createdAt: 1000 };
    expect(await storeMessage(93, msg)).toBe(true);
    const ack = vi.fn(async (ids: number[]) => ids.length);
    expect(ack).not.toHaveBeenCalled();
    expect(await storeMessage(93, msg)).toBe(false);
    expect(await acknowledgeArchivedDeliveries([903, 903], ack)).toBe(true);
    expect(ack).toHaveBeenCalledExactlyOnceWith([903]);
    expect(await allMessages(93)).toHaveLength(1);
  });
  it("recovers an old group epoch after its wrapped key becomes available on reconnect", async () => {
    await wipeAll(94);
    const historicalKey = await generateGroupKey();
    const currentKey = await generateGroupKey();
    const envelope = await encryptPayload(historicalKey, { type: "text", text: "old epoch recovered" });
    const ack = vi.fn(async (ids: number[]) => ids.length);
    let keyAvailable = false;
    const resolveHistorical = async () => {
      if (!keyAvailable) throw new Error("Historical group key unavailable");
      return historicalKey;
    };
    const replay = async () => {
      const key = await resolveHistorical();
      const payload = await decryptPayload(key, envelope);
      if (payload.type === "control") throw new Error("Unexpected control");
      await storeMessage(94, { mid: 904, conversationId: 14, senderId: 8,
        senderName: "Member", outgoing: false, payload, createdAt: 1000 });
      await acknowledgeArchivedDeliveries([904], ack);
    };
    await expect(replay()).rejects.toThrow("Historical group key unavailable");
    await expect(decryptPayload(currentKey, envelope)).rejects.toThrow();
    expect(ack).not.toHaveBeenCalled();
    expect(await allMessages(94)).toHaveLength(0);
    keyAvailable = true;
    await replay();
    await replay();
    expect(ack).toHaveBeenCalledTimes(2);
    expect(await allMessages(94)).toHaveLength(1);
  });

  it("replays an encrypted edit before its message arrives without duplicate mutations", async () => {
    const key = await generateGroupKey();
    const ack = vi.fn(async (ids: number[]) => ids.length);
    const encrypted = await encryptPayload(key, { type: "control", version: 1,
      action: "edit", target: "legacy:950", text: "corrected" });
    const deliverEdit = async () => {
      const control = await decryptPayload(key, encrypted);
      if (control.type !== "control") throw new Error("Expected encrypted control");
      await applyMessageControl(95, 15, 7, control, 951, 2000);
      await acknowledgeArchivedDeliveries([951], ack);
    };
    await deliverEdit();
    await storeMessage(95, { mid: 950, conversationId: 15, senderId: 7,
      senderName: "Peer", outgoing: false,
      payload: { type: "text", text: "original", messageRef: "legacy:950" }, createdAt: 1000 });
    await deliverEdit();
    const rows = await allMessages(95);
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({ text: "corrected" });
    expect(ack).toHaveBeenCalledTimes(2);
  });

  it("keeps encrypted read receipt replay idempotent after durable processing", async () => {
    const key = await generateGroupKey();
    const ack = vi.fn(async (ids: number[]) => ids.length);
    await storeMessage(95, { mid: 952, conversationId: 16, senderId: 95,
      senderName: "Me", outgoing: true,
      payload: { type: "text", text: "sent", messageRef: "legacy:952" }, createdAt: 1000 });
    const encrypted = await encryptPayload(key, { type: "control", version: 1,
      action: "read", target: "legacy:952" });
    for (let retry = 0; retry < 2; retry++) {
      const control = await decryptPayload(key, encrypted);
      if (control.type !== "control" || control.action !== "read") throw new Error("Expected read receipt");
      await applyReadReceipt(95, 16, 7, control.target);
      await acknowledgeArchivedDeliveries([953], ack);
    }
    expect((await allMessages(95))[0].readBy).toEqual([7]);
    expect(ack).toHaveBeenCalledTimes(2);
  });

});
