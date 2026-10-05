import { describe, expect, it } from "vitest";
import { imageUrl } from "./crypto";
import { messagePayloadSchema, decodeArchive, encodeArchive } from "./archive";
import type { LocalMessage } from "./localdb";

const account = { userId: 1, username: "alice", origin: "https://locat.test" };
const messages: LocalMessage[] = [{ mid: 1, conversationId: 10, senderId: 1,
  senderName: "Alice", outgoing: true, payload: { type: "text", text: "private history" }, createdAt: 1234 }];

describe("encrypted history backups", () => {
  it("round-trips history without exposing plaintext", async () => {
    const text = await encodeArchive(account, messages, "backup-password");
    expect(text).not.toContain("private history");
    expect(await decodeArchive(text, account, "backup-password")).toEqual(messages);
  });
  it("rejects wrong passwords, modified ciphertext, and another account", async () => {
    const text = await encodeArchive(account, messages, "backup-password");
    await expect(decodeArchive(text, account, "wrong-password")).rejects.toThrow("Cannot unlock");
    const tampered = JSON.parse(text);
    tampered.data = (tampered.data[0] === "A" ? "B" : "A") + tampered.data.slice(1);
    await expect(decodeArchive(JSON.stringify(tampered), account, "backup-password")).rejects.toThrow("Cannot unlock");
    await expect(decodeArchive(text, { ...account, userId: 2 }, "backup-password")).rejects.toThrow("different Locat account");
    await expect(decodeArchive(text, { ...account, origin: "https://other.test" }, "backup-password")).rejects.toThrow("different Locat account");
  });
  it("rejects malformed message payloads and short passwords", async () => {
    await expect(encodeArchive(account, messages, "short")).rejects.toThrow("at least 8");
    await expect(encodeArchive(account, [{ ...messages[0], mid: -1 }], "backup-password")).rejects.toThrow();
  });
});


it("rejects active image formats in received payloads",()=>{
  expect(messagePayloadSchema.safeParse({type:"image",mime:"image/svg+xml",name:"image.svg",dataB64:"YWJj"}).success).toBe(false);
  expect(imageUrl({type:"image",mime:"image/svg+xml",name:"image.svg",dataB64:"YWJj"})).toBeNull();
  expect(messagePayloadSchema.safeParse({type:"image",mime:"image/png",name:"image.png",dataB64:"YWJj"}).success).toBe(true);
});
