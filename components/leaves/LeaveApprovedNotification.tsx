"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";

import SectionCard from "@/components/ui/SectionCard";
import { acknowledgeLeaveApprovals } from "@/app/leaves/actions";
import type { LeaveApprovedNotificationItem } from "@/lib/leave-approval-notifications";
import { getLeaveTypeLabel } from "@/lib/i18n/leave-type";
import { useLocale } from "@/lib/i18n/use-locale";
import { useT } from "@/lib/i18n/use-t";

type Props = {
  approvals: LeaveApprovedNotificationItem[];
};

export default function LeaveApprovedNotification({ approvals }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const { t } = useT();
  const [dismissedLocally, setDismissedLocally] = useState<Set<string>>(
    () => new Set()
  );
  const [isPending, startTransition] = useTransition();

  const visible = approvals.filter((item) => !dismissedLocally.has(item.id));

  const dismiss = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      startTransition(async () => {
        await acknowledgeLeaveApprovals(ids);
        setDismissedLocally((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.add(id);
          return next;
        });
        router.refresh();
      });
    },
    [router]
  );

  if (visible.length === 0) return null;

  const primaryTypeLabel = getLeaveTypeLabel(visible[0].type, locale);

  const headline =
    visible.length === 1
      ? `Your ${primaryTypeLabel.toLowerCase()} was approved`
      : `${visible.length} leave requests were approved`;

  const detail =
    visible.length === 1
      ? `${visible[0].dateRangeLabel}${
          visible[0].reviewedAtLabel
            ? ` · Approved ${visible[0].reviewedAtLabel}`
            : ""
        }`
      : visible
          .map(
            (item) =>
              `${getLeaveTypeLabel(item.type, locale)} (${item.dateRangeLabel})`
          )
          .join(" · ");

  return (
    <SectionCard className="mb-6 border-emerald-500/25 bg-card-tint-emerald">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <p className="font-medium text-emerald-200">{headline}</p>
            <p className="mt-1 text-sm text-subtle">{detail}</p>
            {visible.length > 1 && (
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {visible.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      • {getLeaveTypeLabel(item.type, locale)}
                      <span className="text-subtle">
                        {" "}
                        — {item.dateRangeLabel}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => dismiss([item.id])}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-emerald-300 transition hover:bg-elevated disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/leaves"
              className="mt-2 inline-block text-sm font-medium text-emerald-300/90 transition hover:text-emerald-200"
            >
              View leave requests
            </Link>
          </div>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={() => dismiss(visible.map((item) => item.id))}
          aria-label={t("pages.leaves.dismissApprovedNotification")}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-elevated px-3 text-sm font-medium text-emerald-200 transition hover:bg-elevated disabled:opacity-50"
        >
          <X size={14} />
          {isPending ? "Saving…" : "Got it"}
        </button>
      </div>
    </SectionCard>
  );
}
