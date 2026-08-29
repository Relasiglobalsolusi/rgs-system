export const TEAM_CALENDAR_TIMEZONE = "Asia/Jakarta";

type CalendarDay = {
  year: number;
  month: number;
  day: number;
  date: Date;
  key: string;
};

function jakartaParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEAM_CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, day };
}

export function parseYearMonth(
  raw: string | null | undefined
): { year: number; month: number } {
  const today = jakartaParts();
  const match = raw?.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return { year: today.year, month: today.month };
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) {
    return { year: today.year, month: today.month };
  }
  return { year, month };
}

export function yearMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftYearMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function daysInMonth(year: number, month: number): CalendarDay[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    return {
      year,
      month,
      day,
      date: new Date(Date.UTC(year, month - 1, day)),
      key: `${yearMonthKey(year, month)}-${String(day).padStart(2, "0")}`,
    };
  });
}

export function jakartaTodayKey() {
  const { year, month, day } = jakartaParts();
  return `${yearMonthKey(year, month)}-${String(day).padStart(2, "0")}`;
}
