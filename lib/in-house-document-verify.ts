/**
 * Head Office confirms payment and tax documents in the app.
 * Files stay on this server.
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
