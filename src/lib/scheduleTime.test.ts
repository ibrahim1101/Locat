import { describe, expect, it } from "vitest";
import { localScheduleValue, parseScheduleTime, scheduleFailureLabel } from "./scheduleTime";
describe("schedule device time conversion", () => {
  it("round-trips a local selection as an instant and enforces the future window", () => {
    const now = new Date(2026, 9, 12, 12, 0).getTime();
    const date = parseScheduleTime("2026-10-12T12:05", now);
    expect(date.getTime()).toBe(now + 300_000);
    expect(localScheduleValue(date)).toBe("2026-10-12T12:05");
    expect(() => parseScheduleTime("2026-10-12T12:00", now)).toThrow("one minute");
    expect(() => parseScheduleTime("2026-11-12T12:05", now)).toThrow("30 days");
  });
  it("rejects calendar overflow, malformed input and ambiguous UTC-suffixed local values", () => {
    for (const value of ["2026-02-30T12:00", "2026-10-12T24:00", "2026-10-12T12:00Z", "", "tomorrow"]) {
      expect(() => parseScheduleTime(value, 0)).toThrow();
    }
  });
  it("provides understandable failures including worker retry conflicts", () => {
    expect(scheduleFailureLabel("retry_conflict")).toContain("retry conflict");
    expect(scheduleFailureLabel("key_epoch_changed")).toContain("encryption changed");
    expect(scheduleFailureLabel(null)).toContain("could not");
  });
});
