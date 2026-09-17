"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Gift,
  HeartPulse,
  Users,
  Wallet,
} from "lucide-react";

import DashboardCompactStat from "@/components/dashboard/DashboardCompactStat";
import DashboardSectionLabel from "@/components/dashboard/DashboardSectionLabel";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import SectionCard from "@/components/ui/SectionCard";
import { chipScrollRowClassName } from "@/components/ui/chip-scroll-row";
import StatusBadge from "@/components/ui/StatusBadge";
import type { EmployeeSelfDashboard } from "@/lib/employee-self-dashboard";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";

/**
 * The employee's own corner of the ERP. Everything here is their record only,
 * so nobody needs a module granted just to read their roster, float, or pay.
 */
export default function DashboardMyInfo({
  data,
  canOpenPettyCash,
  canOpenCards,
  canOpenPayslips,
}: {
  data: EmployeeSelfDashboard;
  canOpenPettyCash: boolean;
  canOpenCards: boolean;
  canOpenPayslips: boolean;
}) {
  const { t } = useT();

  const stats = [
    data.pay ? (
      <DashboardCompactStat
        key="earned"
        labelKey="pages.dashboard.mine.earnedSoFar"
        value={formatContractPrice(data.pay.earnedSoFar)}
        hint={
          data.pay.exemptFromCico
            ? t("pages.dashboard.mine.earnedExemptHint", {
                period: data.pay.periodLabel,
              })
            : t("pages.dashboard.mine.earnedHint", {
                days: data.pay.daysWorked,
                period: data.pay.periodLabel,
              })
        }
        icon={<Wallet size={22} />}
        accent="success"
      />
    ) : null,
    data.pettyCash ? (
      <DashboardCompactStat
        key="petty"
        labelKey="pages.dashboard.mine.pettyCash"
        value={formatContractPrice(data.pettyCash.balance)}
        hintKey={
          data.pettyCash.balance < 0
            ? "pages.dashboard.mine.pettyCashNegative"
            : "pages.dashboard.mine.pettyCashHint"
        }
        icon={<Wallet size={22} />}
        accent={data.pettyCash.balance < 0 ? "warning" : "primary"}
      />
    ) : null,
    data.bpjs ? (
      <DashboardCompactStat
        key="bpjs"
        labelKey="pages.dashboard.mine.bpjsPaid"
        value={formatContractPrice(data.bpjs.employeePaidToDate)}
        hintKey={
          data.bpjs.heldBack > 0
            ? "pages.dashboard.mine.bpjsHeld"
            : "pages.dashboard.mine.bpjsHint"
        }
        hintParams={{ amount: formatContractPrice(data.bpjs.heldBack) }}
        icon={<HeartPulse size={22} />}
        accent="info"
      />
    ) : null,
    data.thr ? (
      <DashboardCompactStat
        key="thr"
        labelKey="pages.dashboard.mine.thr"
        value={formatContractPrice(data.thr.amount)}
        hint={
          data.thr.paid
            ? t("pages.dashboard.mine.thrPaid", { year: data.thr.year })
            : t("pages.dashboard.mine.thrUpcoming", {
                date: formatDisplayDate(data.thr.hariRayaDate),
              })
        }
        icon={<Gift size={22} />}
        accent="warning"
      />
    ) : null,
  ].filter(Boolean);

  const links = [
    canOpenPettyCash && data.pettyCash
      ? { href: "/billing/petty-cash", key: "pages.dashboard.mine.openPettyCash" }
      : null,
    canOpenCards && data.prepaidCards.length > 0
      ? { href: "/billing/prepaid-cards", key: "pages.dashboard.mine.openCards" }
      : null,
    canOpenPayslips
      ? { href: "/payslips", key: "pages.dashboard.mine.openPayslips" }
      : null,
  ].filter(Boolean) as Array<{ href: string; key: string }>;

  const hasAnything =
    stats.length > 0 ||
    data.team != null ||
    data.jobs.length > 0 ||
    data.prepaidCards.length > 0;
  if (!hasAnything) return null;

  return (
    <>
      <DashboardSectionLabel
        titleKey="pages.dashboard.mine.title"
        descriptionKey="pages.dashboard.mine.description"
      />

      {stats.length > 0 && (
        <DirectoryStatGrid className="mb-5" gapClassName="gap-3 lg:gap-4">
          {stats}
        </DirectoryStatGrid>
      )}

      <div className="mb-6 flex flex-col gap-5 lg:mb-8 xl:grid xl:grid-cols-2 xl:gap-6">
        <SectionCard className="p-4 sm:p-5">
          <h3 className="text-base font-semibold text-text">
            {t("pages.dashboard.mine.myWork")}
          </h3>

          {data.team ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-text">
              <Users className="h-4 w-4 text-subtle" />
              <span>
                {t("pages.dashboard.mine.teamLine", {
                  team: data.team.name,
                  area:
                    data.team.serviceArea ??
                    t("pages.dashboard.mine.noServiceArea"),
                })}
              </span>
            </div>
          ) : null}

          {data.jobs.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">
              {t("pages.dashboard.mine.noJobs")}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.jobs.map((job) => (
                <li key={job.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <p className="min-w-0 truncate text-sm font-medium text-text">
                      {job.projectName}
                    </p>
                    {job.isBackup ? (
                      <StatusBadge status="pending" compact>
                        {t("pages.dashboard.mine.backup")}
                      </StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-subtle">
                    {[job.clientName, job.location].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-text">
                    <CalendarClock className="h-3.5 w-3.5 text-subtle" />
                    {job.shiftLabel ?? t("pages.dashboard.mine.noShiftWindow")}
                  </p>
                  {job.coveringName ? (
                    <p className="mt-0.5 text-xs text-subtle">
                      {t("pages.dashboard.mine.covering", {
                        name: job.coveringName,
                      })}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {data.prepaidCards.length > 0 || links.length > 0 ? (
          <SectionCard className="p-4 sm:p-5">
            <h3 className="text-base font-semibold text-text">
              {t("pages.dashboard.mine.myMoney")}
            </h3>

            {data.prepaidCards.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {data.prepaidCards.map((card) => (
                  <li
                    key={card.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm text-text">
                      <CreditCard className="h-4 w-4 shrink-0 text-subtle" />
                      <span className="truncate">
                        {card.vehicleLabel
                          ? `${card.cardNumber} · ${card.vehicleLabel}`
                          : card.cardNumber}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-text">
                      {formatContractPrice(card.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {links.length > 0 ? (
              <div className={chipScrollRowClassName("mt-4")}>
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-text transition hover:bg-elevated"
                  >
                    <BadgeCheck className="h-4 w-4 text-subtle" />
                    {t(link.key)}
                  </Link>
                ))}
              </div>
            ) : null}
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
