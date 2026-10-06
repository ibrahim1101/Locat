import { expect, it } from "vitest";
import { parseUserCode, userCode } from "@contracts/userCode";
it("preserves long numeric codes as strings", () => {
  const code = "9876543210123456";
  expect(parseUserCode(userCode(code))).toBe(code);
  expect(parseUserCode(code)).toBe(code);
  expect(parseUserCode(` lc-${code} `)).toBe(code);
});
it("rejects short, sequential and malformed codes", () => {
  for (const query of ["1", "LC-42", "LC-0123456789012345", "LC--1", "LC-1.5", "LC-4%", "LC-4_", "LC-"]) expect(parseUserCode(query)).toBeNull();
  expect(() => userCode("1")).toThrow();
});
