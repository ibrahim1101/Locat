/** In-memory, expiring requests. Approval never exposes file bytes or filesystem paths. */
export type MediaAccessRequest = {
  id: string; userId: number; sourceDeviceId: number; requesterDeviceId: number;
  libraryId: string; status: "pending" | "approved" | "denied"; createdAt: number;
};
const TTL_MS = 5 * 60_000;
const requests = new Map<string, MediaAccessRequest>();
export type MediaTransferGrant = Pick<MediaAccessRequest, "userId" | "sourceDeviceId" | "requesterDeviceId" | "libraryId"> & { transferId: string; expiresAt: number };
const grants = new Map<string, MediaTransferGrant>();
const GRANT_TTL_MS = 2 * 60_000;
export function getMediaTransferGrant(userId: number, transferId: string, now = Date.now()) {
  prune(now);
  const grant = grants.get(transferId);
  return grant && grant.userId === userId ? { ...grant } : null;
}
function prune(now: number) {
  for (const [id, item] of requests) if (now - item.createdAt >= TTL_MS) requests.delete(id);
  for (const [id, grant] of grants) if (now >= grant.expiresAt) grants.delete(id);
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
  for (const [id, grant] of grants) if (grant.userId === userId && (grant.sourceDeviceId === deviceId || grant.requesterDeviceId === deviceId)) grants.delete(id);
}

/** Revoke requests and approvals tied to a withdrawn source library. */
export function revokeMediaLibraryRequests(userId: number, sourceDeviceId: number, libraryId?: string) {
  for (const [id, item] of requests) {
    if (item.userId === userId && item.sourceDeviceId === sourceDeviceId && (libraryId === undefined || item.libraryId === libraryId)) requests.delete(id);
  }
  for (const [id, grant] of grants) if (grant.userId === userId && grant.sourceDeviceId === sourceDeviceId && (libraryId === undefined || grant.libraryId === libraryId)) grants.delete(id);
}

/** An approval is a short-lived, single-use authorization for a later
 * source-controlled transfer negotiation, never a file-download capability. */
export function consumeMediaAccessApproval(userId: number, requesterDeviceId: number, id: string, now = Date.now()) {
  prune(now);
  const item = requests.get(id);
  if (!item || item.userId !== userId || item.requesterDeviceId !== requesterDeviceId || item.status !== "approved") return null;
  requests.delete(id);
  grants.set(id, { transferId: id, userId: item.userId, sourceDeviceId: item.sourceDeviceId,
    requesterDeviceId: item.requesterDeviceId, libraryId: item.libraryId, expiresAt: now + GRANT_TTL_MS });
  return { ...item };
}
