import { describe, expect, it } from "vitest";
import { parsePlaybackProgress, playbackFileId, resumePosition, updatePlaybackProgress } from "./playbackProgress";
const id = "a".repeat(64);
describe("device-local movie progress", () => {
  it("rejects malformed and unbounded saved state", () => {
    expect(parsePlaybackProgress("broken")).toEqual([]);
    expect(parsePlaybackProgress(JSON.stringify([{ id, position: -1, duration: 10, updatedAt: 1 }, { id: "filename.mp4", position: 2, duration: 10, updatedAt: 1 }]))).toEqual([]);
    expect(parsePlaybackProgress(" ".repeat(100001))).toEqual([]);
  });
  it("caps entries and keeps the newest duplicate", () => {
    const rows = Array.from({ length: 205 }, (_, index) => ({ id: index.toString(16).padStart(64, "0"), position: 4, duration: 100, updatedAt: index }));
    const parsed = parsePlaybackProgress(JSON.stringify([...rows, { ...rows[204], position: 8, updatedAt: 300 }]));
    expect(parsed).toHaveLength(200); expect(parsed.at(-1)?.position).toBe(8); expect(parsed[0].updatedAt).toBe(5);
  });
  it("resumes matching durations and restarts completed or changed files", () => {
    const checkpoint = { id, position: 45, duration: 100, updatedAt: 1 };
    expect(resumePosition(checkpoint, 100)).toBe(45);
    expect(resumePosition(checkpoint, 150)).toBe(0);
    expect(resumePosition({ ...checkpoint, position: 99 }, 100)).toBe(0);
    expect(resumePosition(checkpoint, Infinity)).toBe(0);
  });
  it("removes restarted/completed positions and ignores invalid events", () => {
    const rows = updatePlaybackProgress([], id, 40, 100, 1);
    expect(updatePlaybackProgress(rows, id, 0, 100)).toEqual([]);
    expect(updatePlaybackProgress(rows, id, 100, 100)).toEqual([]);
    expect(updatePlaybackProgress(rows, id, NaN, 100)).toEqual(rows);
  });
  it("matches stable file metadata without persisting plaintext filenames", async () => {
    const file = { name: "private movie.mp4", size: 999, lastModified: 100 };
    const key = await playbackFileId(file);
    expect(key).toMatch(/^[a-f0-9]{64}$/); expect(await playbackFileId(file)).toBe(key);
    expect(await playbackFileId({ ...file, lastModified: 101 })).not.toBe(key);
  });
});
