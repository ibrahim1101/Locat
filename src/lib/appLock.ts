// App lock keeps a device-local gate in front of Locat even while the server
// session cookie remains valid. It never replaces end-to-end encryption or
// server authentication: identity keys, bearer tokens and conversation
// history keep their existing protections. The gate exists so a borrowed
// phone, a quick peek at a laptop, or an app-switcher glance cannot read
// decrypted history, see contact names, or send a message as the signed-in
// account.
//
// Two layers, by design:
//   1. A device passcode hashed with PBKDF2 (SHA-256) — the only required
//      factor. The hash and its salt live in localStorage, never on the
//      server. We iterate 310_000 times (OWASP 2023 guideline) so a stolen
//      device still needs a plausibly expensive brute-force.
//   2. An optional WebAuthn platform credential (fingerprint / Face ID / OS
//      biometrics) used as a convenience shortcut. The passcode remains the
//      recovery path when biometrics fail or hardware changes.
//
// Status is tracked in sessionStorage so a tab reload, backgrounding event
// or auto-lock timer re-locks the gate without destroying the auth session.

import { b64decode, b64encode } from "./crypto";

const CONFIG_KEY = "locat-app-lock-v1";
const SESSION_UNLOCKED_KEY = "locat-app-lock-unlocked";
const SESSION_LAST_ACTIVITY_KEY = "locat-app-lock-last-activity";

export const PBKDF2_ITERATIONS = 310_000;
export const MIN_PASSCODE_LENGTH = 6;
export const MAX_PASSCODE_LENGTH = 128;

/** Auto-lock timings exposed to the UI selector. */
export const AUTO_LOCK_OPTIONS = [
  { id: "immediate", label: "Immediately", ms: 0 },
  { id: "30s", label: "After 30 seconds", ms: 30_000 },
  { id: "1m", label: "After 1 minute", ms: 60_000 },
  { id: "5m", label: "After 5 minutes", ms: 5 * 60_000 },
  { id: "15m", label: "After 15 minutes", ms: 15 * 60_000 },
  { id: "1h", label: "After 1 hour", ms: 60 * 60_000 },
  { id: "never", label: "Only when I lock manually", ms: Number.POSITIVE_INFINITY },
] as const;

export type AutoLockOptionId = (typeof AUTO_LOCK_OPTIONS)[number]["id"];

export type AppLockConfig = {
  version: 1;
  salt: string; // base64, 16 random bytes
  hash: string; // base64, 32 bytes PBKDF2 output
  iterations: number;
  autoLockOption: AutoLockOptionId;
  lockOnBackground: boolean;
  biometricCredentialId?: string; // base64url of WebAuthn credential id
  createdAt: number;
};

export type AppLockStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class AppLockError extends Error {
  readonly code: AppLockErrorCode;
  constructor(message: string, code: AppLockErrorCode) {
    super(message);
    this.code = code;
  }
}

export type AppLockErrorCode =
  | "passcode-too-short"
  | "passcode-too-long"
  | "passcode-mismatch"
  | "passcode-missing"
  | "storage-unavailable";

function requireStorage(storage: AppLockStorage | undefined): AppLockStorage {
  if (!storage) throw new AppLockError(
    "Locat cannot save the app lock in this browser's storage.",
    "storage-unavailable",
  );
  return storage;
}

function defaultStorage(): AppLockStorage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function defaultSessionStorage(): AppLockStorage | undefined {
  return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
}

export function readConfig(storage: AppLockStorage | undefined = defaultStorage()): AppLockConfig | null {
  if (!storage) return null;
  const raw = storage.getItem(CONFIG_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppLockConfig;
    if (parsed.version !== 1) return null;
    if (!parsed.salt || !parsed.hash || !parsed.iterations) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isConfigured(storage: AppLockStorage | undefined = defaultStorage()): boolean {
  return readConfig(storage) !== null;
}

function writeConfig(config: AppLockConfig, storage: AppLockStorage | undefined = defaultStorage()): void {
  requireStorage(storage).setItem(CONFIG_KEY, JSON.stringify(config));
}

async function hashPasscode(
  passcode: string,
  saltBytes: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new AppLockError(
      "WebCrypto is not available; open Locat over HTTPS to enable the app lock.",
      "storage-unavailable",
    );
  }
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes as BufferSource, iterations },
    key,
    256,
  );
  return b64encode(bits);
}

