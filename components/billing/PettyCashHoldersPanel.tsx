"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import PettyCashPayWageDialog from "@/components/billing/PettyCashPayWageDialog";
import PettyCashSpendDialog from "@/components/billing/PettyCashSpendDialog";
import PettyCashTransferDialog from "@/components/billing/PettyCashTransferDialog";
import EmptyState from "@/components/ui/EmptyState";
import FinanceRecordRow, {
  financeListStatusChipClassName,
  financeRecordListClassName,
} from "@/components/ui/FinanceRecordRow";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import UploadedFilesLink from "@/components/ui/UploadedFilesLink";
import { Button } from "@/components/ui/button";
import { directoryToolbarActionClass } from "@/components/ui/DirectoryFilterSelect";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import {
  type PettyCashHolderView,
  type UnpaidPartTimeWageView,
} from "@/lib/petty-cash-query";
import { formatContractPrice } from "@/lib/project-billing";

type ProjectOption = {
  id: string;
  name: string;
  clientName: string | null;
  subCategory?: string | null;
};

type ClientOption = { id: string; name: string };
type EmployeeOption = { id: string; name: string };

function statusTone(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "POSTED") return "success";
  if (status === "VOIDED") return "danger";
  return "warning";
}

function isInflow(kind: string) {
  return kind === "TOP_UP" || kind === "TRANSFER_IN";
}

