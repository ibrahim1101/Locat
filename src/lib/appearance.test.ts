import { afterEach, expect, it, vi } from "vitest";
import { getAppearance, parseAppearance, setAppearance, startAppearance } from "./appearance";

afterEach(() => vi.unstubAllGlobals());
it("rejects unknown stored choices and preserves supported legacy modes", () => {
  expect(parseAppearance("invalid", "invalid")).toEqual({ theme: "dark", accent: "titanium" });
  expect(parseAppearance(null, null)).toEqual({ theme: "dark", accent: "olive" });
  expect(parseAppearance("dark", "teal")).toEqual({ theme: "dark", accent: "teal" });
  expect(parseAppearance("dark", "titanium")).toEqual({ theme: "dark", accent: "titanium" });
  expect(parseAppearance("light", "olive")).toEqual({ theme: "light", accent: "olive" });
  expect(parseAppearance("system", "rose")).toEqual({ theme: "system", accent: "rose" });
});
it("tracks system appearance outside Settings, cross-tab updates and blocked storage", () => {
  const values = new Map<string, string>([["locat-theme", "system"]]);
  const store = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
  const media = Object.assign(new EventTarget(), { matches: true });
  const browser = Object.assign(new EventTarget(), { matchMedia: () => media });
  const root = { dataset: {} as Record<string, string>, classList: { toggle: vi.fn() } };
  const meta = { setAttribute: vi.fn() };
  vi.stubGlobal("window", browser); vi.stubGlobal("document", { documentElement: root, querySelector: () => meta }); vi.stubGlobal("localStorage", store);
  const stop = startAppearance();
  expect(root.dataset.theme).toBe("dark");
  media.matches = false; media.dispatchEvent(new Event("change"));
  expect(root.dataset.theme).toBe("light");
  expect(root.classList.toggle).toHaveBeenLastCalledWith("dark", false);
  expect(setAppearance({ theme: "dark", accent: "violet" })).toBe(true);
  media.dispatchEvent(new Event("change")); expect(root.dataset.theme).toBe("dark");
  expect(values.get("locat-accent")).toBe("violet");
  values.set("locat-theme", "light"); values.set("locat-accent", "blue");
  browser.dispatchEvent(Object.assign(new Event("storage"), { key: "locat-theme" }));
  expect(getAppearance()).toEqual({ theme: "light", accent: "blue" });
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } });
  expect(setAppearance({ theme: "system", accent: "rose" })).toBe(false);
  expect(root.dataset).toEqual({ theme: "light", accent: "rose" });
  stop(); media.matches = true; media.dispatchEvent(new Event("change"));
  expect(root.dataset.theme).toBe("light");
});