function validatePasscodeShape(passcode: string): void {
  if (passcode.length < MIN_PASSCODE_LENGTH) {
    throw new AppLockError(
      `Choose a passcode of at least ${MIN_PASSCODE_LENGTH} characters.`,
      "passcode-too-short",
    );
  }
  if (passcode.length > MAX_PASSCODE_LENGTH) {
    throw new AppLockError(
      `Passcodes longer than ${MAX_PASSCODE_LENGTH} characters are not supported.`,
      "passcode-too-long",
    );
  }
}

export async function setPasscode(
  passcode: string,
  options: { autoLockOption?: AutoLockOptionId; lockOnBackground?: boolean } = {},
  storage: AppLockStorage | undefined = defaultStorage(),
): Promise<AppLockConfig> {
  validatePasscodeShape(passcode);
  const previous = readConfig(storage);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPasscode(passcode, salt);
  const config: AppLockConfig = {
    version: 1,
    salt: b64encode(salt),
    hash,
    iterations: PBKDF2_ITERATIONS,
    autoLockOption: options.autoLockOption ?? previous?.autoLockOption ?? "5m",
    lockOnBackground: options.lockOnBackground ?? previous?.lockOnBackground ?? true,
    biometricCredentialId: previous?.biometricCredentialId,
    createdAt: Date.now(),
  };
  writeConfig(config, storage);
  return config;
}

export async function changePasscode(
  current: string,
  next: string,
  storage: AppLockStorage | undefined = defaultStorage(),
): Promise<AppLockConfig> {
  const config = readConfig(storage);
  if (!config) throw new AppLockError("App lock is not configured.", "passcode-missing");
  const ok = await verifyPasscode(current, storage);
  if (!ok) throw new AppLockError("Current passcode is incorrect.", "passcode-mismatch");
  return setPasscode(next, { autoLockOption: config.autoLockOption, lockOnBackground: config.lockOnBackground }, storage);
}

