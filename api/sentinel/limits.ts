/** Request-size limits for the Sentinel webhook, measured in real UTF-8 bytes
 * (not JavaScript UTF-16 string length — a multibyte payload can be far larger
 * in bytes than its `.length`). */
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

/** UTF-8 byte length of a string, using TextEncoder when available (browsers,
 * workers, modern Node) and falling back to Buffer on older runtimes. */
export function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
  return Buffer.byteLength(value, "utf8");
}

/** True when the string exceeds the byte limit. */
export function exceedsByteLimit(value: string, limit: number = MAX_WEBHOOK_BODY_BYTES): boolean {
  return utf8ByteLength(value) > limit;
}

/** Parse a Content-Length header to a non-negative integer, or null if absent/invalid. */
export function parseContentLength(header: string | undefined | null): number | null {
  if (!header) return null;
  const n = Number(header);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
