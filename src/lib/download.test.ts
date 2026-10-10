import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, type DownloadDependencies } from "./download";

function testDependencies(saveSelected: DownloadDependencies["saveSelected"]) {
  const click = vi.fn();
  const remove = vi.fn();
  const link = { href: "", download: "", click, remove };
  const revokeObjectURL = vi.fn();
  let scheduled: (() => void) | undefined;
  const dependencies: DownloadDependencies = {
    saveSelected,
    isNativeShell: () => false,
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL,
    createLink: vi.fn(() => link),
    appendLink: vi.fn(),
    schedule: vi.fn((callback) => { scheduled = callback; }),
  };
  return { dependencies, click, remove, link, revokeObjectURL, runScheduled: () => scheduled?.() };
}

describe("downloadBlob", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("writes encrypted exports to the selected Android folder", async () => {
    const saveSelected = vi.fn(async () => true);
    const fixture = testDependencies(saveSelected);

    await expect(downloadBlob(
      new Blob(["secret"], { type: "application/json" }),
      "backup.locat",
      fixture.dependencies,
    )).resolves.toBe("selected-folder");
    expect(saveSelected).toHaveBeenCalledWith("backup.locat", "application/json", "c2VjcmV0");
    expect(fixture.click).not.toHaveBeenCalled();
  });

  it("uses browser downloads when no Android folder is selected", async () => {
    const fixture = testDependencies(vi.fn(async () => false));

    await expect(downloadBlob(new Blob(["backup"]), "backup.locat", fixture.dependencies))
      .resolves.toBe("browser");
    expect(fixture.link.download).toBe("backup.locat");
    expect(fixture.click).toHaveBeenCalledOnce();
    expect(fixture.remove).toHaveBeenCalledOnce();
    expect(fixture.revokeObjectURL).not.toHaveBeenCalled();
    fixture.runScheduled();
    expect(fixture.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("does not report a successful browser download inside native Android", async () => {
    const fixture = testDependencies(vi.fn(async () => false));
    fixture.dependencies.isNativeShell = () => true;
    await expect(downloadBlob(new Blob(["backup"]), "backup.locat", fixture.dependencies))
      .rejects.toThrow("No file was saved");
    expect(fixture.click).not.toHaveBeenCalled();
    expect(fixture.dependencies.createObjectURL).not.toHaveBeenCalled();
  });

  it("fails closed when selected-folder access is revoked", async () => {
    const fixture = testDependencies(vi.fn(async () => { throw new Error("revoked"); }));

    await expect(downloadBlob(new Blob(["backup"]), "backup.locat", fixture.dependencies))
      .rejects.toThrow("choose the folder again");
    expect(fixture.click).not.toHaveBeenCalled();
  });
  it("asks before re-downloading a previously saved native attachment", async () => {
    const stored = new Map<string, string>();
    const confirm = vi.fn(() => false);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
    });
    vi.stubGlobal("window", { confirm, dispatchEvent: vi.fn() });
    vi.stubGlobal("CustomEvent", class {
      constructor() {}
    });
    const saveSelected = vi.fn(async () => true);
    const fixture = testDependencies(saveSelected);
    fixture.dependencies.isNativeShell = () => true;
    const filename = "duplicate-test-unique-image.png";
    const blob = new Blob(["image"], { type: "image/png" });

    await expect(downloadBlob(blob, filename, fixture.dependencies)).resolves.toBe("selected-folder");
    expect(saveSelected).toHaveBeenCalledTimes(1);

    await expect(downloadBlob(blob, filename, fixture.dependencies)).resolves.toBe("cancelled");
    expect(confirm).toHaveBeenCalledOnce();
    expect(saveSelected).toHaveBeenCalledTimes(1);

    confirm.mockReturnValue(true);
    await expect(downloadBlob(blob, filename, fixture.dependencies)).resolves.toBe("selected-folder");
    expect(saveSelected).toHaveBeenCalledTimes(2);
  });

  it("does not treat browser downloads as native saved history", async () => {
    const stored = new Map<string, string>();
    const confirm = vi.fn(() => false);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
    });
    vi.stubGlobal("window", { confirm, dispatchEvent: vi.fn() });
    vi.stubGlobal("CustomEvent", class {
      constructor() {}
    });
    const fixture = testDependencies(vi.fn(async () => false));
    const filename = "browser-only-unique-image.png";
    const blob = new Blob(["image"], { type: "image/png" });

    await expect(downloadBlob(blob, filename, fixture.dependencies)).resolves.toBe("browser");
    expect(confirm).not.toHaveBeenCalled();
    expect(stored.size).toBe(0);
  });

  it("coalesces simultaneous saves of the same attachment into one operation", async () => {
    let finishSave: ((value: boolean) => void) | undefined;
    const saveSelected = vi.fn(() => new Promise<boolean>((resolve) => { finishSave = resolve; }));
    const fixture = testDependencies(saveSelected);
    const blob = new Blob(["same-attachment"], { type: "text/plain" });
    const first = downloadBlob(blob, "parallel-download-test.txt", fixture.dependencies);
    const second = downloadBlob(blob, "parallel-download-test.txt", fixture.dependencies);

    expect(second).toBe(first);
    await vi.waitFor(() => expect(saveSelected).toHaveBeenCalledOnce());
    expect(finishSave).toBeDefined();
    finishSave?.(true);
    await expect(first).resolves.toBe("selected-folder");
    await expect(second).resolves.toBe("selected-folder");
    expect(saveSelected).toHaveBeenCalledTimes(1);
  });

  it("allows retry after a failed attachment save", async () => {
    const saveSelected = vi.fn()
      .mockRejectedValueOnce(new Error("permission revoked"))
      .mockResolvedValueOnce(true);
    const fixture = testDependencies(saveSelected);
    const blob = new Blob(["retry"], { type: "text/plain" });
    const filename = "retry-after-failure-test.txt";

    await expect(downloadBlob(blob, filename, fixture.dependencies))
      .rejects.toThrow("choose the folder again");
    await expect(downloadBlob(blob, filename, fixture.dependencies))
      .resolves.toBe("selected-folder");
    expect(saveSelected).toHaveBeenCalledTimes(2);
  });

  it("does not record a failed native save as previously downloaded", async () => {
    const stored = new Map<string, string>();
    const confirm = vi.fn(() => false);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
    });
    vi.stubGlobal("window", { confirm, dispatchEvent: vi.fn() });
    vi.stubGlobal("CustomEvent", class {
      constructor() {}
    });
    const saveSelected = vi.fn()
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockResolvedValueOnce(true);
    const fixture = testDependencies(saveSelected);
    fixture.dependencies.isNativeShell = () => true;
    const blob = new Blob(["failed-then-success"], { type: "text/plain" });
    const filename = "failed-history-native-test.txt";

    await expect(downloadBlob(blob, filename, fixture.dependencies))
      .rejects.toThrow("choose the folder again");
    expect(stored.size).toBe(0);
    await expect(downloadBlob(blob, filename, fixture.dependencies))
      .resolves.toBe("selected-folder");
    expect(confirm).not.toHaveBeenCalled();
    expect(saveSelected).toHaveBeenCalledTimes(2);
    expect(stored.size).toBe(1);
  });

  it("does not dispatch a new save event when a repeat download is declined", async () => {
    const stored = new Map<string, string>();
    const confirm = vi.fn(() => false);
    const dispatchEvent = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
    });
    vi.stubGlobal("window", { confirm, dispatchEvent });
    vi.stubGlobal("CustomEvent", class {
      constructor() {}
    });
    const saveSelected = vi.fn(async () => true);
    const fixture = testDependencies(saveSelected);
    fixture.dependencies.isNativeShell = () => true;
    const blob = new Blob(["declined-save"], { type: "text/plain" });
    const filename = "declined-event-test.txt";

    await expect(downloadBlob(blob, filename, fixture.dependencies))
      .resolves.toBe("selected-folder");
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    dispatchEvent.mockClear();

    await expect(downloadBlob(blob, filename, fixture.dependencies))
      .resolves.toBe("cancelled");
    expect(confirm).toHaveBeenCalledOnce();
    expect(saveSelected).toHaveBeenCalledTimes(1);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("does not coalesce distinct blobs with identical filename, size and MIME type", async () => {
    const resolvers: Array<(value: boolean) => void> = [];
    const saveSelected = vi.fn((...args: [string, string, string]) => {
      void args;
      return new Promise<boolean>((resolve) => { resolvers.push(resolve); });
    });
    const fixture = testDependencies(saveSelected);
    const firstBlob = new Blob(["AAAA"], { type: "text/plain" });
    const secondBlob = new Blob(["BBBB"], { type: "text/plain" });
    const first = downloadBlob(firstBlob, "same-metadata.txt", fixture.dependencies);
    const second = downloadBlob(secondBlob, "same-metadata.txt", fixture.dependencies);

    expect(first).not.toBe(second);
    await vi.waitFor(() => expect(saveSelected).toHaveBeenCalledTimes(2));
    expect(saveSelected.mock.calls[0]?.[2]).toBe("QUFBQQ==");
    expect(saveSelected.mock.calls[1]?.[2]).toBe("QkJCQg==");
    resolvers.forEach((resolve) => resolve(true));
    await expect(Promise.all([first, second])).resolves.toEqual(["selected-folder", "selected-folder"]);
  });

});
