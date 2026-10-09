export function parseNativeServerOrigin(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== "https:") throw new Error("HTTPS required");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Enter an HTTPS origin only");
  return url.origin;
}
