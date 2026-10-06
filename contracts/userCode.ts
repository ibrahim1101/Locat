/** Shareable directory code, scoped to one Locat server; not a secret. */
export function userCode(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid account ID");
  return `LC-${id}`;
}

/** Exact code lookup avoids treating numeric usernames as account IDs. */
export function parseUserCode(query: string): number | null {
  const match = /^LC-([1-9][0-9]*)$/i.exec(query.trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}
