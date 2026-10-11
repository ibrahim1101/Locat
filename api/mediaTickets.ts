import { randomBytes } from "node:crypto";

/** Narrow playback capabilities for native media elements which cannot attach headers. */
export class MediaTickets {
  private tickets = new Map<string, { session: string; library: number; id: string; expires: number }>();
  private clock: () => number;
  constructor(clock = Date.now) { this.clock = clock; }
  issue(session: string, library: number, id: string): string {
    for (const [key, value] of this.tickets) if (value.expires <= this.clock()) this.tickets.delete(key);
    if (this.tickets.size >= 1024) throw new Error("Playback ticket capacity reached");
    const ticket = randomBytes(32).toString("base64url");
    this.tickets.set(ticket, { session, library, id, expires: this.clock() + 30 * 60_000 });
    return ticket;
  }
  resolve(ticket: string, library: string | null, id: string | null): string | undefined {
    const value = this.tickets.get(ticket);
    if (!value || value.expires <= this.clock() || String(value.library) !== library || value.id !== id) return undefined;
    value.expires = this.clock() + 30 * 60_000;
    return value.session;
  }
}
export const mediaTickets = new MediaTickets();
/** The original session is still revalidated by createContext on every media request. */
export function mediaAuthRequest(req: Request): Request {
  const url = new URL(req.url), ticket = url.searchParams.get("ticket");
  if (!ticket) return req;
  const session = mediaTickets.resolve(ticket, url.searchParams.get("library"), url.searchParams.get("id"));
  const headers = new Headers(req.headers);
  headers.delete("cookie"); headers.delete("authorization");
  if (session) headers.set("authorization", `Bearer ${session}`);
  // Context only needs URL and headers, not the potentially streaming request body.
  return new Request(req.url, { headers, signal: req.signal });
}
