import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { messagePayloadSchema } from "@contracts/messagePayload";
import { captureLocation, locationMapUrl, type LocationPayload } from "./location";
import { deriveDirectKey, generateIdentity, encryptPayload, decryptPayload } from "./crypto";
import { encodeArchive, decodeArchive } from "./archive";
import { storeMessage, getMessages, wipeAll, type LocalMessage } from "./localdb";
const point: LocationPayload = { type: "location", latitude: 17.385123, longitude: 78.486789, accuracyMeters: 12, capturedAt: 1700000000000 };

describe("one-time encrypted location sharing", () => {
  it("bounds coordinates, accuracy and capture time and rejects untrusted map URLs", () => {
    for (const changes of [{ latitude: 91 }, { longitude: -181 }, { latitude: NaN },
      { longitude: Infinity }, { accuracyMeters: -1 }, { capturedAt: -1 }, { capturedAt: 1.5 },
      { url: "javascript:alert(1)" }]) {
      expect(messagePayloadSchema.safeParse({ ...point, ...changes }).success).toBe(false);
    }
    const url = new URL(locationMapUrl(point));
    expect(url.origin).toBe("https://www.openstreetmap.org");
    expect(url.searchParams.get("mlat")).toBe(String(point.latitude));
  });
  it("requests exactly one fresh position and preserves the snapshot", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({ coords: {
      latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracyMeters },
      timestamp: point.capturedAt } as GeolocationPosition));
    expect(await captureLocation({ getCurrentPosition } as unknown as Geolocation)).toEqual(point);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0].length).toBe(3);
  });
  it("rejects denied permission and invalid GPS data without returning a payload", async () => {
    const denied = { getCurrentPosition: (_: PositionCallback, fail: PositionErrorCallback) => fail({ code: 1 } as GeolocationPositionError) };
    await expect(captureLocation(denied as Geolocation)).rejects.toThrow("denied");
    const invalid = { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: NaN }, timestamp: 0 } as GeolocationPosition) };
    await expect(captureLocation(invalid as Geolocation)).rejects.toThrow("invalid");
  });
  it("round-trips direct encryption, device history and encrypted archive", async () => {
    const alice = await generateIdentity(); const bob = await generateIdentity();
    const sending = await deriveDirectKey(alice.privateKey, bob.publicKeyB64, 1, 2);
    const receiving = await deriveDirectKey(bob.privateKey, alice.publicKeyB64, 2, 1);
    const envelope = await encryptPayload(sending, point);
    expect(envelope).not.toContain(String(point.latitude));
    const payload = await decryptPayload(receiving, envelope);
    const message: LocalMessage = { mid: 77, conversationId: 10, senderId: 1, senderName: "Alice", outgoing: true, payload: payload as LocationPayload, createdAt: point.capturedAt };
    await wipeAll(1); await storeMessage(1, message);
    expect((await getMessages(1, 10))[0].payload).toEqual(point);
    const account = { userId: 1, username: "alice", origin: "https://locat.test" };
    const archive = await encodeArchive(account, [message], "backup-password");
    expect(archive).not.toContain(String(point.longitude));
    expect((await decodeArchive(archive, account, "backup-password"))[0].payload).toEqual(point);
    await wipeAll(1);
  });
});
