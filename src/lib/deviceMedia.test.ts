import { describe, expect, it } from "vitest";
import { folderMedia, groupMedia, readLibraryPhoto, sortMedia, supportsMedia, type DeviceMedia } from "./deviceMedia";
const row = (id: string, name: string, extra: Partial<DeviceMedia> = {}): DeviceMedia => ({ id, name, uri: "content://media/external/video/media/1", mime: "video/mp4", folder: "Movies/", modified: 1000, size: 10, duration: 100, ...extra });
describe("device media organization", () => {
  it("preserves original nested folders and separates similarly named albums", () => {
    const rows = [row("1", "a.mp4", { folder: "Movies/Family/" }), row("2", "b.mp4", { folder: "Download/Family/" }), row("3", "c.mp4", { folder: "Movies/Family/" })];
    const grouped = groupMedia(rows, "folder"); expect(grouped.map(([name, items]) => [name, items.length])).toEqual([["Download/Family/", 1], ["Movies/Family/", 2]]);
  });
  it("groups music metadata and accounts for missing artist/album", () => {
    const rows = [row("1", "a.mp3", { album: "Soundtrack", artist: "Alice" }), row("2", "b.mp3", { album: "Soundtrack", artist: "<unknown>" })];
    expect(groupMedia(rows, "album")[0][1]).toHaveLength(2); expect(groupMedia(rows, "artist").map(([name]) => name)).toEqual(["Alice", "Unknown artist"]);
  });
  it("sorts names naturally and offers stable date/size/duration orders without changing source", () => {
    const rows = [row("1", "Movie 10.mp4", { modified: 1, size: 20, duration: 30 }), row("2", "Movie 2.mp4", { modified: 2, size: 10, duration: 40 })];
    expect(sortMedia(rows, "name")[0].id).toBe("2"); expect(sortMedia(rows, "newest")[0].id).toBe("2"); expect(sortMedia(rows, "oldest")[0].id).toBe("1"); expect(sortMedia(rows, "size")[0].id).toBe("1"); expect(sortMedia(rows, "duration")[0].id).toBe("2"); expect(rows[0].id).toBe("1");
  });
  it("filters directory imports to the current section, retaining relative folder paths", () => {
    const a = new File(["audio"], "song.flac", { type: "" }), b = new File(["photo"], "photo.png", { type: "image/png" });
    Object.defineProperty(a, "webkitRelativePath", { value: "Library/Music/song.flac" }); Object.defineProperty(b, "webkitRelativePath", { value: "Library/Photos/photo.png" });
    expect(folderMedia([a, b], "music").map(row => row.folder)).toEqual(["Library/Music"]);
    expect(supportsMedia({ name: "unsafe.svg", mime: "image/svg+xml" }, "photos")).toBe(false);
  });
  it("rejects oversized library photos before reading any bytes", async () => {
    await expect(readLibraryPhoto(row("1", "large.png", { size: 20_000_001 }), "unused", new AbortController().signal)).rejects.toThrow("20 MB");
  });
});
