const SERVER_KEY = "locat-native-server";
const TOKEN_KEY = "locat-native-session";

export function isNativeShell(): boolean {
  return window.location.hostname === "localhost" && window.location.protocol === "https:";
}

export function nativeServerUrl(): string {
  if (!isNativeShell()) return window.location.origin;
  return localStorage.getItem(SERVER_KEY)?.replace(/\/$/, "") ?? "";
}

export function setNativeServerUrl(value: string): void {
  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error("Locat Android requires an HTTPS server address.");
  localStorage.setItem(SERVER_KEY, url.origin);
}

export function nativeSessionToken(): string | null {
  return isNativeShell() ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setNativeSessionToken(token: string | null): void {
  if (!isNativeShell()) return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
