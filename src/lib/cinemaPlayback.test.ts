import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCinemaStallRecovery, getCinemaStartupBufferTarget } from "./cinemaPlayback";

describe("Cinema 4K startup buffering", () => {
  it("uses a 12 second buffer for long and unknown streams", () => {
    expect(getCinemaStartupBufferTarget(3600)).toBe(12);
    expect(getCinemaStartupBufferTarget(Number.NaN)).toBe(12);
    expect(getCinemaStartupBufferTarget(Infinity)).toBe(12);
    expect(getCinemaStartupBufferTarget(0)).toBe(12);
  });
  it("starts short clips without waiting for impossible buffer", () => {
    expect(getCinemaStartupBufferTarget(8)).toBe(7.75);
    expect(getCinemaStartupBufferTarget(0.5)).toBe(0.25);
    expect(getCinemaStartupBufferTarget(0.2)).toBe(0.1);
    expect(getCinemaStartupBufferTarget(12)).toBe(11.75);
  });
});

describe("Cinema stalled stream recovery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("deduplicates waiting events, retries progressively, and reports exhaustion once", () => {
    const recover = vi.fn();
    const exhausted = vi.fn();
    const recovery = createCinemaStallRecovery({ isStalled: () => true, recover, exhausted });
    recovery.begin();
    recovery.begin();
    vi.advanceTimersByTime(12_000);
    expect(recover).toHaveBeenCalledExactlyOnceWith(1, 2);
    vi.advanceTimersByTime(24_000);
    expect(recover).toHaveBeenLastCalledWith(2, 2);
    expect(recover).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(48_000);
    expect(exhausted).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(recover).toHaveBeenCalledTimes(2);
    expect(exhausted).toHaveBeenCalledTimes(1);
    recovery.dispose();
  });

  it("stops recovery when playback is no longer stalled", () => {
    let stalled = true;
    const recover = vi.fn();
    const recovery = createCinemaStallRecovery({ isStalled: () => stalled, recover, exhausted: vi.fn() });
    recovery.begin();
    stalled = false;
    vi.advanceTimersByTime(12_000);
    expect(recover).not.toHaveBeenCalled();
    recovery.dispose();
  });

  it("cancels pending timers on pause or dispose", () => {
    const recover = vi.fn();
    const recovery = createCinemaStallRecovery({ isStalled: () => true, recover, exhausted: vi.fn() });
    recovery.begin();
    recovery.end();
    vi.advanceTimersByTime(30_000);
    expect(recover).not.toHaveBeenCalled();
    recovery.begin();
    recovery.dispose();
    vi.advanceTimersByTime(30_000);
    recovery.begin();
    expect(recover).not.toHaveBeenCalled();
  });

  it("retains retry budget across episodes but resets after seek", () => {
    const recover = vi.fn();
    const recovery = createCinemaStallRecovery({ isStalled: () => true, recover, exhausted: vi.fn(), delayMs: 100 });
    recovery.begin();
    vi.advanceTimersByTime(100);
    recovery.end();
    recovery.begin();
    vi.advanceTimersByTime(200);
    expect(recover.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2]);
    recovery.end(true);
    recovery.begin();
    vi.advanceTimersByTime(100);
    expect(recover.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2, 1]);
    recovery.dispose();
  });

  it("clamps invalid options and caps exponential delay", () => {
    const recover = vi.fn();
    const exhausted = vi.fn();
    const recovery = createCinemaStallRecovery({ isStalled: () => true, recover, exhausted, delayMs: 100_000, maxAttempts: 1 });
    recovery.begin();
    vi.advanceTimersByTime(59_999);
    expect(recover).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(recover).toHaveBeenCalledExactlyOnceWith(1, 1);
    vi.advanceTimersByTime(60_000);
    expect(exhausted).toHaveBeenCalledTimes(1);
    recovery.dispose();
  });
  it("does not rearm recovery after synchronous resume or disposal", () => {
    for (const mode of ["resume", "dispose"] as const) {
      const exhausted = vi.fn();
      const recover = vi.fn();
      let stalled = true;
      let recovery: ReturnType<typeof createCinemaStallRecovery>;
      recovery = createCinemaStallRecovery({
        isStalled: () => stalled,
        recover: () => {
          recover();
          if (mode === "resume") stalled = false;
          else recovery.dispose();
        },
        exhausted,
        delayMs: 100,
      });
      recovery.begin();
      vi.advanceTimersByTime(100);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(120_000);
      expect(exhausted).not.toHaveBeenCalled();
      recovery.dispose();
    }
  });

});
