import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_SALT = "rgs-recoverable-password";

function encryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for recoverable password storage.");
  }
  return scryptSync(secret, KEY_SALT, 32);
}

/** Persist admin-recoverable password copy (AES-256-GCM, prefixed at rest). */
export function encryptRecoverablePassword(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]).toString("base64url");
  return `${PREFIX}${payload}`;
}

function decryptEncryptedPayload(value: string): string | null {
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    return plaintext || null;
  } catch {
    return null;
  }
}

export type AdminRecoverablePassword = {
  /** Decrypted/plaintext for admin display; null if missing or decrypt failed. */
  plaintext: string | null;
  /** Whether a recoverable copy exists in the database (encrypted or legacy plaintext). */
  storedAtRest: boolean;
  /** Encrypted copy exists but could not be decrypted (e.g. wrong NEXTAUTH_SECRET). */
  decryptFailed: boolean;
};

/** Server-only: resolve stored copy for admin UI (decrypt + metadata). */
export function resolveAdminRecoverablePassword(
  stored: string | null | undefined
): AdminRecoverablePassword {
  const value = stored?.trim();
  if (!value) {
    return { plaintext: null, storedAtRest: false, decryptFailed: false };
  }

  if (!value.startsWith(PREFIX)) {
    return { plaintext: value, storedAtRest: true, decryptFailed: false };
  }

  const plaintext = decryptEncryptedPayload(value);
  return {
    plaintext,
    storedAtRest: true,
    decryptFailed: plaintext === null,
  };
}

export function hasRecoverablePasswordStored(
  stored: string | null | undefined
): boolean {
  return Boolean(stored?.trim());
}
