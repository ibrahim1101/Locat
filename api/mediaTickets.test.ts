import { describe, it, expect } from "vitest";
import { MediaTickets, mediaAuthRequest } from "./mediaTickets";
describe("scoped native playback tickets", () => {
  it("binds each unpredictable ticket to one media item and library", () => {
    const tickets = new MediaTickets(() => 100);
    const token = tickets.issue("private-session", 2, "file");
    expect(token).not.toContain("private-session");
    expect(tickets.resolve(token, "2", "file")).toBe("private-session");
    expect(tickets.resolve(token, "1", "file")).toBeUndefined();
    expect(tickets.resolve(token, "2", "other")).toBeUndefined();
    expect(tickets.resolve("fake", "2", "file")).toBeUndefined();
  });
  it("expires tickets", () => {
    let now = 0; const tickets = new MediaTickets(() => now); const token = tickets.issue("session",0,"file");
    now=30*60_000; expect(tickets.resolve(token,"0","file")).toBeUndefined();
  });
  it("does not fall back to cookies or bearer credentials for a bad ticket", () => {
    const req = new Request("https://host/api/media/stream?ticket=bad&library=0&id=file", {headers:{cookie:"rc_session=secret",authorization:"Bearer secret"}});
    const scoped=mediaAuthRequest(req);expect(scoped.headers.has("cookie")).toBe(false);expect(scoped.headers.has("authorization")).toBe(false);
  });
  it("bounds active ticket count", () => {
    const tickets=new MediaTickets(()=>0);for(let i=0;i<1024;i++)tickets.issue("session",0,String(i));
    expect(()=>tickets.issue("session",0,"extra")).toThrow("capacity");
  });
});
