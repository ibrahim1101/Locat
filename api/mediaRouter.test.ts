import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanRoot } from "./mediaRouter";

const roots: string[] = [];
async function library() {
  const root = await mkdtemp(path.join(tmpdir(), "locat-media-test-"));
  roots.push(root);
  return realpath(root);
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});
describe("authorized server media scanning", () => {
  it("indexes photos, music and video separately with safe relative identifiers", async () => {
    const root = await library();
    await mkdir(path.join(root, "album"));
    for (const file of ["album/photo.jpg", "album/track.flac", "album/movie.mp4", "album/script.js"]) {
      await writeFile(path.join(root, file), "fixture");
    }
    for (const [kind, expected] of [["photos", "photo.jpg"], ["music", "track.flac"], ["cinema", "movie.mp4"]] as const) {
      const found = await scanRoot(root, kind);
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe(expected);
      expect(Buffer.from(found[0].id, "base64url").toString("utf8")).toBe(`album/${expected}`);
    }
  });
  it("does not follow symlinks into folders outside the authorized root", async () => {
    const root = await library();
    const outside = await library();
    await writeFile(path.join(outside, "private.jpg"), "private");
    await symlink(outside, path.join(root, "external"), "dir");
    expect(await scanRoot(root, "photos")).toEqual([]);
  });
  it("does not include unsupported extensions", async () => {
    const root = await library();
    await writeFile(path.join(root, "unsafe.svg"), "<svg/>");
    await writeFile(path.join(root, "notes.txt"), "notes");
    expect(await scanRoot(root, "photos")).toEqual([]);
  });
});
