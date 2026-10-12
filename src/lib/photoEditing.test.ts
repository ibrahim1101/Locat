import { expect, it } from "vitest";
import { defaultPhotoEdit, photoFilter } from "./photoEditing";
it("defaults to neutral non-destructive filters and independent histories", () => {
  const first = defaultPhotoEdit(), second = defaultPhotoEdit();
  expect(photoFilter(first)).toBe("brightness(100%) contrast(100%) saturate(100%) grayscale(0%) blur(0px)");
  first.geometry.turns = 1; first.strokes.push({ color: "#fff", size: 1, points: [] });
  expect(second.geometry.turns).toBe(0); expect(second.strokes).toEqual([]);
});
it("rejects invalid adjustment ranges before rendering", () => {
  expect(() => photoFilter({ ...defaultPhotoEdit(), blur: 11 })).toThrow("Invalid photo");
  expect(() => photoFilter({ ...defaultPhotoEdit(), brightness: NaN })).toThrow("Invalid photo");
  expect(() => photoFilter({ ...defaultPhotoEdit(), saturation: -1 })).toThrow("Invalid photo");
});
