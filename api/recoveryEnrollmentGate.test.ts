import { describe, expect, it, vi } from "vitest";
import { verifyRecoveryEnrollmentPassword } from "./recoveryEnrollmentGate";

const account = { disabled: false, passwordHash: "stored-hash", publicKey: "public-key" };

describe("recovery enrollment password gate", () => {
  it("returns only the account public key after successful reauthentication", async () => {
    const verify = vi.fn(async () => true);
    await expect(verifyRecoveryEnrollmentPassword(account, "correct", verify)).resolves.toBe("public-key");
    expect(verify).toHaveBeenCalledWith("correct", "stored-hash");
  });

  it("rejects an incorrect password with a uniform unauthorized response", async () => {
    const verify = vi.fn(async () => false);
    await expect(verifyRecoveryEnrollmentPassword(account, "wrong", verify)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Unable to verify account credentials",
    });
  });

  it("rejects missing and disabled accounts without invoking password verification", async () => {
    const verify = vi.fn(async () => true);
    await expect(verifyRecoveryEnrollmentPassword(null, "test", verify)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(verifyRecoveryEnrollmentPassword({ ...account, disabled: true }, "test", verify)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(verify).not.toHaveBeenCalled();
  });
});
