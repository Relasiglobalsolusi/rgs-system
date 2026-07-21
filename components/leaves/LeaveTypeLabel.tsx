"use client";

import { getLeaveTypeLabel } from "@/lib/i18n/leave-type";
import { useLocale } from "@/lib/i18n/use-locale";

type Props = {
  type: string;
};

/** Locale-aware leave request type text (Permission / Sick Leave ↔ Izin / Sakit). */
export default function LeaveTypeLabel({ type }: Props) {
  const locale = useLocale();
  return <>{getLeaveTypeLabel(type, locale)}</>;
}
