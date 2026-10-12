import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MODULES } from "../src/modules/registry";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("original Locat chat-first navigation", () => {
  it("opens messaging by default and retains an explicit optional dashboard", () => {
    const app = source("src/App.tsx");
    expect(app).toContain('<Route path="/" element={<Chat />} />');
    expect(app).toContain('<Route path="/messages" element={<Chat />} />');
    expect(app).toContain('<Route path="/dashboard" element={<Dashboard />} />');
    expect(app).toContain('<Route path="*" element={<Chat />} />');
  });

  it("keeps messages first, with a separate reachable module explorer", () => {
    const primary = MODULES.filter(m => m.primary);
    expect(primary[0]?.id).toBe("messages");
    expect(primary.find(m => m.id === "messages")?.route).toBe("/messages");
    expect(primary.find(m => m.id === "dashboard")?.route).toBe("/dashboard");
    expect(MODULES.filter(m => m.status === "planned").every(m => !m.primary)).toBe(true);
  });

  it("highlights root messaging and labels the optional dashboard honestly", () => {
    const nav = source("src/components/shell/MobileBottomNav.tsx");
    expect(nav).toContain('id === "messages" && location.pathname === "/"');
    expect(nav).toContain('m.id === "dashboard" ? "Modules" : m.name');
    expect(source("src/pages/MediaLocal.tsx")).toContain('Messages</Link>');
  });
});
