/**
 * Short-lived, device-scoped signaling metadata only.
 * Signaling does not authenticate ECDH keys cryptographically: callers must
 * authenticate the remote key against a pinned verified device identity.
 */
type Signal = {
  userId: number; transferId: string; fromDeviceId: number; toDeviceId: number;
  publicKey: string; createdAt: number;
};
const TTL_MS = 2 * 60_000;
const signals = new Map<string, Signal>();
const key = (userId: number, transferId: string, fromDeviceId: number) => `${userId}:${transferId}:${fromDeviceId}`;
function prune(now: number) {
  for (const [id, signal] of signals) if (now - signal.createdAt >= TTL_MS) signals.delete(id);
}
export function publishMediaTransferSignal(signal: Omit<Signal, "createdAt">, now = Date.now()) {
  prune(now);
  const id = key(signal.userId, signal.transferId, signal.fromDeviceId);
  if (signals.has(id)) return false;
  signals.set(id, { ...signal, createdAt: now });
  return true;
}
export function consumeMediaTransferSignal(userId: number, transferId: string, fromDeviceId: number, toDeviceId: number, now = Date.now()) {
  prune(now);
  const id = key(userId, transferId, fromDeviceId);
  const signal = signals.get(id);
  if (!signal || signal.toDeviceId !== toDeviceId) return null;
  signals.delete(id);
  return { ...signal };
}
export function revokeMediaTransferSignals(userId: number, deviceId: number) {
  for (const [id, signal] of signals) {
    if (signal.userId === userId && (signal.fromDeviceId === deviceId || signal.toDeviceId === deviceId)) signals.delete(id);
  }
}
