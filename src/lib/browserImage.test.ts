import { afterEach, expect, it, vi } from "vitest";
import { decodeBrowserImage } from "./browserImage";
import { downloadBlob } from "./download";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

it("uses an image element when a mobile ImageBitmap decoder rejects the file", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("Unsupported decoder")));
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fixture");
  vi.stubGlobal("Image", class {
    naturalWidth = 320; naturalHeight = 240;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  const decoded = await decodeBrowserImage(new File(["fixture"], "photo.jpg", { type: "image/jpeg" }));
  expect(decoded.width).toBe(320); expect(decoded.height).toBe(240);
  expect(revoke).not.toHaveBeenCalled(); decoded.close();
  expect(revoke).toHaveBeenCalledWith("blob:fixture");
});

it("supports browsers without ImageBitmap and reports a decode error with cleanup", async () => {
  vi.stubGlobal("createImageBitmap", undefined);
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:broken");
  vi.stubGlobal("Image", class {
    onerror?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
  });
  await expect(decodeBrowserImage(new File(["broken"], "photo.jpg"))).rejects.toThrow("could not read");
  expect(revoke).toHaveBeenCalledWith("blob:broken");
});

it("keeps a download URL alive until the mobile download manager can consume it", async () => {
  vi.useFakeTimers();
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:download");
  let attached = false;
  const link = { href: "", download: "", click: vi.fn(() => expect(attached).toBe(true)), remove: vi.fn() };
  vi.stubGlobal("document", { createElement: () => link, body: { append: () => { attached = true; } } });
  await downloadBlob(new Blob(["photo"]), "profile.jpg");
  expect(link.download).toBe("profile.jpg"); expect(link.click).toHaveBeenCalled();
  vi.advanceTimersByTime(1000); expect(revoke).not.toHaveBeenCalled();
  vi.advanceTimersByTime(59_000); expect(revoke).toHaveBeenCalledWith("blob:download");
});
