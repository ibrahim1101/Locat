/**
 * End-to-end file digest helpers. The expected digest must be delivered in
 * authenticated, integrity-protected transfer metadata; a server-supplied
 * digest on its own does not prove the sender's identity.
 */
export async function sha256MediaPayload(payload: BufferSource): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyMediaPayload(payload: BufferSource, expectedSha256: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) return false;
  const actual = await sha256MediaPayload(payload);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) {
    difference |= actual.charCodeAt(i) ^ expectedSha256.charCodeAt(i);
  }
  return difference === 0;
}
