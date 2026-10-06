/** Registration-only policy. Never transform the password used for key wrapping. */
export const PASSWORD_MIN_CHARACTERS = 15;
export const PASSWORD_MAX_CODE_UNITS = 1024;

// Small bundled starter list, not an exhaustive breached-password database.
const commonPasswords = new Set([
  "password", "password123", "password123456789", "123456789012345",
  "12345678901234567890", "qwertyuiopasdfgh", "qwertyuiopasdfghjkl",
  "iloveyou", "letmein", "admin", "welcome", "changeme",
]);

export function registrationPasswordError(password: string, username: string): string | null {
  if (password.length > PASSWORD_MAX_CODE_UNITS) return "Password is too long (maximum 1024 UTF-16 code units).";
  if (Array.from(password).length < PASSWORD_MIN_CHARACTERS)
    return "Use at least 15 characters. A long unique passphrase works well.";
  const folded = password.toLowerCase();
  const compact = folded.replace(/[\s_.!@#$%&*+\-\d]/g, "");
  if (!password.trim() || /^(.)\1+$/u.test(password) || commonPasswords.has(folded) || commonPasswords.has(compact))
    return "Choose a less predictable password; avoid common words and repeated characters.";
  const account = username.trim().toLowerCase();
  if (account.length >= 3 && (folded.includes(account) || compact.includes(account)))
    return "Your password must not contain your username.";
  return null;
}
