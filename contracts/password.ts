/** Registration-only policy. Never transform the password used for key wrapping. */
export const PASSWORD_MIN_CHARACTERS = 8;
export const PASSWORD_MAX_CODE_UNITS = 1024;

// Small bundled starter list, not an exhaustive breached-password database.
const commonPasswords = new Set([
  "password", "password123", "password123456789", "123456789012345",
  "12345678901234567890", "qwertyuiopasdfgh", "qwertyuiopasdfghjkl",
  "iloveyou", "letmein", "admin", "welcome", "changeme",
]);

function isPredictablePattern(value: string): boolean {
  // Reject repeated short motifs (abcabc…, 123123…) and consecutive runs.
  // This is deliberately bounded; it is not an entropy or breach estimator.
  if (/^(.{1,4})\1+$/u.test(value)) return true;
  const runs = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  return runs.some((run) => [run, Array.from(run).reverse().join("")].some((direction) =>
    (direction.repeat(Math.ceil(value.length / direction.length) + 1)).includes(value),
  ));
}

export function registrationPasswordError(password: string, username: string): string | null {
  if (password.length > PASSWORD_MAX_CODE_UNITS) return "Password is too long (maximum 1024 UTF-16 code units).";
  if (Array.from(password).length < PASSWORD_MIN_CHARACTERS)
    return "Use at least 8 characters. A unique passphrase works well.";
  const folded = password.toLowerCase();
  const compact = folded.replace(/[\s_.!@#$%&*+\-\d]/g, "");
  const pattern = folded.replace(/[\s_.!@#$%&*+-]/g, "");
  if (!password.trim() || isPredictablePattern(pattern) || commonPasswords.has(folded) || commonPasswords.has(compact))
    return "Choose a less predictable password; avoid common words and repeated characters.";
  const account = username.trim().toLowerCase();
  if (account.length >= 3 && (folded.includes(account) || compact.includes(account)))
    return "Your password must not contain your username.";
  return null;
}
