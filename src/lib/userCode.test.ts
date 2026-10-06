import { expect, it } from "vitest";
import { parseUserCode, userCode } from "@contracts/userCode";

it("round-trips server-scoped account codes", () => {
  for (const id of [1, 42, Number.MAX_SAFE_INTEGER]) expect(parseUserCode(userCode(id))).toBe(id);
  expect(parseUserCode(" lc-42 ")).toBe(42);
});
it("rejects ambiguous and unsafe codes", () => {
  for (const query of ["42", "LC-0", "LC-01", "LC--1", "LC-1.5", "LC-9007199254740992", "LC-4%", "LC-4_", "LC-"]) expect(parseUserCode(query)).toBeNull();
  expect(() => userCode(-1)).toThrow();
});
