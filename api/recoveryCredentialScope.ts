import { and, eq, isNull } from "drizzle-orm";
import { recoveryCredentials } from "@db/schema";

/** Shared account ownership guard for all credential lifecycle operations. */
export function activeRecoveryCredentialScope(userId: number) {
  return and(
    eq(recoveryCredentials.userId, userId),
    isNull(recoveryCredentials.revokedAt),
  );
}

/** Revocation must also target the selected credential belonging to this user. */
export function revocableRecoveryCredentialScope(userId: number, credentialId: number) {
  return and(
    activeRecoveryCredentialScope(userId),
    eq(recoveryCredentials.id, credentialId),
  );
}
