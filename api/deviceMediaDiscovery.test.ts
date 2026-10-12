import { describe, expect, it } from "vitest";
import { discoverDeviceLibraries, publishDeviceLibraries, unpublishDeviceLibraries } from "./deviceMediaDiscovery";

describe("opt-in device media discovery", () => {
  const user = 71001, device = 81001;
  it("publishes and withdraws only the chosen device metadata", () => {
    unpublishDeviceLibraries(user, device);
    expect(discoverDeviceLibraries(user, device)).toEqual([]);
    publishDeviceLibraries(user, device, [{ id: "camera", name: "Camera", kind: "photos", count: 12 }], 1000);
    expect(discoverDeviceLibraries(user, device, 1001)).toEqual([{ id: "camera", name: "Camera", kind: "photos", count: 12 }]);
    expect(discoverDeviceLibraries(user + 1, device, 1001)).toEqual([]);
    expect(discoverDeviceLibraries(user, device + 1, 1001)).toEqual([]);
    unpublishDeviceLibraries(user, device);
    expect(discoverDeviceLibraries(user, device, 1001)).toEqual([]);
  });
  it("expires stale publications without persistent device file access", () => {
    publishDeviceLibraries(user, device, [{ id: "music", name: "Music", kind: "music", count: 5 }], 2000);
    expect(discoverDeviceLibraries(user, device, 302000)).toEqual([]);
  });
});
