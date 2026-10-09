import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";

const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

// Valid scrypt hash with fixed non-secret salt, used to equalize missing-account login work.
const DUMMY_PASSWORD_HASH = `scrypt${N}${r}${p}$AAAAAAAAAAAAAAAAAAAAAA==${"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="}`;

export async function verifyLoginPassword(password: string, storedHash?: string): Promise<boolean> {
  const matches = await verifyPassword(password, storedHash ?? DUMMY_PASSWORD_HASH);
  return storedHash !== undefined && matches;
}

/** Hash a password as scrypt$N$r$p$saltB64$hashB64 using Node's crypto. */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scrypt(password, salt, KEYLEN, { N, r, p }, (err, derived) => {
      if (err) return reject(err);
      resolve(
        `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`,
      );
    });
  });
}

export function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [algo, nStr, rStr, pStr, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt" || !saltB64 || !hashB64) return resolve(false);
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    scrypt(
      password,
      salt,
      expected.length,
      { N: Number(nStr), r: Number(rStr), p: Number(pStr) },
      (err, derived) => {
        if (err) return reject(err);
        resolve(timingSafeEqual(derived, expected));
      },
    );
  });
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Stable fingerprint of a public key, for display ("safety number" style). */
export function keyFingerprint(publicKeyB64: string): string {
  return createHash("sha256")
    .update(publicKeyB64)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
}
