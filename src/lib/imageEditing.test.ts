import { describe, expect, it, vi } from "vitest";
import { DEFAULT_IMAGE_EDIT, editedImageFile, imageCropRect, imageStageSize } from "./imageEditing";
describe("attachment picture editing", () => {
  it("bounds the longest edge and swaps dimensions for quarter turns", () => {
    expect(imageStageSize(3200, 2400, 1)).toEqual({ baseWidth: 1600, baseHeight: 1200, width: 1200, height: 1600 });
    expect(imageStageSize(320, 240, 2).width).toBe(320);
    expect(() => imageStageSize(0, 240, 0)).toThrow();
    expect(() => imageStageSize(320, 240, 4)).toThrow();
  });
  it("centers preset crops and keeps zoomed corner positioning inside the image", () => {
    expect(imageCropRect(600, 400, { ...DEFAULT_IMAGE_EDIT, crop: "square" })).toEqual({ x: 100, y: 0, width: 400, height: 400 });
    for (const crop of ["original", "square", "portrait", "wide"] as const) {
      const rect = imageCropRect(600, 400, { ...DEFAULT_IMAGE_EDIT, crop, zoom: 3, x: 1, y: 1 });
      expect(rect.x + rect.width).toBeCloseTo(600); expect(rect.y + rect.height).toBeCloseTo(400);
      expect(rect.width).toBeGreaterThan(0); expect(rect.height).toBeGreaterThan(0);
    }
    expect(() => imageCropRect(600, 400, { ...DEFAULT_IMAGE_EDIT, zoom: NaN })).toThrow();
    expect(() => imageCropRect(600, 400, { ...DEFAULT_IMAGE_EDIT, x: 2 })).toThrow();
  });
  it("exports a new JPEG file, reducing quality within the attachment bound", async () => {
    const toBlob = vi.fn((callback: BlobCallback, _type?: string, quality?: number) => callback(new Blob([quality === .9 ? new Uint8Array(2_900_001) : "small"], { type: "image/jpeg" })));
    const file = await editedImageFile({ toBlob } as unknown as HTMLCanvasElement, "photo.png");
    expect(file.name).toBe("photo-edited.jpg"); expect(file.type).toBe("image/jpeg"); expect(file.size).toBeLessThan(2_900_000);
    expect(toBlob).toHaveBeenCalledTimes(2);
    await expect(editedImageFile({ toBlob: (callback: BlobCallback) => callback(null) } as HTMLCanvasElement, "x")).rejects.toThrow("export");
  });
});
