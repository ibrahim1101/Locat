import { describe, expect, it, vi } from "vitest";
import { downloadBlob, type DownloadDependencies } from "./download";

function testDependencies(saveSelected: DownloadDependencies["saveSelected"]) {
  const click = vi.fn();
  const remove = vi.fn();
  const link = { href: "", download: "", click, remove };
  const revokeObjectURL = vi.fn();
  let scheduled: (() => void) | undefined;
  const dependencies: DownloadDependencies = {
    saveSelected,
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL,
    createLink: vi.fn(() => link),
    appendLink: vi.fn(),
    schedule: vi.fn((callback) => { scheduled = callback; }),
  };
  return { dependencies, click, remove, link, revokeObjectURL, runScheduled: () => scheduled?.() };
}

describe("downloadBlob", () => {
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

  it("fails closed when selected-folder access is revoked", async () => {
    const fixture = testDependencies(vi.fn(async () => { throw new Error("revoked"); }));

    await expect(downloadBlob(new Blob(["backup"]), "backup.locat", fixture.dependencies))
      .rejects.toThrow("choose the folder again");
    expect(fixture.click).not.toHaveBeenCalled();
  });
});
