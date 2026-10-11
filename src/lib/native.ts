import { detectPlatform } from "./platform";
import { parseNativeServerOrigin } from "./nativeServerOrigin";
const SERVER_KEY = "locat-native-server";
const TOKEN_KEY = "locat-native-session";

export function isNativeShell(): boolean {
  const kind = detectPlatform();
  return kind === "tauri-desktop" || kind === "capacitor-android" || (window.location.hostname === "localhost" && window.location.protocol === "https:");
}

export function nativeServerUrl(): string {
  if (!isNativeShell()) return window.location.origin;
  return localStorage.getItem(SERVER_KEY)?.replace(/\/$/, "") ?? "";
}

export function setNativeServerUrl(value: string): void {
  const origin = parseNativeServerOrigin(value);
  // Server changes must not send an old bearer credential to a different host.
  if (origin !== localStorage.getItem(SERVER_KEY)) localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(SERVER_KEY, origin);
}

export function nativeSessionToken(): string | null {
  return isNativeShell() ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setNativeSessionToken(token: string | null): void {
  if (!isNativeShell()) return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