export async function verifyPasscode(
  passcode: string,
  storage: AppLockStorage | undefined = defaultStorage(),
): Promise<boolean> {
  const config = readConfig(storage);
  if (!config) throw new AppLockError("App lock is not configured.", "passcode-missing");
  const salt = b64decode(config.salt);
  const hash = await hashPasscode(passcode, salt, config.iterations);
  // Constant-time comparison keeps timing analysis out of a wrong-passcode
  // oracle on shared devices.
  return timingSafeEqual(hash, config.hash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function removeLock(
  passcode: string,
  storage: AppLockStorage | undefined = defaultStorage(),
  sessionStore: AppLockStorage | undefined = defaultSessionStorage(),
): Promise<void> {
  const config = readConfig(storage);
  if (!config) return;
  if (!(await verifyPasscode(passcode, storage))) {
    throw new AppLockError("Current passcode is incorrect.", "passcode-mismatch");
  }
  requireStorage(storage).removeItem(CONFIG_KEY);
  if (sessionStore) {
    sessionStore.removeItem(SESSION_UNLOCKED_KEY);
    sessionStore.removeItem(SESSION_LAST_ACTIVITY_KEY);
  }
}

export function updatePolicy(
  patch: Partial<Pick<AppLockConfig, "autoLockOption" | "lockOnBackground" | "biometricCredentialId">>,
  storage: AppLockStorage | undefined = defaultStorage(),
): AppLockConfig | null {
  const config = readConfig(storage);
  if (!config) return null;
  const updated: AppLockConfig = { ...config, ...patch };
  writeConfig(updated, storage);
  return updated;
}

export function markUnlocked(
  sessionStore: AppLockStorage | undefined = defaultSessionStorage(),
): void {
  if (!sessionStore) return;
  sessionStore.setItem(SESSION_UNLOCKED_KEY, "1");
  sessionStore.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
}

export function markLocked(
  sessionStore: AppLockStorage | undefined = defaultSessionStorage(),
): void {
  if (!sessionStore) return;
  sessionStore.removeItem(SESSION_UNLOCKED_KEY);
  sessionStore.removeItem(SESSION_LAST_ACTIVITY_KEY);
}

export function recordActivity(
  sessionStore: AppLockStorage | undefined = defaultSessionStorage(),
): void {
  if (!sessionStore) return;
  if (sessionStore.getItem(SESSION_UNLOCKED_KEY) !== "1") return;
  sessionStore.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
}

export type LockState = {
  configured: boolean;
  unlocked: boolean;
  config: AppLockConfig | null;
};

export function currentState(
  storage: AppLockStorage | undefined = defaultStorage(),
  sessionStore: AppLockStorage | undefined = defaultSessionStorage(),
): LockState {
  const config = readConfig(storage);
  if (!config) return { configured: false, unlocked: true, config: null };
  const unlocked = sessionStore?.getItem(SESSION_UNLOCKED_KEY) === "1";
  return { configured: true, unlocked, config };
}

export function autoLockOptionById(id: AutoLockOptionId): (typeof AUTO_LOCK_OPTIONS)[number] {
  const found = AUTO_LOCK_OPTIONS.find((option) => option.id === id);
  if (!found) return AUTO_LOCK_OPTIONS.find((o) => o.id === "5m")!;
  return found;
}

/**
 * Returns true when the device should re-lock based on inactivity. The caller
 * is expected to run this on a timer (and on visibility change events for the
 * lock-on-background policy).
 */
export function shouldAutoLock(
  now: number,
  storage: AppLockStorage | undefined = defaultStorage(),
  sessionStore: AppLockStorage | undefined = defaultSessionStorage(),
): boolean {
  const state = currentState(storage, sessionStore);
  if (!state.configured || !state.unlocked || !state.config) return false;
  const option = autoLockOptionById(state.config.autoLockOption);
  if (!Number.isFinite(option.ms)) return false;
  const lastRaw = sessionStore?.getItem(SESSION_LAST_ACTIVITY_KEY);
  if (!lastRaw) return true;
  const last = Number.parseInt(lastRaw, 10);
  if (!Number.isFinite(last)) return true;
  return now - last >= option.ms;
}

// ─── Biometric (WebAuthn) ───────────────────────────────────────────────────
// We register a platform authenticator so an unlock prompt can use the OS
// fingerprint / Face ID / Windows Hello flow. The server never participates:
// successful WebAuthn assertion simply flips the local unlocked flag. The
// passcode remains the recovery path.

export function hasBiometricSupport(): boolean {
  const w = typeof window === "undefined" ? undefined : (window as unknown as {
    PublicKeyCredential?: {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
    };
  });
  return Boolean(w?.PublicKeyCredential && navigator?.credentials?.create);
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!hasBiometricSupport()) return false;
  const pkc = (window as unknown as {
    PublicKeyCredential?: {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
    };
  }).PublicKeyCredential;
  try {
    return Boolean(
      await pkc?.isUserVerifyingPlatformAuthenticatorAvailable?.(),
    );
  } catch {
    return false;
  }
}

export async function registerBiometric(
  userId: number,
  username: string,
  storage: AppLockStorage | undefined = defaultStorage(),
): Promise<AppLockConfig | null> {
  if (!hasBiometricSupport()) throw new AppLockError(
    "Biometrics are not available in this browser or Android WebView.",
    "storage-unavailable",
  );
  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(`locat:${userId}`);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Locat", id: window.location.hostname },
      user: { id: userIdBytes, name: username, displayName: username },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  }) as PublicKeyCredential | null;
  if (!credential) return null;
  const credId = b64encode(credential.rawId);
  return updatePolicy({ biometricCredentialId: credId }, storage);
}

export async function verifyBiometric(
  storage: AppLockStorage | undefined = defaultStorage(),
): Promise<boolean> {
  const config = readConfig(storage);
  if (!config?.biometricCredentialId) return false;
  if (!hasBiometricSupport()) return false;
  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: b64decode(config.biometricCredentialId) as BufferSource,
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}

export function removeBiometric(storage: AppLockStorage | undefined = defaultStorage()): AppLockConfig | null {
  return updatePolicy({ biometricCredentialId: undefined }, storage);
}
