import { describe, expect, it } from "vitest";
import { isTrustedNativeOrigin } from "./nativeOrigins";
describe("packaged client origin policy", () => {
  it("accepts only exact configured native origins", () => {
    for (const origin of ["https://localhost","https://tauri.localhost","tauri://localhost"]) expect(isTrustedNativeOrigin(origin)).toBe(true);
    for (const origin of [null,"null","http://localhost","https://tauri.localhost.evil","https://localhost:444","https://evil.example"]) expect(isTrustedNativeOrigin(origin)).toBe(false);
  });
});
