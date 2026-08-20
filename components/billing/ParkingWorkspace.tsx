"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveParkingMonthlyRevenue } from "@/app/billing/parking-actions";
import type { ParkingMonthEconomics } from "@/lib/parking-economics";
import { employeeSelectTriggerClass } from "@/components/employees/employee-dialog-ui";
import SectionCard from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { showRejectionFromError } from "@/components/ui/rejection-notice";

type Props = {
  projectId: string;
  clientId: string;
  year: number;
  month: number;
  canManage: boolean;
  economics: ParkingMonthEconomics;
};

export default function ParkingWorkspace({
  projectId,
  clientId,
  year,
  month,
  canManage,
  economics,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revenue, setRevenue] = useState(
    economics.casualRevenue > 0
      ? String(Math.round(economics.casualRevenue))
      : ""
  );
  const [notes, setNotes] = useState(economics.notes ?? "");

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    []
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from(
      new Set([
        ...Array.from({ length: 8 }, (_, i) => currentYear - 5 + i),
        year,
      ])
    ).sort((a, b) => a - b);
  }, [year]);

  function navigatePeriod(nextYear: number, nextMonth: number) {
    startTransition(() => {
      router.push(
        `/billing/${clientId}/${projectId}?year=${nextYear}&month=${nextMonth}`
      );
    });
  }

  function onSave() {
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("year", String(year));
    formData.set("month", String(month));
    formData.set("revenueAmount", revenue);
    formData.set("notes", notes);
    startTransition(async () => {
      try {
        await saveParkingMonthlyRevenue(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.billing.parking.saveFailed"));
      }
    });
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-text">
              {t("pages.billing.parking.monthTitle")}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t("pages.billing.parking.monthDesc")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={String(month)}
              onValueChange={(value) => navigatePeriod(year, Number(value))}
              disabled={pending}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {t(`pages.reports.months.${value}` as Parameters<typeof t>[0])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(year)}
              onValueChange={(value) => navigatePeriod(Number(value), month)}
              disabled={pending}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-subtle">
              {t("pages.projects.serviceCommercial.setupCost")}
            </dt>
            <dd className="mt-1 font-medium text-text">
              {formatContractPrice(economics.deal.setupCost)}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">
              {t("pages.projects.serviceCommercial.profitSharePercent")}
            </dt>
            <dd className="mt-1 font-medium text-text">
              {economics.deal.profitSharePercent}%
            </dd>
          </div>
          <div>
            <dt className="text-subtle">
              {t("pages.projects.serviceCommercial.monthlyClientFee")}
            </dt>
            <dd className="mt-1 font-medium text-text">
              {formatContractPrice(economics.deal.monthlyClientFee)}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">
              {t("pages.projects.serviceCommercial.memberParkingUnitFee")}
            </dt>
            <dd className="mt-1 font-medium text-text">
              {formatContractPrice(economics.deal.memberParkingUnitFee)}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">
              {t("pages.projects.serviceCommercial.memberParkingUnitCount")}
            </dt>
            <dd className="mt-1 font-medium text-text">
              {economics.deal.memberParkingUnitCount}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">
              {t("pages.projects.serviceCommercial.parkingTaxPercent")}
            </dt>
            <dd className="mt-1 font-medium text-text">
              {economics.deal.parkingTaxPercent}%
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          {t("pages.billing.parking.dealReadOnly")}
        </p>
      </SectionCard>

      <SectionCard>
        <h3 className="text-lg font-semibold text-text">
          {t("pages.billing.parking.revenueTitle")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t("pages.billing.parking.casualRevenueDesc")}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              {t("pages.billing.parking.casualRevenue")}
            </label>
            <Input
              type="number"
              min={0}
              step="1"
              value={revenue}
              onChange={(event) => setRevenue(event.target.value)}
              disabled={!canManage || pending}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              {t("pages.billing.parking.notes")}
            </label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!canManage || pending}
              rows={3}
            />
          </div>
        </div>
        {canManage ? (
          <div className="mt-4">
            <Button type="button" onClick={onSave} disabled={pending}>
              {pending
                ? t("pages.billing.parking.saving")
                : t("pages.billing.parking.saveRevenue")}
            </Button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard>
        <h3 className="text-lg font-semibold text-text">
          {t("pages.billing.parking.outflowsTitle")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t("pages.billing.parking.outflowsDesc")}
        </p>
        {economics.outflows.length === 0 ? (
          <p className="mt-4 text-sm text-subtle">
            {t("pages.billing.parking.noOutflows")}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {economics.outflows.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-muted">{row.label}</span>
                <span className="tabular-nums text-text">
                  {formatContractPrice(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.parking.casualRevenue")}
            </p>
            <p className="mt-1 text-base font-semibold text-text">
              {formatContractPrice(economics.casualRevenue)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.parking.memberRevenue")}
            </p>
            <p className="mt-1 text-base font-semibold text-text">
              {formatContractPrice(economics.memberRevenue)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.parking.casualTax")}
            </p>
            <p className="mt-1 text-base font-semibold text-text">
              {formatContractPrice(economics.taxOut)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.parking.revenue")}
            </p>
            <p className="mt-1 text-base font-semibold text-text">
              {formatContractPrice(economics.revenue)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.parking.moneyOut")}
            </p>
            <p className="mt-1 text-base font-semibold text-text">
              {formatContractPrice(economics.moneyOut)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-elevated/40 p-3">
            <p className="text-xs text-muted">
              {t("pages.billing.parking.netProfit")}
            </p>
            <p
              className={`mt-1 text-base font-semibold ${
                economics.netProfit < 0 ? "text-danger" : "text-text"
              }`}
            >
              {formatContractPrice(economics.netProfit)}
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
