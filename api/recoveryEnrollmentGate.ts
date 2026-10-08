import { TRPCError } from "@trpc/server";
import { verifyPassword } from "./crypto";

/** Pure authorization decision shared by recovery enrollment preflight and tests.
 * This never issues credentials, tokens, or a durable authorization grant.
 */
export async function verifyRecoveryEnrollmentPassword(
  account: { disabled: boolean; passwordHash: string; publicKey: string } | null | undefined,
  password: string,
  verify: typeof verifyPassword = verifyPassword,
): Promise<string> {
  if (!account || account.disabled || !(await verify(password, account.passwordHash))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unable to verify account credentials" });
  }
  return account.publicKey;
}
