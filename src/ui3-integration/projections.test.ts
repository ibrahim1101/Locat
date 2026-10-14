import { describe, expect, it } from "vitest";
import { MODULES } from "../modules/registry";
import { projectUi3ModuleAvailability, projectUi3SessionUser } from "./projections";

describe("UI 3.0 live projections", () => {
  it("projects session display fields without keys or credentials", () => {
    const user = {
      id: 42, username: "sample", displayName: "Sample", lcCode: "LC-0042",
      avatar: null, isAdmin: false, publicKey: "must-not-expose",
    } as Parameters<typeof projectUi3SessionUser>[0];
    const result = projectUi3SessionUser(user, "https://locat.example");
    expect(result).toEqual({
      id: "42", username: "sample", displayName: "Sample", lcCode: "LC-0042",
      isAdmin: false, serverOrigin: "https://locat.example",
    });
    expect(JSON.stringify(result)).not.toContain("must-not-expose");
  });

  it("provides a projection for every existing module", () => {
    const projected = projectUi3ModuleAvailability(true, true);
    expect(projected).toHaveLength(MODULES.length);
    expect(new Set(projected.map((item) => item.id)).size).toBe(MODULES.length);
  });

  it("marks server-dependent modules offline and keeps local media available", () => {
    const projected = projectUi3ModuleAvailability(false, false);
    expect(projected.find((item) => item.id === "messages")?.availability).toBe("offline");
    expect(projected.find((item) => item.id === "music")?.availability).toBe("beta");
  });

  it("keeps admin-only and planned modules gated", () => {
    const projected = projectUi3ModuleAvailability(true, false);
    expect(projected.find((item) => item.id === "hub")?.availability).toBe("admin-only");
    expect(projected.find((item) => item.id === "calendar")?.availability).toBe("planned");
  });
});
