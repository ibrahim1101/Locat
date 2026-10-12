/** In-memory, expiring requests. Approval never exposes file bytes or filesystem paths. */
export type MediaAccessRequest = {
  id: string; userId: number; sourceDeviceId: number; requesterDeviceId: number;
  libraryId: string; status: "pending" | "approved" | "denied"; createdAt: number;
};
const TTL_MS = 5 * 60_000;
const requests = new Map<string, MediaAccessRequest>();
function prune(now: number) {
  for (const [id, item] of requests) if (now - item.createdAt >= TTL_MS) requests.delete(id);
}
export function createMediaAccessRequest(input: Omit<MediaAccessRequest, "id" | "status" | "createdAt">, now = Date.now()) {
  prune(now);
  const id = crypto.randomUUID();
  const item: MediaAccessRequest = { ...input, id, status: "pending", createdAt: now };
  requests.set(id, item);
  return { ...item };
}
export function listMediaAccessRequests(userId: number, sourceDeviceId: number, now = Date.now()) {
  prune(now);
  return [...requests.values()].filter(item => item.userId === userId && item.sourceDeviceId === sourceDeviceId).map(item => ({ ...item }));
}
export function getMediaAccessRequest(userId: number, requesterDeviceId: number, id: string, now = Date.now()) {
  prune(now);
  const item = requests.get(id);
  return item && item.userId === userId && item.requesterDeviceId === requesterDeviceId ? { ...item } : null;
}
export function decideMediaAccessRequest(userId: number, sourceDeviceId: number, id: string, approve: boolean, now = Date.now()) {
  prune(now);
  const item = requests.get(id);
  if (!item || item.userId !== userId || item.sourceDeviceId !== sourceDeviceId || item.status !== "pending") return null;
  item.status = approve ? "approved" : "denied";
  return { ...item };
}
export function revokeMediaAccessRequests(userId: number, deviceId: number) {
  for (const [id, item] of requests) if (item.userId === userId && (item.sourceDeviceId === deviceId || item.requesterDeviceId === deviceId)) requests.delete(id);
}

/** Revoke requests and approvals tied to a withdrawn source library. */
export function revokeMediaLibraryRequests(userId: number, sourceDeviceId: number, libraryId?: string) {
  for (const [id, item] of requests) {
    if (item.userId === userId && item.sourceDeviceId === sourceDeviceId && (libraryId === undefined || item.libraryId === libraryId)) requests.delete(id);
  }
}
