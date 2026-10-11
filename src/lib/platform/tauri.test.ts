import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: mocks.open }));
import { tauriAdapter } from "./tauri";
describe("desktop adapter contracts without native execution", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("saves bytes only through the consent-dialog command", async () => {
    mocks.invoke.mockResolvedValue("selected-file.txt");
    expect(await tauriAdapter.saveBlob(new Blob(["abc"]), "file.txt")).toEqual({destination:"user-chosen",path:"selected-file.txt"});
    expect(mocks.invoke).toHaveBeenCalledWith("save_attachment",{filename:"file.txt",data:[97,98,99]});
  });
  it("reports cancellation without claiming a save", async () => {
    mocks.invoke.mockResolvedValue(null);
    await expect(tauriAdapter.saveBlob(new Blob(["abc"]),"file.txt")).rejects.toThrow("cancelled");
  });
  it("rejects oversized attachments before invoking native code", async () => {
    const oversized = {size:128*1024*1024+1} as Blob;
    await expect(tauriAdapter.saveBlob(oversized,"large.bin")).rejects.toThrow("128 MiB");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("rejects dangerous and credential-bearing URLs", async () => {
    for(const url of ["file:///etc/passwd","javascript:alert(1)","http://host","https://user:pass@host"])
      await expect(tauriAdapter.openExternal(url)).rejects.toThrow();
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("opens HTTPS only", async () => {
    await tauriAdapter.openExternal("https://example.org/path");
    expect(mocks.open).toHaveBeenCalledWith("https://example.org/path");
  });
});
