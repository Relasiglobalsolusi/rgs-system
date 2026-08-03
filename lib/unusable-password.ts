import bcrypt from "bcryptjs";

/** Stable sentinel — hashed at provision so first-login can detect placeholder passwords. */
const PLACEHOLDER_PASSWORD_SECRET = "__RGS_PLACEHOLDER_PASSWORD__";

export async function createUnusablePasswordHash(): Promise<string> {
  return bcrypt.hash(PLACEHOLDER_PASSWORD_SECRET, 12);
}

export async function isPlaceholderPasswordHash(
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(PLACEHOLDER_PASSWORD_SECRET, passwordHash);
}