export default function PettyCashHoldersPanel({
  holders,
  unpaidWages,
  employees,
  projects,
  clients,
  currentPayerId = null,
  currentPayerName = null,
}: {
  holders: PettyCashHolderView[];
  unpaidWages: UnpaidPartTimeWageView[];
  employees: EmployeeOption[];
  projects: ProjectOption[];
  clients: ClientOption[];
  currentPayerId?: string | null;
  currentPayerName?: string | null;
}) {
  const { t } = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spendOpen, setSpendOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [payWageId, setPayWageId] = useState<string | null>(null);
  const selected = holders.find((holder) => holder.id === selectedId) ?? null;
  const payWage = unpaidWages.find((wage) => wage.id === payWageId) ?? null;
  const currentPayerBalance =
    currentPayerId
      ? holders.find((holder) => holder.id === currentPayerId)?.balance ?? 0
      : null;

  function holderName(holder: PettyCashHolderView) {
    return holder.name;
  }

  function kindLabel(kind: string) {
    if (kind === "TOP_UP") return t("pages.pettyCash.kind.TOP_UP");
    if (kind === "SPEND") return t("pages.pettyCash.kind.SPEND");
    if (kind === "PART_TIME_PAY") return t("pages.pettyCash.kind.PART_TIME_PAY");
    if (kind === "TRANSFER_OUT") return t("pages.pettyCash.kind.TRANSFER_OUT");
    if (kind === "TRANSFER_IN") return t("pages.pettyCash.kind.TRANSFER_IN");
    return kind;
  }

  if (selected) {
    return (
      <div className="space-y-5">
        <SectionCard className="space-y-4 p-5 sm:p-6">
          <div>
            <Button
              type="button"
              variant="infoBadge"
              size="badgeFlex"
              className="gap-1.5"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft className="size-3.5 shrink-0 opacity-80" aria-hidden />
              {t("pages.pettyCash.backToHolders")}
            </Button>
            <h2 className="mt-3 text-lg font-semibold tracking-tight text-text">
              {holderName(selected)}
            </h2>
            {selected.employeeNo ? (
              <p className="mt-1 text-sm text-subtle">{selected.employeeNo}</p>
            ) : null}
          </div>
          <p className="text-sm font-semibold text-text">
            {t("pages.pettyCash.currentBalance")}:{" "}
            {formatContractPrice(selected.balance)}
          </p>
          {selected.balance < 0 ? (
            <p className="text-sm text-danger">
              {t("pages.pettyCash.negativeHolderWarning")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="permissionsBadge"
              size="badgeFlex"
              className={directoryToolbarActionClass}
              onClick={() => setSpendOpen(true)}
            >
              {t("pages.pettyCash.recordSpend")}
            </Button>
            <Button
              type="button"
              variant="permissionsBadge"
              size="badgeFlex"
              className={directoryToolbarActionClass}
              onClick={() => setTransferOpen(true)}
            >
              {t("pages.pettyCash.transfer")}
            </Button>
          </div>
        </SectionCard>

        {selected.entries.length === 0 ? (
          <p className="text-sm text-muted">{t("pages.pettyCash.holderEntriesEmpty")}</p>
        ) : (
          <div className={financeRecordListClassName}>
            {selected.entries.map((entry) => (
              <FinanceRecordRow
                key={entry.id}
                title={
                  <>
                    <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                      {entry.description}
                    </h3>
                    <p className="mt-1 truncate text-xs leading-none text-subtle">
                      {formatDisplayDate(entry.entryDate, { timeZone: "UTC" })}
                      <span className="mx-1.5 text-border-strong" aria-hidden>
                        ·
                      </span>
                      {kindLabel(entry.kind)}
                      {entry.projectName || entry.clientName ? (
                        <>
                          <span className="mx-1.5 text-border-strong" aria-hidden>
                            ·
                          </span>
                          {entry.projectName || entry.clientName}
                        </>
                      ) : null}
                    </p>
                    {entry.proofPath ? (
                      <UploadedFilesLink value={entry.proofPath} />
                    ) : null}
                  </>
                }
                status={
                  <StatusBadge
                    status={statusTone(entry.status)}
                    className={financeListStatusChipClassName}
                  >
                    <span className="flex h-full w-full items-center justify-center text-center leading-none">
                      {t(`pages.pettyCash.status.${entry.status}` as "pages.pettyCash.status.POSTED")}
                    </span>
                  </StatusBadge>
                }
                amount={`${isInflow(entry.kind) ? "+" : "−"}${formatContractPrice(entry.amount)}`}
              />
            ))}
          </div>
        )}

        <PettyCashSpendDialog
          projects={projects}
          clients={clients}
          holderId={selected.id}
          open={spendOpen}
          onOpenChange={setSpendOpen}
          showTrigger={false}
        />
        <PettyCashTransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          fromEmployeeId={selected.id}
          fromName={holderName(selected)}
          fromBalance={selected.balance}
          employees={employees}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-end gap-3">
        <PettyCashSpendDialog
          projects={projects}
          clients={clients}
          holderId={currentPayerId ?? ""}
        />
      </div>
      {holders.length === 0 && unpaidWages.length === 0 ? (
        <SectionCard className="p-5 sm:p-6">
          <EmptyState
            titleKey="pages.pettyCash.holdersEmptyTitle"
            descriptionKey="pages.pettyCash.holdersEmptyDesc"
          />
        </SectionCard>
      ) : (
        <div className={financeRecordListClassName}>
          {unpaidWages.map((wage) => (
            <FinanceRecordRow
              key={wage.id}
              title={
                <div className="w-full text-left">
                  <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                    {wage.employeeName}{" "}
                    <span className="font-medium text-subtle">
                      ({t("pages.pettyCash.unpaidWageTag")})
                    </span>
                  </h3>
                  <p className="mt-1 truncate text-xs leading-none text-subtle">
                    {formatDisplayDate(wage.entryDate, { timeZone: "UTC" })}
                    {wage.projectName ? (
                      <>
                        <span className="mx-1.5 text-border-strong" aria-hidden>
                          ·
                        </span>
                        {wage.projectName}
                      </>
                    ) : null}
                  </p>
                </div>
              }
              status={
                <Button
                  type="button"
                  variant="permissionsBadge"
                  size="badgeFlex"
                  className={`${directoryToolbarActionClass} min-w-[7.5rem]`}
                  onClick={() => setPayWageId(wage.id)}
                >
                  {t("pages.pettyCash.unpaidWagePay")}
                </Button>
              }
              amount={formatContractPrice(wage.amount)}
            />
          ))}
          {holders.map((holder) => (
            <FinanceRecordRow
              key={holder.id}
              title={
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedId(holder.id)}
                >
                  <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                    {holderName(holder)}
                  </h3>
                  <p className="mt-1 truncate text-xs leading-none text-subtle">
                    {holder.employeeNo || t("pages.pettyCash.holderRowHint")}
                  </p>
                </button>
              }
              status={
                holder.balance < 0 ? (
                  <StatusBadge status="danger" className={financeListStatusChipClassName}>
                    {t("pages.pettyCash.statusNegative")}
                  </StatusBadge>
                ) : (
                  <StatusBadge status="success" className={financeListStatusChipClassName}>
                    {t("pages.pettyCash.statusReady")}
                  </StatusBadge>
                )
              }
              amount={formatContractPrice(holder.balance)}
            />
          ))}
        </div>
      )}
      <PettyCashPayWageDialog
        open={Boolean(payWage)}
        onOpenChange={(next) => {
          if (!next) setPayWageId(null);
        }}
        wage={payWage}
        employees={employees}
        preferredPayerId={currentPayerId}
        preferredPayerName={currentPayerName}
        preferredPayerBalance={currentPayerBalance}
      />
    </div>
  );
}
