import { describe, expect, it } from "vitest";
import { evaluateFeatureAvailability } from "./featureAvailability";

describe("UI-independent feature availability", () => {
  it("exposes local beta features without a server", () => {
    expect(evaluateFeatureAvailability(
      { status: "beta", requiresServer: false },
      { connected: false, isAdmin: false },
    )).toEqual({ enabled: true, status: "beta", reason: null });
  });

  it("blocks server-only modules while disconnected", () => {
    expect(evaluateFeatureAvailability(
      { status: "available", requiresServer: true },
      { connected: false, isAdmin: false },
    )).toEqual({ enabled: false, status: "available", reason: "Connect to server" });
  });

  it("permits server-only modules once connected", () => {
    expect(evaluateFeatureAvailability(
      { status: "available", requiresServer: true },
      { connected: true, isAdmin: false },
    ).enabled).toBe(true);
  });

  it("blocks admin-only features even when connected", () => {
    expect(evaluateFeatureAvailability(
      { status: "beta", requiresServer: true, adminOnly: true },
      { connected: true, isAdmin: false },
    ).reason).toBe("Administrator access required");
  });

  it("permits an admin when the server is connected", () => {
    expect(evaluateFeatureAvailability(
      { status: "beta", requiresServer: true, adminOnly: true },
      { connected: true, isAdmin: true },
    ).enabled).toBe(true);
  });

  it("never exposes planned modules as operational", () => {
    expect(evaluateFeatureAvailability(
      { status: "planned", requiresServer: false },
      { connected: true, isAdmin: true },
    )).toEqual({ enabled: false, status: "planned", reason: "Not implemented yet" });
  });

  it("prioritizes planned and administrator states over connectivity", () => {
    expect(evaluateFeatureAvailability(
      { status: "planned", requiresServer: true, adminOnly: true },
      { connected: false, isAdmin: false },
    ).reason).toBe("Not implemented yet");
    expect(evaluateFeatureAvailability(
      { status: "available", requiresServer: true, adminOnly: true },
      { connected: false, isAdmin: false },
    ).reason).toBe("Administrator access required");
  });
});
