import { describe, expect, it } from "vitest";
import { consumeMediaTransferSignal, publishMediaTransferSignal, revokeMediaTransferSignals } from "./mediaTransferSignals";

describe("ephemeral device media signaling", () => {
  const base = { userId: 9871, transferId: "transfer-123", fromDeviceId: 71, toDeviceId: 72, publicKey: "ephemeral-public-key" };
  it("delivers once to the intended device only", () => {
    expect(publishMediaTransferSignal(base, 1000)).toBe(true);
    expect(consumeMediaTransferSignal(9872, base.transferId, 71, 72, 1001)).toBeNull();
    expect(consumeMediaTransferSignal(9871, base.transferId, 71, 73, 1001)).toBeNull();
    expect(consumeMediaTransferSignal(9871, base.transferId, 71, 72, 1001)?.publicKey).toBe(base.publicKey);
    expect(consumeMediaTransferSignal(9871, base.transferId, 71, 72, 1002)).toBeNull();
  });
  it("rejects duplicate pending publication", () => {
    const item = { ...base, transferId: "transfer-duplicate" };
    expect(publishMediaTransferSignal(item, 2000)).toBe(true);
    expect(publishMediaTransferSignal(item, 2001)).toBe(false);
  });
  it("expires after two minutes", () => {
    const item = { ...base, transferId: "transfer-expired" };
    expect(publishMediaTransferSignal(item, 3000)).toBe(true);
    expect(consumeMediaTransferSignal(9871, item.transferId, 71, 72, 3000 + 120_000)).toBeNull();
  });
  it("revokes signals when either peer is revoked", () => {
    const a = { ...base, transferId: "transfer-revoke-source" };
    const b = { ...base, transferId: "transfer-revoke-dest" };
    publishMediaTransferSignal(a, 4000);
    revokeMediaTransferSignals(9871, 71);
    expect(consumeMediaTransferSignal(9871, a.transferId, 71, 72, 4001)).toBeNull();
    publishMediaTransferSignal(b, 4002);
    revokeMediaTransferSignals(9871, 72);
    expect(consumeMediaTransferSignal(9871, b.transferId, 71, 72, 4003)).toBeNull();
  });
});
