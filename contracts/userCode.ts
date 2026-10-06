/** Server-scoped public directory code; the stored value is immutable through user APIs. */
export function userCode(code: string | null | undefined): string {
  if (code == null || code.length === 16 || code.length === 8) return "Code available after reconnecting";
  if (!/^[1-9][0-9]{3}$/.test(code)) throw new Error("Invalid LC code");
  return `LC-${code}`;
}
export function parseUserCode(query: string): string | null {
  const match = /^(?:LC-)?([1-9][0-9]{3})$/i.exec(query.trim());
  return match?.[1] ?? null;
}
