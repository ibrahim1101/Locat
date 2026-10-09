import { describe, expect, it, vi } from "vitest";
import { acknowledgeArchivedDeliveries } from "./deliveryAck";

describe("relay acknowledgement fault recovery", () => {
  it("does not make a network request for an empty delivery batch", async () => {
    const acknowledge = vi.fn(async (_ids: number[]) => ({ purged: 0 }));
    expect(await acknowledgeArchivedDeliveries([], acknowledge)).toBe(true);
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("deduplicates replayed delivery IDs before acknowledging", async () => {
    const acknowledge = vi.fn(async (_ids: number[]) => ({ purged: 1 }));
    expect(await acknowledgeArchivedDeliveries([7, 7, 8, 7], acknowledge)).toBe(true);
    expect(acknowledge).toHaveBeenCalledExactlyOnceWith([7, 8]);
  });

  it("respects the 500-ID server limit across large offline queues", async () => {
    const acknowledge = vi.fn(async (_ids: number[]) => ({ purged: 0 }));
    const ids = Array.from({ length: 1001 }, (_, index) => index + 1);
    expect(await acknowledgeArchivedDeliveries(ids, acknowledge)).toBe(true);
    expect(acknowledge.mock.calls.map(([batch]) => batch.length)).toEqual([500, 500, 1]);
    expect(acknowledge.mock.calls.flatMap(([batch]) => batch)).toEqual(ids);
  });

  it("continues after an interrupted acknowledgement and safely retries on reconnect", async () => {
    const calls: number[][] = [];
    let interrupted = true;
    const acknowledge = vi.fn(async (ids: number[]) => {
      calls.push(ids);
      if (interrupted && ids[0] === 1) throw new Error("network disconnected");
    });
    const ids = Array.from({ length: 1001 }, (_, index) => index + 1);
    expect(await acknowledgeArchivedDeliveries(ids, acknowledge)).toBe(false);
    expect(calls.map(batch => batch[0])).toEqual([1, 501, 1001]);
    interrupted = false;
    expect(await acknowledgeArchivedDeliveries(ids, acknowledge)).toBe(true);
    expect(calls.map(batch => batch[0])).toEqual([1, 501, 1001, 1, 501, 1001]);
  });
});
