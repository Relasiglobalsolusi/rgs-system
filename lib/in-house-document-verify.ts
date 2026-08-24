/**
 * Head Office confirms payment and tax documents in the app.
 * Files stay on this server.
 */

const MIN_REASON_LENGTH = 3;

export function parseManualVerifyReason(
  value: FormDataEntryValue | string | null | undefined
): string {
  const reason = parseOptionalManualVerifyReason(value);
  if (!reason) {
    throw new Error(
      "Enter a reason for Head Office confirmation (at least 3 characters)."
    );
  }
  return reason;
}

export function parseOptionalManualVerifyReason(
  value: FormDataEntryValue | string | null | undefined
): string | null {
  const reason = String(value ?? "").trim();
  if (!reason) return null;
  if (reason.length < MIN_REASON_LENGTH) {
    throw new Error(
      "Enter a reason for Head Office confirmation (at least 3 characters)."
    );
  }
  return reason;
}
