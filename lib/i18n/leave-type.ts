import { getLocale, type AppLocale } from "@/lib/i18n/locale";

export type LeaveRequestType = "PERMISSION" | "SICK";

const LEAVE_TYPE_LABELS: Record<
  AppLocale,
  Record<LeaveRequestType, string>
> = {
  en: {
    PERMISSION: "Permission",
    SICK: "Sick Leave",
  },
  id: {
    PERMISSION: "Izin",
    SICK: "Sakit",
  },
};

export function isLeaveRequestType(value: unknown): value is LeaveRequestType {
  return value === "PERMISSION" || value === "SICK";
}

/** Localized leave/sick request type label for the active (or given) locale. */
export function getLeaveTypeLabel(
  type: string,
  locale: AppLocale = getLocale()
): string {
  const key = isLeaveRequestType(type) ? type : "PERMISSION";
  return LEAVE_TYPE_LABELS[locale][key];
}

export function getLeaveTypeOptions(locale: AppLocale = getLocale()) {
  return [
    {
      value: "PERMISSION" as const,
      label: LEAVE_TYPE_LABELS[locale].PERMISSION,
    },
    {
      value: "SICK" as const,
      label: LEAVE_TYPE_LABELS[locale].SICK,
    },
  ] as const;
}
