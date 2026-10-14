import { describe, expect, it } from "vitest";
import { popNativeRoute, recordNativeRoute } from "./nativeBackHistory";

describe("native Android Back history", () => {
  it("walks back through pages in reverse order", () => {
    const history: string[] = [];
    for (const route of ["/", "/cinema", "/music", "/photos"]) recordNativeRoute(history, route);
    expect(popNativeRoute(history, "/photos")).toBe("/music");
    expect(popNativeRoute(history, "/music")).toBe("/cinema");
    expect(popNativeRoute(history, "/cinema")).toBe("/");
    expect(popNativeRoute(history, "/")).toBeNull();
  });

  it("treats dashboard navigation as a fresh root", () => {
    const history = ["/", "/cinema", "/music"];
    recordNativeRoute(history, "/dashboard");
    expect(history).toEqual(["/dashboard"]);
    expect(popNativeRoute(history, "/dashboard")).toBeNull();
    recordNativeRoute(history, "/photos");
    expect(popNativeRoute(history, "/photos")).toBe("/dashboard");
  });

  it("truncates forward history when revisiting a page", () => {
    const history = ["/", "/cinema", "/music", "/photos"];
    recordNativeRoute(history, "/cinema");
    expect(history).toEqual(["/", "/cinema"]);
    recordNativeRoute(history, "/music");
    expect(history).toEqual(["/", "/cinema", "/music"]);
  });

  it("does not duplicate a route and returns to root from a deep link", () => {
    const history: string[] = [];
    recordNativeRoute(history, "/music");
    recordNativeRoute(history, "/music");
    expect(history).toEqual(["/music"]);
    expect(popNativeRoute(history, "/music")).toBe("/");
    expect(history).toEqual(["/"]);
  });

  it("preserves query-string navigation as distinct history entries", () => {
    const history = ["/", "/search?q=one"];
    recordNativeRoute(history, "/search?q=two");
    expect(popNativeRoute(history, "/search?q=two")).toBe("/search?q=one");
  });
});
