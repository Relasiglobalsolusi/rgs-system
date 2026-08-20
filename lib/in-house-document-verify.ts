/**
 * Head Office verifies payment / tax documents in the app.
 * Files stay on this server. Cloud reading is optional and off unless configured.
 */

const MIN_REASON_LENGTH = 3;

export function parseManualVerifyReason(
  value: FormDataEntryValue | string | null | undefined
): string {
  const reason = String(value ?? "").trim();
  if (reason.length < MIN_REASON_LENGTH) {
    throw new Error(
      "Enter a reason for Head Office confirmation (at least 3 characters)."
    );
  }
  return reason;
}
