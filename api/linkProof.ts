import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
const te = new TextEncoder();
const challenges = new Map<string, { userId: number; deviceId: number; session: string; secret: Buffer; expires: number }>();
const proofs = new Map<string, { userId: number; deviceId: number; session: string; expires: number }>();
const CHALLENGE_TTL = 60_000;
export const LINK_PROOF_TTL = 10 * 60_000;
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function prune(now: number) {
  for (const [id, row] of challenges) if (row.expires <= now) challenges.delete(id);
  for (const [id, row] of proofs) if (row.expires <= now) proofs.delete(id);
  if (challenges.size >= 2000 || proofs.size >= 2000) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Device proof service busy" });
}
export async function canonicalLinkPublicKey(publicKey: string) {
  try {
    const key = await crypto.subtle.importKey("spki", Buffer.from(publicKey, "base64"), { name: "ECDH", namedCurve: "P-256" }, true, []);
    return { key, publicKey: Buffer.from(await crypto.subtle.exportKey("spki", key)).toString("base64") };
  } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid device encryption key" }); }
}
export async function validateLinkPublicKey(publicKey: string) {
  const canonical = await canonicalLinkPublicKey(publicKey);
  if (canonical.publicKey !== publicKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid device encryption key representation" });
  return canonical.key;
}
export async function issueLinkChallenge(userId: number, deviceId: number, session: string, publicKey: string, now = Date.now()) {
  prune(now);
  const peer = await validateLinkPublicKey(publicKey);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: peer }, ephemeral.privateKey, 256);
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const id = randomBytes(24).toString("base64url");
  const context = `locat-link-device-proof:v1:${userId}:${deviceId}:${id}`;
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: te.encode(context), info: te.encode("challenge-response") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const secret = randomBytes(32); const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(context) }, key, secret);
  const pub = await crypto.subtle.exportKey("spki", ephemeral.publicKey);
  challenges.set(id, { userId, deviceId, session: hash(session), secret, expires: now + CHALLENGE_TTL });
  return { id, deviceId, userId, publicKey: Buffer.from(pub).toString("base64"), iv: iv.toString("base64"), data: Buffer.from(data).toString("base64"), expiresAt: now + CHALLENGE_TTL };
}
export function answerLinkChallenge(userId: number, session: string, id: string, answer: string, now = Date.now()) {
  const row = challenges.get(id);
  challenges.delete(id); // Every attempt consumes the challenge, including failures.
  const received = Buffer.from(answer, "base64");
  if (!row || row.expires <= now || row.userId !== userId || row.session !== hash(session)
    || received.length !== row.secret.length || !timingSafeEqual(received, row.secret)) throw new TRPCError({ code: "FORBIDDEN", message: "Device proof failed or expired" });
  prune(now);
  const token = randomBytes(32).toString("base64url");
  proofs.set(hash(token), { userId, deviceId: row.deviceId, session: row.session, expires: now + LINK_PROOF_TTL });
  return { token, deviceId: row.deviceId, expiresAt: now + LINK_PROOF_TTL };
}
export function verifyLinkProof(userId: number, session: string, token: string | undefined, now = Date.now()): number {
  const row = token ? proofs.get(hash(token)) : undefined;
  if (!row || row.expires <= now || row.userId !== userId || row.session !== hash(session)) throw new TRPCError({ code: "FORBIDDEN", message: "Prove this device's private key before using Locat Link" });
  return row.deviceId;
}
export function revokeLinkProofs(userId: number, deviceId: number) {
  for (const [id, row] of proofs) if (row.userId === userId && row.deviceId === deviceId) proofs.delete(id);
  for (const [id, row] of challenges) if (row.userId === userId && row.deviceId === deviceId) challenges.delete(id);
}
