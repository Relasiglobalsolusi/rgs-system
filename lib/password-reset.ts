import crypto from "crypto";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function createPasswordResetToken() {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
}

export function getPasswordResetExpiry() {
  return new Date(Date.now() + RESET_TOKEN_TTL_MS);
}
