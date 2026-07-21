import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function createUnusablePasswordHash(): Promise<string> {
  const randomSecret = crypto.randomBytes(32).toString("hex");
  return bcrypt.hash(randomSecret, 12);
}
