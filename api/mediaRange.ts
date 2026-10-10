/** RFC 7233 single byte-range parser. A missing range means a full response. */
export function parseMediaRange(range: string | null, size: number):
  | { status: 200 | 206; start: number; end: number }
  | { status: 416 } {
  if (!Number.isSafeInteger(size) || size < 0) return { status: 416 };
  if (!range) return { status: 200, start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2]) || size === 0) return { status: 416 };
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { status: 416 };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return { status: 416 };
  return { status: 206, start, end: Math.min(end, size - 1) };
}
