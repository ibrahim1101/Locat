import { expect, it } from "vitest";
import { nextMusicIndex, parseMusicFavorites } from "./musicQueue";
it("advances stops repeats and shuffles without selecting the current track", () => {
  expect(nextMusicIndex(1, 3, "off", false)).toBe(2);
  expect(nextMusicIndex(2, 3, "off", false)).toBeNull();
  expect(nextMusicIndex(2, 3, "all", false)).toBe(0);
  expect(nextMusicIndex(1, 3, "one", true)).toBe(1);
  expect(nextMusicIndex(1, 3, "off", true, () => 0)).toBe(2);
  expect(nextMusicIndex(1, 3, "off", true, () => 0.99)).toBe(0);
  expect(nextMusicIndex(0, 1, "off", true)).toBeNull();
});
it("bounds favorites and rejects invalid persistent metadata", () => {
  expect(parseMusicFavorites('["track","track",42,null]')).toEqual(["track"]);
  expect(parseMusicFavorites("invalid")).toEqual([]);
});
