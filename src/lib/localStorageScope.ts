import { isNativeShell, nativeServerUrl } from "./native";
import { parseNativeServerOrigin } from "./nativeServerOrigin";
let boundNativeOrigin: string | undefined;

/** Native shells share one WebView origin across hosts; browsers already isolate origins. */
export function nativeLocalStorageOrigin(): string | null {
  if (typeof window === "undefined" || !isNativeShell()) return null;
  const origin = parseNativeServerOrigin(nativeServerUrl());
  if (boundNativeOrigin && origin !== boundNativeOrigin) throw new Error("Server changed. Restart Locat before accessing device data.");
  boundNativeOrigin = origin;
  return origin;
}
export function localAccountDatabaseName(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid account");
  const origin = nativeLocalStorageOrigin();
  return origin === null ? `locat-account-${userId}` : `locat-server-${encodeURIComponent(origin)}-account-${userId}`;
}
export function offlineAccountStorageKey(): string {
  const origin = nativeLocalStorageOrigin();
  return origin === null ? "locat-offline-account" : `locat-offline-account:v2:${encodeURIComponent(origin)}`;
}
