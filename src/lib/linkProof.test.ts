import { describe, expect, it } from "vitest";
import { answerLinkChallenge, issueLinkChallenge, LINK_PROOF_TTL, revokeLinkProofs, validateLinkPublicKey, verifyLinkProof } from "../../api/linkProof";
import { generateDeviceIdentity, solveDeviceChallenge } from "./link";
describe("Link device proof of possession", () => {
  it("requires the correct private key and consumes a challenge exactly once", async () => {
    const owner = await generateDeviceIdentity(); const attacker = await generateDeviceIdentity();
    const challenge = await issueLinkChallenge(1001, 101, "account-session", owner.publicKeyB64);
    await expect(solveDeviceChallenge(attacker, challenge)).rejects.toThrow();
    const answer = await solveDeviceChallenge(owner, challenge);
    const proof = answerLinkChallenge(1001, "account-session", challenge.id, answer);
    expect(verifyLinkProof(1001, "account-session", proof.token)).toBe(101);
    expect(() => answerLinkChallenge(1001, "account-session", challenge.id, answer)).toThrow();
    expect(() => verifyLinkProof(1002, "account-session", proof.token)).toThrow();
    expect(() => verifyLinkProof(1001, "different-session", proof.token)).toThrow();
    expect(() => verifyLinkProof(1001, "account-session", undefined)).toThrow();
    revokeLinkProofs(1001, 101);
    expect(() => verifyLinkProof(1001, "account-session", proof.token)).toThrow();
  });
  it("rejects expired, replayed, tampered, cross-session and cross-device challenges", async () => {
    const owner = await generateDeviceIdentity();
    const challenge = await issueLinkChallenge(1003, 103, "session", owner.publicKeyB64, 1000);
    await expect(solveDeviceChallenge(owner, { ...challenge, deviceId: 104 })).rejects.toThrow();
    const answer = await solveDeviceChallenge(owner, challenge);
    expect(() => answerLinkChallenge(1003, "session", challenge.id, answer, 62_000)).toThrow();
    const next = await issueLinkChallenge(1003, 103, "session", owner.publicKeyB64);
    expect(() => answerLinkChallenge(1003, "other-session", next.id, "AAAA")).toThrow();
    expect(() => answerLinkChallenge(1003, "session", next.id, answer)).toThrow();
    const valid = await issueLinkChallenge(1003, 103, "session", owner.publicKeyB64, 1000);
    const proof = answerLinkChallenge(1003, "session", valid.id, await solveDeviceChallenge(owner, valid), 1100);
    expect(() => verifyLinkProof(1003, "session", proof.token, 1100 + LINK_PROOF_TTL)).toThrow();
  });
  it("rejects base64 aliases which could bypass revoked-key identity matching", async () => {
    const owner = await generateDeviceIdentity();
    await validateLinkPublicKey(owner.publicKeyB64);
    for (const alias of [` ${owner.publicKeyB64}`, owner.publicKeyB64.replace(/=+$/, ""), `${owner.publicKeyB64}\n`]) {
      if (alias !== owner.publicKeyB64) await expect(validateLinkPublicKey(alias)).rejects.toThrow();
    }
    await expect(validateLinkPublicKey("not-a-key")).rejects.toThrow();
  });
});
