/** Canonicalize a user-entered HTTPS origin for the Android API. */
export function parseNativeServerOrigin(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid HTTPS Locat server address.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Locat Android requires an HTTPS server address.");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Enter only the HTTPS server origin (no credentials, path, query or fragment).");
  }
  return url.origin;
}
