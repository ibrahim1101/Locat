import { describe, expect, it } from "vitest";
import {
  createMediaAccessRequest, decideMediaAccessRequest, getMediaAccessRequest,
  listMediaAccessRequests, revokeMediaAccessRequests, revokeMediaLibraryRequests, consumeMediaAccessApproval,
} from "./deviceMediaAccess";

describe("paired device media access request lifecycle", () => {
  const base = { userId: 981, sourceDeviceId: 501, requesterDeviceId: 502, libraryId: "folder-photos" };
  it("starts pending and only the requester can read its status", () => {
    const request = createMediaAccessRequest(base, 1000);
    expect(request.status).toBe("pending");
    expect(getMediaAccessRequest(981, 502, request.id, 1001)?.status).toBe("pending");
    expect(getMediaAccessRequest(981, 501, request.id, 1001)).toBeNull();
    expect(getMediaAccessRequest(982, 502, request.id, 1001)).toBeNull();
    expect(listMediaAccessRequests(981, 501, 1001).some(item => item.id === request.id)).toBe(true);
    expect(listMediaAccessRequests(981, 502, 1001).some(item => item.id === request.id)).toBe(false);
  });
  it("requires source ownership to approve or deny and prevents repeat decisions", () => {
    const request = createMediaAccessRequest(base, 2000);
    expect(decideMediaAccessRequest(981, 502, request.id, true, 2001)).toBeNull();
    expect(decideMediaAccessRequest(982, 501, request.id, true, 2001)).toBeNull();
    expect(decideMediaAccessRequest(981, 501, request.id, false, 2001)?.status).toBe("denied");
    expect(decideMediaAccessRequest(981, 501, request.id, true, 2002)).toBeNull();
    expect(getMediaAccessRequest(981, 502, request.id, 2002)?.status).toBe("denied");
  });
  it("expires pending and approved records after five minutes", () => {
    const request = createMediaAccessRequest(base, 3000);
    expect(decideMediaAccessRequest(981, 501, request.id, true, 3001)?.status).toBe("approved");
    expect(getMediaAccessRequest(981, 502, request.id, 3000 + 5 * 60_000)).toBeNull();
    expect(decideMediaAccessRequest(981, 501, request.id, false, 3000 + 5 * 60_000)).toBeNull();
  });
  it("withdrawal invalidates only the affected source library approvals", () => {
    const photo = createMediaAccessRequest(base, 3500);
    const music = createMediaAccessRequest({ ...base, libraryId: "folder-music" }, 3501);
    expect(decideMediaAccessRequest(981, 501, photo.id, true, 3502)?.status).toBe("approved");
    revokeMediaLibraryRequests(981, 501, "folder-photos");
    expect(getMediaAccessRequest(981, 502, photo.id, 3503)).toBeNull();
    expect(getMediaAccessRequest(981, 502, music.id, 3503)?.status).toBe("pending");
    revokeMediaLibraryRequests(981, 501);
    expect(getMediaAccessRequest(981, 502, music.id, 3504)).toBeNull();
  });
  it("consumes an approval exactly once and never allows the source or another user to consume it", () => {
    const request = createMediaAccessRequest(base, 3600);
    expect(consumeMediaAccessApproval(981, 502, request.id, 3601)).toBeNull();
    expect(decideMediaAccessRequest(981, 501, request.id, true, 3602)?.status).toBe("approved");
    expect(consumeMediaAccessApproval(981, 501, request.id, 3603)).toBeNull();
    expect(consumeMediaAccessApproval(982, 502, request.id, 3603)).toBeNull();
    expect(consumeMediaAccessApproval(981, 502, request.id, 3603)?.id).toBe(request.id);
    expect(consumeMediaAccessApproval(981, 502, request.id, 3604)).toBeNull();
  });
  it("revocation removes requests for either participating device", () => {
    const request = createMediaAccessRequest(base, 4000);
    revokeMediaAccessRequests(981, 502);
    expect(getMediaAccessRequest(981, 502, request.id, 4001)).toBeNull();
    const other = createMediaAccessRequest(base, 4002);
    revokeMediaAccessRequests(981, 501);
    expect(getMediaAccessRequest(981, 502, other.id, 4003)).toBeNull();
  });
});
