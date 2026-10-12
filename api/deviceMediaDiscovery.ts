/** Ephemeral, opt-in metadata only: no device paths or file bytes are stored. */
export type PublishedLibrary = { id: string; name: string; kind: "cinema" | "music" | "photos"; count: number };
type Publication = { libraries: PublishedLibrary[]; updatedAt: number };
const publications = new Map<string, Publication>();
const TTL_MS = 5 * 60_000;
const key = (userId: number, deviceId: number) => `${userId}:${deviceId}`;

export function publishDeviceLibraries(userId: number, deviceId: number, libraries: PublishedLibrary[], now = Date.now()) {
  if (libraries.length === 0) {
    publications.delete(key(userId, deviceId));
    return;
  }
  publications.set(key(userId, deviceId), { libraries: libraries.map(item => ({ ...item })), updatedAt: now });
}
export function discoverDeviceLibraries(userId: number, deviceId: number, now = Date.now()) {
  const record = publications.get(key(userId, deviceId));
  if (!record) return [];
  if (now - record.updatedAt >= TTL_MS) {
    publications.delete(key(userId, deviceId));
    return [];
  }
  return record.libraries.map(item => ({ ...item }));
}
export function unpublishDeviceLibraries(userId: number, deviceId: number) {
  publications.delete(key(userId, deviceId));
}
