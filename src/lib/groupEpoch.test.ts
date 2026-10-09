import { describe, expect, it } from "vitest";
import { readGroupEpoch } from "./groupEpoch";

describe("historical group encryption epoch parsing", () => {
  it("uses epoch one for legacy encrypted envelopes", () => {
    expect(readGroupEpoch('{"v":1,"iv":"x","data":"y"}')).toBe(1);
  });
  it("preserves valid historical epochs", () => {
    expect(readGroupEpoch('{"groupEpoch":2}')).toBe(2);
    expect(readGroupEpoch('{"groupEpoch":9007199254740991}')).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each(['null', '[]', '"invalid"', '{"groupEpoch":null}',
    '{"groupEpoch":0}', '{"groupEpoch":-1}', '{"groupEpoch":1.5}',
    '{"groupEpoch":"2"}', '{"groupEpoch":9007199254740992}', '{broken'])(
    "rejects invalid epoch envelope %s rather than falling back to the current key",
    input => expect(() => readGroupEpoch(input)).toThrow(),
  );
});
