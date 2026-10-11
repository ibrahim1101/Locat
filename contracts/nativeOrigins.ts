/** Exact packaged-client origins. Never accept wildcard localhost or "null". */
export const NATIVE_ORIGINS = new Set(["https://localhost", "https://tauri.localhost", "tauri://localhost"]);
export function isTrustedNativeOrigin(origin: string | null): boolean {
  return origin !== null && NATIVE_ORIGINS.has(origin);
}
