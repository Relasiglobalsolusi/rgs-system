/** App local timezone for progress-report deadlines (Indonesia). */
const APP_TIMEZONE = "Asia/Jakarta";

/**
 * Calendar date string (YYYY-MM-DD) for `instant` in Asia/Jakarta.
 * Jakarta has no DST (UTC+7 year-round).
 */
export function formatAppDateInput(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
