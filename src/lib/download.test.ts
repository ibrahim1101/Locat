import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download";

describe("downloadBlob", () => {
  let values: Map<string, string>;
  let click: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    values = new Map();
    click = vi.fn();
    remove = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {
      createElement: () => ({ href: "", download: "", click, remove }),
      body: { append: vi.fn() },
    });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("writes encrypted exports to the selected Android folder", async () => {
    const writeFile = vi.fn(async () => ({ uri: "content://saved" }));
    Object.assign(window, { LocatStorage: { writeFile } });
    localStorage.setItem("locat-storage-mode", "user-folder");
    localStorage.setItem("locat-storage-tree", "content://tree/primary%3ALocat");

    await expect(downloadBlob(new Blob(["secret"], { type: "application/json" }), "backup.locat"))
      .resolves.toBe("selected-folder");
    expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({
      name: "backup.locat", mime: "application/json", dataB64: "c2VjcmV0",
    }));
    expect(click).not.toHaveBeenCalled();
  });

  it("uses browser downloads when no Android folder is selected", async () => {
    await expect(downloadBlob(new Blob(["backup"]), "backup.locat")).resolves.toBe("browser");
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("fails closed when selected-folder access is revoked", async () => {
    Object.assign(window, { LocatStorage: { writeFile: vi.fn(async () => { throw new Error("revoked"); }) } });
    localStorage.setItem("locat-storage-mode", "user-folder");
    localStorage.setItem("locat-storage-tree", "content://tree/revoked");

    await expect(downloadBlob(new Blob(["backup"]), "backup.locat"))
      .rejects.toThrow("choose the folder again");
    expect(click).not.toHaveBeenCalled();
  });
});
