"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  CreditCard,
  Scale,
} from "lucide-react";

import {
  assignPrepaidCard,
  createPrepaidCard,
  markPrepaidCardDamaged,
  reassignPrepaidCard,
  recordPrepaidCardSpend,
  replacePrepaidCard,
  reportPrepaidCardLost,
  reportPrepaidCardMisuse,
  returnPrepaidCardToList,
} from "@/app/billing/prepaid-cards/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
  choiceGridClassForCount,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { FileDropField } from "@/components/ui/FileDropField";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  showMissingRequiredFields,
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useConfirm } from "@/components/ui/confirm-dialog";
import VehicleOdometerFields from "@/components/vehicles/VehicleOdometerFields";
import { fuelFillConfirmRequest } from "@/lib/vehicle-odometer-confirm";
import {
  parseLitres,
  parseOdometerKm,
  previewFuelFill,
  type VehicleOdometerOption,
} from "@/lib/vehicle-odometer";
import FinanceRecordRow, {
  financeListStatusChipClassName,
  financeRecordListClassName,
} from "@/components/ui/FinanceRecordRow";
import EmptyState from "@/components/ui/EmptyState";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import DirectoryStatGrid from "@/components/ui/DirectoryStatGrid";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import SectionCard from "@/components/ui/SectionCard";
import StatusBadge from "@/components/ui/StatusBadge";
import UploadedFilesLink from "@/components/ui/UploadedFilesLink";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice, parseContractPrice } from "@/lib/project-billing";
import { todayDateInput } from "@/lib/project-contract";
import { formatDisplayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  directoryToolbarActionClass,
  directoryToolbarDownloadClass,
} from "@/components/ui/DirectoryFilterSelect";
import { Button } from "@/components/ui/button";
import { jakartaYearMonth } from "@/lib/vat";
import { formatVehicleIdentityLabel } from "@/lib/vehicle-plate";
import {
  canAssignPrepaidCard,
  canMarkPrepaidCardDamaged,
  canReplacePrepaidCard,
  canReportPrepaidCardLost,
  canReturnPrepaidCard,
  canSpendOnPrepaidCard,
  formatPrepaidCardNumber,
} from "@/lib/prepaid-card";
import type {
  PrepaidCardLossView,
  PrepaidCardView,
  PrepaidEmployeeOption,
} from "@/lib/prepaid-card-query";

type VehicleOption = {
  id: string;
  name: string;
  sku: string;
  plate: string | null;
  year?: number | null;
};

type BankOption = { id: string; label: string };

function cardSubtitle(card: PrepaidCardView, standbyLabel: string) {
  if (card.kind === "VEHICLE") {
    if (card.vehicleName) {
      return formatVehicleIdentityLabel({
        plate: card.vehiclePlate,
        name: card.vehicleName,
        sku: card.vehicleSku,
        year: card.vehicleYear,
      });
    }
    const last = card.assignments[0];
    return last?.vehicleLabel || standbyLabel;
  }
  return card.custodianName || card.assignments[0]?.custodianName || standbyLabel;
}

/** Vehicle / PIC first — people recognize the car, not the digits. */
function CardIdentityStack({
  card,
  standbyLabel,
  titleClassName,
  numberClassName,
}: {
  card: PrepaidCardView;
  standbyLabel: string;
  titleClassName?: string;
  numberClassName?: string;
}) {
  return (
    <span className="flex min-w-0 flex-col items-start text-left">
      <span className={cn("min-w-0 truncate font-semibold text-text", titleClassName)}>
        {cardSubtitle(card, standbyLabel)}
      </span>
      <span className={cn("min-w-0 truncate text-xs text-subtle", numberClassName)}>
        {formatPrepaidCardNumber(card.cardNumber)}
      </span>
    </span>
  );
}

function statusTone(
  status: string
): "success" | "warning" | "danger" | "info" | "inactive" {
  if (status === "ACTIVE") return "success";
  if (status === "DAMAGED") return "warning";
  if (status === "LOST") return "danger";
  if (status === "REPLACED") return "inactive";
  return "info";
}

function prepaidStatusLabelKey(
  status: string
):
  | "pages.pettyCash.statusActive"
  | "pages.pettyCash.statusStandby"
  | "pages.pettyCash.statusDamaged"
  | "pages.pettyCash.statusLost"
  | "pages.pettyCash.statusReplaced" {
  if (status === "STANDBY") return "pages.pettyCash.statusStandby";
  if (status === "DAMAGED") return "pages.pettyCash.statusDamaged";
  if (status === "LOST") return "pages.pettyCash.statusLost";
  if (status === "REPLACED") return "pages.pettyCash.statusReplaced";
  return "pages.pettyCash.statusActive";
}

function entrySigned(kind: string, amount: number, previous: number, resulting: number) {
  if (kind === "TOP_UP" || kind === "TRANSFER_IN") return amount;
  if (kind === "REPLACEMENT_FEE" && previous === resulting) return 0;
  return -amount;
}

function prepaidEntryKindLabel(
  t: (key: string) => string,
  entry: { kind: string; spendKind: string | null }
) {
  if (entry.kind === "TOP_UP") return t("pages.pettyCash.kind.TOP_UP");
  if (entry.kind === "WRITE_OFF") return t("pages.pettyCash.kind.WRITE_OFF");
  if (entry.kind === "REPLACEMENT_FEE") {
    return t("pages.pettyCash.kind.REPLACEMENT_FEE");
  }
  if (entry.kind === "TRANSFER_OUT") return t("pages.pettyCash.kind.TRANSFER_OUT");
  if (entry.kind === "TRANSFER_IN") return t("pages.pettyCash.kind.TRANSFER_IN");
  if (entry.spendKind === "TOLL") return t("pages.pettyCash.spendToll");
  if (entry.spendKind === "PARKING") return t("pages.pettyCash.spendParking");
  if (entry.spendKind === "OTHER") return t("pages.pettyCash.spendOther");
  return t("pages.pettyCash.spendFuel");
}

export default function PrepaidCardsPanel({
  cards,
  losses,
  vehicles,
  employees,
  bankAccounts,
  canManageCards = false,
  showModuleTabs = false,
}: {
  cards: PrepaidCardView[];
  losses: PrepaidCardLossView[];
  vehicles: VehicleOption[];
  employees: PrepaidEmployeeOption[];
  bankAccounts: BankOption[];
  canManageCards?: boolean;
  showModuleTabs?: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const now = jakartaYearMonth();
  const [kindTab, setKindTab] = useState<"VEHICLE" | "OPEN">("VEHICLE");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedPicId, setSelectedPicId] = useState<string | null>(null);
  const [writtenOffOpen, setWrittenOffOpen] = useState(false);
  const [lossId, setLossId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [damagedOpen, setDamagedOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [misuseOpen, setMisuseOpen] = useState(false);
  const [filterCardId, setFilterCardId] = useState("all");
  const [filterYear, setFilterYear] = useState(String(now.year));
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterDay, setFilterDay] = useState("all");
  const [filterMovement, setFilterMovement] = useState("all");
  const [filterSpendKind, setFilterSpendKind] = useState("all");
  const [filterAssignment, setFilterAssignment] = useState("all");

  const selectedCard = cards.find((card) => card.id === selectedCardId) ?? null;
  const selectedLoss = losses.find((loss) => loss.id === lossId) ?? null;
  const yearOptions = Array.from({ length: 6 }, (_, index) => String(now.year - index));
  const standbyCards = cards.filter(
    (card) => card.kind === kindTab && card.status === "STANDBY"
  );

  const kindCards = cards.filter((card) => card.kind === kindTab);
  const listCards = kindCards.filter((card) => {
    if (filterCardId !== "all" && card.id !== filterCardId) return false;
    if (filterAssignment === "assigned") {
      return Boolean(card.vehicleItemId || card.custodianEmployeeId);
    }
    if (filterAssignment === "standby") return card.status === "STANDBY";
    return true;
  });

  const filteredEntries = useMemo(() => {
    const year = Number(filterYear);
    const month = filterMonth === "all" ? null : Number(filterMonth);
    const day = filterDay === "all" ? null : Number(filterDay);
    return cards.flatMap((card) => {
      if (card.kind !== kindTab) return [];
      if (filterCardId !== "all" && card.id !== filterCardId) return [];
      if (selectedCardId && card.id !== selectedCardId) return [];
      return card.entries
        .filter((entry) => {
          if (selectedPicId && entry.assignmentId) {
            const assignment = card.assignments.find(
              (row) => row.id === entry.assignmentId
            );
            if (assignment?.custodianEmployeeId !== selectedPicId) return false;
          }
          const date = new Date(`${entry.entryDate}T00:00:00Z`);
          if (date.getUTCFullYear() !== year) return false;
          if (month != null && date.getUTCMonth() + 1 !== month) return false;
          if (day != null && date.getUTCDate() !== day) return false;
          if (filterMovement === "TOP_UP" && entry.kind !== "TOP_UP") return false;
          if (filterMovement === "SPEND" && entry.kind !== "SPEND") return false;
          if (filterMovement === "WRITE_OFF" && entry.kind !== "WRITE_OFF") {
            return false;
          }
          if (
            (filterMovement === "all" || filterMovement === "SPEND") &&
            filterSpendKind !== "all" &&
            entry.kind === "SPEND" &&
            entry.spendKind !== filterSpendKind
          ) {
            return false;
          }
          if (
            filterMovement === "all" &&
            filterSpendKind !== "all" &&
            entry.kind !== "SPEND"
          ) {
            return false;
          }
          return true;
        })
        .map((entry) => ({ ...entry, card }));
    });
  }, [
    cards,
    filterCardId,
    filterYear,
    filterMonth,
    filterDay,
    filterMovement,
    filterSpendKind,
    kindTab,
    selectedCardId,
    selectedPicId,
  ]);

  const totalTopUp = filteredEntries
    .filter((entry) => entry.kind === "TOP_UP")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalSpend = filteredEntries
    .filter((entry) => entry.kind === "SPEND")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const writtenOffHeadline = losses.reduce(
    (sum, loss) => sum + loss.hoAbsorbed + loss.employeeLeft,
    0
  );

  const reportHref = `/api/billing/prepaid-card-report?year=${filterYear}${
    filterMonth !== "all" ? `&month=${filterMonth}` : "&month=all"
  }${filterDay !== "all" ? `&day=${filterDay}` : ""}${
    filterCardId !== "all" ? `&card=${filterCardId}` : ""
  }&movement=${filterMovement}&spendKind=${filterSpendKind}&cardType=${kindTab}&assignment=${filterAssignment}`;

  if (writtenOffOpen) {
    return (
      <WrittenOffView
        losses={losses}
        selected={selectedLoss}
        onBack={() => {
          setWrittenOffOpen(false);
          setLossId(null);
        }}
        onOpen={setLossId}
      />
    );
  }

  return (
    <div className="space-y-5">
      {selectedCard ? null : (
        <>
      {showModuleTabs ? (
        <div className="flex flex-wrap items-center gap-2">
          <DirectoryFilterTab href="/billing/petty-cash" active={false}>
            {t("pages.pettyCash.tabPetty")}
          </DirectoryFilterTab>
          <DirectoryFilterTab href="/billing/petty-cash?tab=prepaid" active>
            {t("pages.pettyCash.tabPrepaid")}
          </DirectoryFilterTab>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <DirectoryFilterTab
          active={kindTab === "VEHICLE"}
          onClick={() => {
            setKindTab("VEHICLE");
            setSelectedCardId(null);
            setSelectedPicId(null);
            setFilterCardId("all");
          }}
        >
          {t("pages.pettyCash.tabVehicleCards")}
        </DirectoryFilterTab>
        <DirectoryFilterTab
          active={kindTab === "OPEN"}
          onClick={() => {
            setKindTab("OPEN");
            setSelectedCardId(null);
            setSelectedPicId(null);
            setFilterCardId("all");
          }}
        >
          {t("pages.pettyCash.tabOpenCards")}
        </DirectoryFilterTab>
      </div>

      {canManageCards ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="permissionsBadge"
            size="badgeFlex"
            className={directoryToolbarActionClass}
            onClick={() => setCreateOpen(true)}
          >
            {t("pages.pettyCash.prepaidAddCard")}
          </Button>
        </div>
      ) : null}

      <DirectoryStatGrid>
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.pettyCash.totalTopUp")}
          value={formatContractPrice(totalTopUp)}
          accent="success"
          icon={<ArrowDownLeft size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.pettyCash.totalSpend")}
          value={formatContractPrice(totalSpend)}
          accent="warning"
          icon={<ArrowUpRight size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.pettyCash.netPosition")}
          value={formatContractPrice(totalTopUp - totalSpend)}
          accent={totalTopUp - totalSpend < 0 ? "danger" : "info"}
          icon={<Scale size={18} />}
        />
        <DirectoryStatCard
          compact
          tinted
          title={t("pages.pettyCash.writtenOff")}
          value={formatContractPrice(writtenOffHeadline)}
          accent="danger"
          icon={<Ban size={18} />}
          onClick={() => setWrittenOffOpen(true)}
        />
      </DirectoryStatGrid>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <FilterSelect
            label={t("pages.pettyCash.filterDay")}
            value={filterDay}
            onChange={setFilterDay}
            formatValue={(value) =>
              value === "all" ? t("pages.pettyCash.filterAllDays") : value
            }
          >
            <SelectItem value="all">{t("pages.pettyCash.filterAllDays")}</SelectItem>
            {Array.from({ length: 31 }, (_, index) => String(index + 1)).map((day) => (
              <SelectItem key={day} value={day}>
                {day}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            label={t("pages.pettyCash.filterMonth")}
            value={filterMonth}
            onChange={(value) => {
              setFilterMonth(value);
              setFilterDay("all");
            }}
            formatValue={(value) =>
              value === "all"
                ? t("pages.pettyCash.filterAllMonths")
                : t(`pages.reports.months.${value}`)
            }
          >
            <SelectItem value="all">{t("pages.pettyCash.filterAllMonths")}</SelectItem>
            {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => (
              <SelectItem key={month} value={month}>
                {t(`pages.reports.months.${month}`)}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            label={t("pages.pettyCash.filterYear")}
            value={filterYear}
            onChange={setFilterYear}
            formatValue={(value) => value}
          >
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect
            label={t("pages.pettyCash.filterMovement")}
            value={filterMovement}
            onChange={(value) => {
              setFilterMovement(value);
              if (value !== "all" && value !== "SPEND") setFilterSpendKind("all");
            }}
            formatValue={(value) =>
              value === "all"
                ? t("pages.pettyCash.filterAllMovements")
                : t(`pages.pettyCash.filterMovement${value === "TOP_UP" ? "TopUp" : value === "SPEND" ? "Spend" : "WrittenOff"}`)
            }
          >
            <SelectItem value="all">{t("pages.pettyCash.filterAllMovements")}</SelectItem>
            <SelectItem value="TOP_UP">{t("pages.pettyCash.filterMovementTopUp")}</SelectItem>
            <SelectItem value="SPEND">{t("pages.pettyCash.filterMovementSpend")}</SelectItem>
            <SelectItem value="WRITE_OFF">{t("pages.pettyCash.filterMovementWrittenOff")}</SelectItem>
          </FilterSelect>
          {filterMovement === "all" || filterMovement === "SPEND" ? (
            <FilterSelect
              label={t("pages.pettyCash.filterSpendKind")}
              value={filterSpendKind}
              onChange={setFilterSpendKind}
              formatValue={(value) =>
                value === "all"
                  ? t("pages.pettyCash.filterAllSpendKinds")
                  : t(`pages.pettyCash.spend${value === "FUEL" ? "Fuel" : value === "TOLL" ? "Toll" : value === "PARKING" ? "Parking" : "Other"}`)
              }
            >
              <SelectItem value="all">{t("pages.pettyCash.filterAllSpendKinds")}</SelectItem>
              <SelectItem value="FUEL">{t("pages.pettyCash.spendFuel")}</SelectItem>
              <SelectItem value="TOLL">{t("pages.pettyCash.spendToll")}</SelectItem>
              <SelectItem value="PARKING">{t("pages.pettyCash.spendParking")}</SelectItem>
              <SelectItem value="OTHER">{t("pages.pettyCash.spendOther")}</SelectItem>
            </FilterSelect>
          ) : null}
          <FilterSelect
            label={t("pages.pettyCash.filterAssignment")}
            value={filterAssignment}
            onChange={setFilterAssignment}
            formatValue={(value) =>
              value === "all"
                ? t("pages.pettyCash.filterAllAssignments")
                : value === "assigned"
                  ? t("pages.pettyCash.filterAssigned")
                  : t("pages.pettyCash.filterStandby")
            }
          >
            <SelectItem value="all">{t("pages.pettyCash.filterAllAssignments")}</SelectItem>
            <SelectItem value="assigned">{t("pages.pettyCash.filterAssigned")}</SelectItem>
            <SelectItem value="standby">{t("pages.pettyCash.filterStandby")}</SelectItem>
          </FilterSelect>
          <FilterSelect
            label={t("pages.pettyCash.filterCard")}
            value={filterCardId}
            onChange={setFilterCardId}
            className="w-[13.5rem] max-w-full"
            triggerClassName={
              filterCardId !== "all" ? "h-auto min-h-9 py-1.5" : undefined
            }
            formatValue={(value) => {
              if (value === "all") return t("pages.pettyCash.filterAllCards");
              const card = cards.find((row) => row.id === value);
              return card ? (
                <CardIdentityStack
                  card={card}
                  standbyLabel={t("pages.pettyCash.statusStandby")}
                  titleClassName="text-sm"
                />
              ) : (
                t("pages.pettyCash.filterAllCards")
              );
            }}
          >
            <SelectItem value="all">{t("pages.pettyCash.filterAllCards")}</SelectItem>
            {kindCards.map((card) => (
              <SelectItem
                key={card.id}
                value={card.id}
                className="items-start whitespace-normal"
              >
                <CardIdentityStack
                  card={card}
                  standbyLabel={t("pages.pettyCash.statusStandby")}
                />
              </SelectItem>
            ))}
          </FilterSelect>
        </div>
        <div className="flex w-full flex-row items-center gap-2 lg:w-auto">
          <a
            href={reportHref}
            className={`${directoryToolbarDownloadClass} min-w-0 flex-1 justify-center lg:flex-none`}
          >
            {t("pages.pettyCash.downloadReport")}
          </a>
          <Button
            type="button"
            variant="permissionsBadge"
            size="badgeFlex"
            className={`${directoryToolbarActionClass} min-w-0 flex-1 justify-center lg:flex-none`}
            onClick={() => setSpendOpen(true)}
          >
            {t("pages.pettyCash.prepaidSpend")}
          </Button>
        </div>
      </div>
        </>
      )}

      {selectedCard ? (
        <CardDetail
          card={selectedCard}
          canManageCards={canManageCards}
          selectedPicId={selectedPicId}
          onSelectPic={setSelectedPicId}
          onBack={() => {
            setSelectedCardId(null);
            setSelectedPicId(null);
          }}
          onAssign={() => setAssignOpen(true)}
          onReassign={() => setReassignOpen(true)}
          onDamaged={() => setDamagedOpen(true)}
          onReplace={() => setReplaceOpen(true)}
          onLost={() => setLostOpen(true)}
          onMisuse={() => setMisuseOpen(true)}
          onSpend={() => setSpendOpen(true)}
        />
      ) : listCards.length === 0 ? (
        <SectionCard className="p-5 sm:p-6">
          <EmptyState
            titleKey="pages.pettyCash.prepaidEmptyTitle"
            descriptionKey="pages.pettyCash.prepaidEmptyDesc"
          />
        </SectionCard>
      ) : (
        <div className={financeRecordListClassName}>
          {listCards.map((card) => (
            <FinanceRecordRow
              key={card.id}
              title={
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedCardId(card.id)}
                >
                  <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                    {cardSubtitle(card, t("pages.pettyCash.statusStandby"))}
                  </h3>
                  <p className="mt-1 truncate text-xs leading-none text-subtle">
                    {formatPrepaidCardNumber(card.cardNumber)}
                  </p>
                </button>
              }
              status={
                <StatusBadge
                  status={statusTone(card.status)}
                  className={financeListStatusChipClassName}
                >
                  {t(prepaidStatusLabelKey(card.status))}
                </StatusBadge>
              }
              amount={formatContractPrice(card.currentBalance)}
            />
          ))}
        </div>
      )}

      <PrepaidCardCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultKind={kindTab}
        vehicles={vehicles.filter(
          (vehicle) =>
            !cards.some(
              (card) =>
                card.kind === "VEHICLE" &&
                card.vehicleItemId === vehicle.id &&
                (card.status === "ACTIVE" || card.status === "DAMAGED")
            )
        )}
        employees={employees}
        onSaved={() => router.refresh()}
      />
      <PrepaidCardSpendDialog
        open={spendOpen}
        onOpenChange={setSpendOpen}
        cards={cards.filter((card) => canSpendOnPrepaidCard(card.status as never))}
        preferredCardId={selectedCardId ?? (filterCardId !== "all" ? filterCardId : null)}
        onSaved={() => router.refresh()}
      />
      {selectedCard ? (
        <>
          <AssignDialog
            open={assignOpen}
            onOpenChange={setAssignOpen}
            card={selectedCard}
            vehicles={vehicles}
            employees={employees}
            onSaved={() => router.refresh()}
          />
          <ReassignDialog
            open={reassignOpen}
            onOpenChange={setReassignOpen}
            card={selectedCard}
            vehicles={vehicles}
            employees={employees}
            onSaved={() => router.refresh()}
          />
          <DamagedDialog
            open={damagedOpen}
            onOpenChange={setDamagedOpen}
            card={selectedCard}
            standbyCards={standbyCards.filter((card) => card.id !== selectedCard.id)}
            onSaved={() => router.refresh()}
          />
          <ReplaceDialog
            open={replaceOpen}
            onOpenChange={setReplaceOpen}
            card={selectedCard}
            destinationCards={cards.filter(
              (card) =>
                card.id !== selectedCard.id &&
                card.kind === selectedCard.kind &&
                (card.status === "STANDBY" || card.status === "ACTIVE")
            )}
            bankAccounts={bankAccounts}
            onSaved={() => router.refresh()}
          />
          <LostDialog
            open={lostOpen}
            onOpenChange={setLostOpen}
            card={selectedCard}
            employees={employees}
            bankAccounts={bankAccounts}
            onSaved={() => {
              setSelectedCardId(null);
              router.refresh();
            }}
          />
          <MisuseDialog
            open={misuseOpen}
            onOpenChange={setMisuseOpen}
            card={selectedCard}
            employees={employees}
            onSaved={() => router.refresh()}
          />
        </>
      ) : null}
    </div>
  );
}

function CardDetail({
  card,
  canManageCards,
  selectedPicId,
  onSelectPic,
  onBack,
  onAssign,
  onReassign,
  onDamaged,
  onReplace,
  onLost,
  onMisuse,
  onSpend,
}: {
  card: PrepaidCardView;
  canManageCards: boolean;
  selectedPicId: string | null;
  onSelectPic: (id: string | null) => void;
  onBack: () => void;
  onAssign: () => void;
  onReassign: () => void;
  onDamaged: () => void;
  onReplace: () => void;
  onLost: () => void;
  onMisuse: () => void;
  onSpend: () => void;
}) {
  const { t } = useT();
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const statusKey = prepaidStatusLabelKey(card.status);

  async function returnToList() {
    const ok = await confirm({
      title: t("pages.pettyCash.returnToList"),
      description: t("pages.pettyCash.returnToListConfirm"),
    });
    if (!ok) return;
    const formData = new FormData();
    formData.set("prepaidCardId", card.id);
    startTransition(async () => {
      try {
        await returnPrepaidCardToList(formData);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.updateFailed"));
      }
    });
  }

  const visibleEntries = card.entries.filter((entry) => {
    if (!selectedPicId) return true;
    if (!entry.assignmentId) return false;
    const assignment = card.assignments.find(
      (row) => row.id === entry.assignmentId
    );
    return assignment?.custodianEmployeeId === selectedPicId;
  });

  const totalSpend = card.entries
    .filter((entry) => entry.kind === "SPEND")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const cardActions = (
    <div className="flex flex-wrap gap-2">
      {canSpendOnPrepaidCard(card.status as never) ? (
        <Button type="button" variant="infoBadge" size="badgeFlex" onClick={onSpend}>
          {t("pages.pettyCash.prepaidSpend")}
        </Button>
      ) : null}
      {canManageCards && canAssignPrepaidCard(card.status as never) ? (
        <Button type="button" variant="infoBadge" size="badgeFlex" onClick={onAssign}>
          {t("pages.pettyCash.assignCard")}
        </Button>
      ) : null}
      {canManageCards && card.status === "ACTIVE" ? (
        <Button type="button" variant="infoBadge" size="badgeFlex" onClick={onReassign}>
          {t("pages.pettyCash.reassignCard")}
        </Button>
      ) : null}
      {canManageCards && canReturnPrepaidCard(card.status as never) ? (
        <Button type="button" variant="infoBadge" size="badgeFlex" disabled={pending} onClick={() => void returnToList()}>
          {t("pages.pettyCash.returnToList")}
        </Button>
      ) : null}
      {canManageCards && canMarkPrepaidCardDamaged(card.status as never) ? (
        <Button type="button" variant="infoBadge" size="badgeFlex" onClick={onDamaged}>
          {t("pages.pettyCash.markDamaged")}
        </Button>
      ) : null}
      {canManageCards && canReplacePrepaidCard(card.status as never) ? (
        <Button type="button" variant="infoBadge" size="badgeFlex" onClick={onReplace}>
          {t("pages.pettyCash.cardReplaced")}
        </Button>
      ) : null}
      {canManageCards && canReportPrepaidCardLost(card.status as never) ? (
        <Button type="button" variant="infoBadge" size="badgeFlex" onClick={onLost}>
          {t("pages.pettyCash.reportLost")}
        </Button>
      ) : null}
      {canManageCards && card.status === "ACTIVE" ? (
        <Button type="button" variant="destructiveBadge" size="badgeFlex" onClick={onMisuse}>
          {t("pages.pettyCash.reportMisuse")}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
    <SectionCard className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Button
            type="button"
            variant="infoBadge"
            size="badgeFlex"
            className="gap-1.5"
            onClick={onBack}
          >
            <ArrowLeft className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {t("pages.pettyCash.backToList")}
          </Button>
          <h2 className="mt-3 text-lg font-semibold tracking-tight text-text">
            {cardSubtitle(card, t("pages.pettyCash.statusStandby"))}
          </h2>
          <p className="mt-1 text-base text-muted">
            {formatPrepaidCardNumber(card.cardNumber)}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end text-right">
          <StatusBadge
            status={statusTone(card.status)}
            className={financeListStatusChipClassName}
          >
            {t(statusKey)}
          </StatusBadge>
          <div className="mt-4 space-y-1">
            <p className="text-sm font-semibold tracking-tight text-text">
              {t("pages.pettyCash.prepaidBalance")}:{" "}
              {formatContractPrice(card.currentBalance)}
            </p>
            <p className="text-sm font-semibold tracking-tight text-text">
              {t("pages.pettyCash.cardTotalSpend")}:{" "}
              {formatContractPrice(totalSpend)}
            </p>
          </div>
        </div>
      </div>
      {canManageCards ? cardActions : null}
      {card.kind === "OPEN" && card.assignments.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            {t("pages.pettyCash.picHistory")}
          </p>
          <div className="flex flex-wrap gap-2">
            {card.assignments
              .filter((row) => row.custodianEmployeeId && row.custodianName)
              .map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() =>
                    onSelectPic(
                      selectedPicId === row.custodianEmployeeId
                        ? null
                        : row.custodianEmployeeId
                    )
                  }
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-semibold",
                    selectedPicId === row.custodianEmployeeId
                      ? outlineChipTones.emeraldInteractive
                      : "border border-border bg-elevated text-muted"
                  )}
                >
                  {row.custodianName}
                </button>
              ))}
          </div>
          <p className={cn(employeeDialogHintClass, "mt-2")}>
            {t("pages.pettyCash.picFilterHint")}
          </p>
        </div>
      ) : null}
    </SectionCard>
      {visibleEntries.length === 0 ? (
        <p className="text-sm text-muted">{t("pages.pettyCash.cardEntriesEmpty")}</p>
      ) : (
        <div className={financeRecordListClassName}>
          {visibleEntries.map((entry) => {
            const signed = entrySigned(
              entry.kind,
              entry.amount,
              entry.previousBalance,
              entry.resultingBalance
            );
            return (
              <FinanceRecordRow
                key={entry.id}
                title={
                  <>
                    <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                      {entry.description || prepaidEntryKindLabel(t, entry)}
                    </h3>
                    <p className="mt-1 truncate text-xs leading-none text-subtle">
                      {formatDisplayDate(entry.entryDate, { timeZone: "UTC" })}
                      {entry.description ? (
                        <>
                          <span className="mx-1.5 text-border-strong" aria-hidden>
                            ·
                          </span>
                          {prepaidEntryKindLabel(t, entry)}
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
                    status="success"
                    className={financeListStatusChipClassName}
                  >
                    <span className="flex h-full w-full items-center justify-center text-center leading-none">
                      {t("pages.pettyCash.status.POSTED")}
                    </span>
                  </StatusBadge>
                }
                amount={`${signed >= 0 ? "+" : "−"}${formatContractPrice(Math.abs(entry.amount))}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function WrittenOffView({
  losses,
  selected,
  onBack,
  onOpen,
}: {
  losses: PrepaidCardLossView[];
  selected: PrepaidCardLossView | null;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useT();
  if (selected) {
    return (
      <SectionCard className="space-y-4 p-5 sm:p-6">
        <button
          type="button"
          className="text-xs font-semibold text-primary-dark underline-offset-2 hover:underline"
          onClick={() => onOpen("")}
        >
          {t("pages.pettyCash.backToWrittenOff")}
        </button>
        <h2 className="text-lg font-semibold text-text">
          {formatPrepaidCardNumber(selected.cardNumber)}
        </h2>
        <p className="text-sm text-subtle">
          {t("pages.pettyCash.footedBy")}:{" "}
          {selected.footedBy === "company"
            ? t("pages.pettyCash.footedByCompany")
            : selected.employeeName}
        </p>
        <p className="text-sm text-subtle">
          {t("pages.pettyCash.recoveryMethod")}:{" "}
          {selected.method === "COMPANY"
            ? t("pages.pettyCash.recoveryCompany")
            : selected.method === "NEXT_PAY"
              ? t("pages.pettyCash.recoveryNextPay")
              : selected.method === "INSTALLMENTS"
                ? t("pages.pettyCash.recoveryInstallments")
                : t("pages.pettyCash.recoveryPayNow")}
        </p>
        <p className="text-sm font-semibold">
          {t("pages.pettyCash.amountRecovered")}: {formatContractPrice(selected.amountRecovered)}
        </p>
        <p className="text-sm font-semibold">
          {t("pages.pettyCash.amountLeft")}: {formatContractPrice(selected.amountLeft)}
        </p>
        {selected.payNow ? (
          <p className="text-sm text-subtle">
            {formatDisplayDate(selected.payNow.recoveredAt, { timeZone: "UTC" })} ·{" "}
            {formatContractPrice(selected.payNow.amount)}
            {selected.payNow.bankLabel ? ` · ${selected.payNow.bankLabel}` : ""}
          </p>
        ) : null}
        {selected.installments.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              {t("pages.pettyCash.installmentHistory")}
            </p>
            <div className={financeRecordListClassName}>
              {selected.installments.map((row) => (
                <FinanceRecordRow
                  key={row.id}
                  title={
                    <>
                      <h3 className="text-sm font-semibold">
                        {t(`pages.reports.months.${row.month}`)} {row.year}
                      </h3>
                      <p className="mt-1 text-xs text-subtle">
                        {row.paid
                          ? t("pages.pettyCash.installmentTaken")
                          : t("pages.pettyCash.installmentScheduled")}
                      </p>
                    </>
                  }
                  status={null}
                  amount={formatContractPrice(row.amount)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="infoBadge"
        size="badgeFlex"
        className="gap-1.5"
        onClick={onBack}
      >
        <ArrowLeft className="size-3.5 shrink-0 opacity-80" aria-hidden />
        {t("pages.pettyCash.backToList")}
      </Button>
      <h2 className="text-lg font-semibold text-text">
        {t("pages.pettyCash.writtenOffTitle")}
      </h2>
      {losses.length === 0 ? (
        <EmptyState
          titleKey="pages.pettyCash.writtenOffEmpty"
          descriptionKey="pages.pettyCash.writtenOffEmptyDesc"
        />
      ) : (
        <div className={financeRecordListClassName}>
          {losses.map((loss) => (
            <FinanceRecordRow
              key={loss.id}
              title={
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => onOpen(loss.id)}
                >
                  <h3 className="text-sm font-semibold">
                    {formatPrepaidCardNumber(loss.cardNumber)}
                  </h3>
                  <p className="mt-1 text-xs text-subtle">
                    {formatDisplayDate(loss.writtenOffAt, { timeZone: "UTC" })} ·{" "}
                    {loss.footedBy === "company"
                      ? t("pages.pettyCash.footedByCompany")
                      : loss.employeeName}
                  </p>
                </button>
              }
              status={null}
              amount={formatContractPrice(loss.hoAbsorbed + loss.employeeLeft)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PrepaidDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={CreditCard}
        title={title}
        description={description}
        footer={<div />}
      >
        {children}
      </EmployeeDialogShell>
    </Dialog>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  formatValue,
  className,
  triggerClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  formatValue: (value: string) => ReactNode;
  className?: string;
  triggerClassName?: string;
}) {
  return (
    <label className={cn("grid min-w-[8rem] gap-1.5", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
        {label}
      </span>
      <Select value={value} onValueChange={(next) => onChange(next ?? value)}>
        <SelectTrigger
          className={cn(employeeSelectTriggerClass, triggerClassName)}
        >
          <SelectValue>{() => formatValue(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}

function PrepaidCardCreateDialog({
  open,
  onOpenChange,
  defaultKind,
  vehicles,
  employees,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind: "VEHICLE" | "OPEN";
  vehicles: VehicleOption[];
  employees: PrepaidEmployeeOption[];
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"VEHICLE" | "OPEN">(defaultKind);
  const [cardNumber, setCardNumber] = useState("");
  const [assignNow, setAssignNow] = useState(false);
  const [vehicleItemId, setVehicleItemId] = useState("");
  const [custodianEmployeeId, setCustodianEmployeeId] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = [
      ...(!cardNumber.trim() ? [t("pages.pettyCash.cardNumber")] : []),
      ...(assignNow && kind === "VEHICLE" && !vehicleItemId
        ? [t("pages.pettyCash.vehicle")]
        : []),
      ...(assignNow && kind === "OPEN" && !custodianEmployeeId
        ? [t("pages.pettyCash.personInCharge")]
        : []),
    ];
    if (showMissingRequiredFields(event.currentTarget, missing)) return;
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("cardNumber", cardNumber);
    formData.set("assignNow", assignNow ? "1" : "0");
    if (vehicleItemId) formData.set("vehicleItemId", vehicleItemId);
    if (custodianEmployeeId) formData.set("custodianEmployeeId", custodianEmployeeId);
    startTransition(async () => {
      try {
        await createPrepaidCard(formData);
        setCardNumber("");
        setAssignNow(false);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.prepaidCreateFailed"));
      }
    });
  }

  return (
    <PrepaidDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pages.pettyCash.prepaidCreate")}
      description={t("pages.pettyCash.prepaidCreateDesc")}
    >
      <form className={employeeDialogFormClass} onSubmit={submit}>
        <div className={employeeDialogFieldClass}>
          <span className={employeeDialogLabelClass}>{t("pages.pettyCash.cardType")}</span>
          <div className={choiceGridClassForCount(2)}>
            {(["VEHICLE", "OPEN"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={cn(
                  "inline-flex min-h-8 items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold",
                  kind === value
                    ? outlineChipTones.emeraldInteractive
                    : "border border-border bg-elevated text-muted"
                )}
              >
                {value === "VEHICLE"
                  ? t("pages.pettyCash.kindVehicle")
                  : t("pages.pettyCash.kindOpen")}
              </button>
            ))}
          </div>
        </div>
        <label className={employeeDialogFieldClass}>
          <span className={employeeDialogLabelClass}>{t("pages.pettyCash.cardNumber")}</span>
          <Input
            value={cardNumber}
            onChange={(event) => setCardNumber(event.target.value)}
            className={employeeInputClass}
            required
          />
        </label>
        <div className={employeeDialogFieldClass}>
          <span className={employeeDialogLabelClass}>{t("pages.pettyCash.assignNow")}</span>
          <div className={choiceGridClassForCount(2)}>
            <button
              type="button"
              onClick={() => setAssignNow(true)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold",
                assignNow
                  ? outlineChipTones.emeraldInteractive
                  : "border border-border bg-elevated text-muted"
              )}
            >
              {t("pages.pettyCash.assignNowYes")}
            </button>
            <button
              type="button"
              onClick={() => setAssignNow(false)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold",
                !assignNow
                  ? outlineChipTones.emeraldInteractive
                  : "border border-border bg-elevated text-muted"
              )}
            >
              {t("pages.pettyCash.leaveStandby")}
            </button>
          </div>
        </div>
        {assignNow && kind === "VEHICLE" ? (
          <VehicleSelect
            vehicles={vehicles}
            value={vehicleItemId}
            onChange={setVehicleItemId}
          />
        ) : null}
        {assignNow && kind === "OPEN" ? (
          <EmployeeSelect
            employees={employees}
            value={custodianEmployeeId}
            onChange={setCustodianEmployeeId}
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </EmployeeSecondaryButton>
          <EmployeePrimaryButton type="submit" disabled={pending}>
            {t("pages.pettyCash.prepaidAddCard")}
          </EmployeePrimaryButton>
        </div>
      </form>
    </PrepaidDialog>
  );
}

function PrepaidCardSpendDialog({
  open,
  onOpenChange,
  cards,
  preferredCardId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: PrepaidCardView[];
  preferredCardId: string | null;
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [cardId, setCardId] = useState(preferredCardId ?? cards[0]?.id ?? "");
  const confirm = useConfirm();
  const [spendKind, setSpendKind] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(todayDateInput());
  const [odometerKm, setOdometerKm] = useState("");
  const [litresFilled, setLitresFilled] = useState("");
  const [vehicleAssetId, setVehicleAssetId] = useState("");
  const card = cards.find((row) => row.id === cardId) ?? cards[0] ?? null;
  const kinds =
    card?.kind === "OPEN" ? (["OTHER"] as const) : (["FUEL", "TOLL", "PARKING", "OTHER"] as const);
  const fuelVehicles: VehicleOdometerOption[] = card?.vehicleAssets ?? [];
  const selectedFuelVehicle =
    fuelVehicles.find((row) => row.id === vehicleAssetId) ??
    (fuelVehicles.length === 1 ? fuelVehicles[0] : null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!card) return;
    const form = event.currentTarget;
    const proof = form.proof as unknown as HTMLInputElement;
    const missing = [
      ...(!cardId ? [t("pages.pettyCash.filterCard")] : []),
      ...(!spendKind ? [t("pages.pettyCash.spendKind")] : []),
      ...((card.kind === "OPEN" || spendKind === "OTHER") && !description.trim()
        ? [t("pages.pettyCash.descriptionLabel")]
        : []),
      ...(spendKind === "FUEL" && fuelVehicles.length > 1 && !selectedFuelVehicle
        ? [t("pages.billing.vehicleFor")]
        : []),
      ...(spendKind === "FUEL" && !odometerKm.trim()
        ? [t("pages.vehicles.odometer.current")]
        : []),
      ...(spendKind === "FUEL" && !litresFilled.trim()
        ? [t("pages.vehicles.odometer.litres")]
        : []),
    ];
    if (showMissingRequiredFields(form, missing)) return;
    if (spendKind === "FUEL") {
      const readingKm = parseOdometerKm(odometerKm);
      const litres = parseLitres(litresFilled);
      if (readingKm == null || litres == null || !selectedFuelVehicle) {
        return;
      }
      try {
        const preview = previewFuelFill({
          vehicle: selectedFuelVehicle,
          readingKm,
          litresFilled: litres,
        });
        if (preview.flagReason === "OVER_FILL") {
          showRejection({
            reasons: t("pages.vehicles.odometer.tankOverCapacity", {
              tank: preview.tankLitres ?? "—",
              limit: preview.tankLimitLitres ?? "—",
            }),
          });
          return;
        }
        const typedAmount = parseContractPrice(amount);
        const ok = await confirm(
          fuelFillConfirmRequest(t, preview, typedAmount)
        );
        if (!ok) return;
      } catch (error) {
        showRejectionFromError(
          error instanceof Error && error.message === "ODOMETER_WENT_BACK"
            ? new Error(t("pages.vehicles.odometer.wentBack"))
            : error,
          t("pages.vehicles.odometer.wentBack")
        );
        return;
      }
    }
    const formData = new FormData(form);
    formData.set("prepaidCardId", card.id);
    formData.set("spendKind", card.kind === "OPEN" ? "OTHER" : spendKind);
    formData.set("amount", amount);
    formData.set("description", description);
    formData.set("entryDate", entryDate);
    if (spendKind === "FUEL") {
      formData.set("odometerKm", odometerKm);
      formData.set("litresFilled", litresFilled);
      if (selectedFuelVehicle) {
        formData.set("vehicleAssetId", selectedFuelVehicle.id);
      }
    }
    if (proof?.files?.[0]) formData.set("proof", proof.files[0]);
    startTransition(async () => {
      try {
        await recordPrepaidCardSpend(formData);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.prepaidSpendFailed"));
      }
    });
  }

  return (
    <PrepaidDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pages.pettyCash.prepaidSpend")}
      description={t("pages.pettyCash.prepaidSpendDesc")}
    >
      <form className={employeeDialogFormClass} onSubmit={submit}>
        <label className={employeeDialogFieldClass}>
          <span className={employeeDialogLabelClass}>{t("pages.pettyCash.filterCard")}</span>
          <Select value={cardId || null} onValueChange={(value) => setCardId(value ?? "")}>
            <SelectTrigger
              className={cn(
                employeeSelectTriggerClass,
                card ? "h-auto min-h-9 py-1.5" : null
              )}
            >
              <SelectValue>
                {() =>
                  card ? (
                    <CardIdentityStack
                      card={card}
                      standbyLabel={t("pages.pettyCash.statusStandby")}
                    />
                  ) : (
                    t("pages.pettyCash.filterCard")
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cards.map((row) => (
                <SelectItem
                  key={row.id}
                  value={row.id}
                  className="items-start whitespace-normal"
                >
                  <CardIdentityStack
                    card={row}
                    standbyLabel={t("pages.pettyCash.statusStandby")}
                  />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {card?.kind === "VEHICLE" ? (
          <div className={employeeDialogFieldClass}>
            <span className={employeeDialogLabelClass}>{t("pages.pettyCash.spendKind")}</span>
            <div className={choiceGridClassForCount(4)}>
              {kinds.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpendKind(value)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-semibold",
                    spendKind === value
                      ? outlineChipTones.emeraldInteractive
                      : "border border-border bg-elevated text-muted"
                  )}
                >
                  {t(
                    `pages.pettyCash.spend${value === "FUEL" ? "Fuel" : value === "TOLL" ? "Toll" : value === "PARKING" ? "Parking" : "Other"}`
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {spendKind === "FUEL" && fuelVehicles.length > 1 ? (
          <label className={employeeDialogFieldClass}>
            <span className={employeeDialogLabelClass}>
              {t("pages.billing.vehicleFor")}
              <span className="text-red-400"> *</span>
            </span>
            <Select
              value={vehicleAssetId || null}
              onValueChange={(value) => setVehicleAssetId(value ?? "")}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue placeholder={t("pages.billing.vehicleFor")} />
              </SelectTrigger>
              <SelectContent>
                {fuelVehicles.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}
        {spendKind === "FUEL" ? (
          <VehicleOdometerFields
            vehicle={selectedFuelVehicle}
            odometerKm={odometerKm}
            onOdometerChange={setOdometerKm}
            litres={litresFilled}
            onLitresChange={setLitresFilled}
          />
        ) : null}
        <label className={employeeDialogFieldClass}>
          <span className={employeeDialogLabelClass}>{t("pages.pettyCash.enteredAmount")}</span>
          <MoneyInput value={amount} onValueChange={setAmount} className={employeeInputClass} required />
        </label>
        <label className={employeeDialogFieldClass}>
          <span className={employeeDialogLabelClass}>{t("pages.pettyCash.descriptionLabel")}</span>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={employeeInputClass}
            required={card?.kind === "OPEN" || spendKind === "OTHER"}
          />
        </label>
        <label className={employeeDialogFieldClass}>
          <span className={employeeDialogLabelClass}>{t("pages.pettyCash.date")}</span>
          <Input
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            className={employeeInputClass}
            required
          />
        </label>
        <FileDropField
          id="prepaid-spend-proof"
          name="proof"
          required
          multiple
          label={t("pages.pettyCash.proof")}
        />
        <div className="flex justify-end gap-2">
          <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </EmployeeSecondaryButton>
          <EmployeePrimaryButton type="submit" disabled={pending}>
            {t("pages.pettyCash.prepaidSpendConfirm")}
          </EmployeePrimaryButton>
        </div>
      </form>
    </PrepaidDialog>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  card,
  vehicles,
  employees,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: PrepaidCardView;
  vehicles: VehicleOption[];
  employees: PrepaidEmployeeOption[];
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [vehicleItemId, setVehicleItemId] = useState(card.vehicleItemId ?? "");
  const [custodianEmployeeId, setCustodianEmployeeId] = useState(
    card.custodianEmployeeId ?? ""
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("prepaidCardId", card.id);
    formData.set("vehicleItemId", vehicleItemId);
    formData.set("custodianEmployeeId", custodianEmployeeId);
    startTransition(async () => {
      try {
        await assignPrepaidCard(formData);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.updateFailed"));
      }
    });
  }

  return (
    <PrepaidDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pages.pettyCash.assignCard")}
      description={t("pages.pettyCash.assignCardDesc")}
    >
      <form className={employeeDialogFormClass} onSubmit={submit}>
        {card.kind === "VEHICLE" ? (
          <VehicleSelect vehicles={vehicles} value={vehicleItemId} onChange={setVehicleItemId} />
        ) : (
          <EmployeeSelect
            employees={employees}
            value={custodianEmployeeId}
            onChange={setCustodianEmployeeId}
          />
        )}
        <div className="flex justify-end gap-2">
          <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </EmployeeSecondaryButton>
          <EmployeePrimaryButton type="submit" disabled={pending}>
            {t("pages.pettyCash.assignCard")}
          </EmployeePrimaryButton>
        </div>
      </form>
    </PrepaidDialog>
  );
}

function ReassignDialog({
  open,
  onOpenChange,
  card,
  vehicles,
  employees,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: PrepaidCardView;
  vehicles: VehicleOption[];
  employees: PrepaidEmployeeOption[];
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [vehicleItemId, setVehicleItemId] = useState(card.vehicleItemId ?? "");
  const [custodianEmployeeId, setCustodianEmployeeId] = useState(
    card.custodianEmployeeId ?? ""
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("prepaidCardId", card.id);
    formData.set("vehicleItemId", vehicleItemId);
    formData.set("custodianEmployeeId", custodianEmployeeId);
    startTransition(async () => {
      try {
        await reassignPrepaidCard(formData);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.updateFailed"));
      }
    });
  }

  return (
    <PrepaidDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pages.pettyCash.reassignCard")}
      description={t("pages.pettyCash.reassignCardDesc")}
    >
      <form className={employeeDialogFormClass} onSubmit={submit}>
        {card.kind === "VEHICLE" ? (
          <VehicleSelect vehicles={vehicles} value={vehicleItemId} onChange={setVehicleItemId} />
        ) : (
          <EmployeeSelect
            employees={employees}
            value={custodianEmployeeId}
            onChange={setCustodianEmployeeId}
          />
        )}
        <div className="flex justify-end gap-2">
          <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </EmployeeSecondaryButton>
          <EmployeePrimaryButton type="submit" disabled={pending}>
            {t("pages.pettyCash.reassignCard")}
          </EmployeePrimaryButton>
        </div>
      </form>
    </PrepaidDialog>
  );
}

function DamagedDialog({
  open,
  onOpenChange,
  card,
  standbyCards,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: PrepaidCardView;
  standbyCards: PrepaidCardView[];
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [assignNew, setAssignNew] = useState(false);
  const [replacementCardId, setReplacementCardId] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("prepaidCardId", card.id);
    formData.set("assignNew", assignNew ? "1" : "0");
    formData.set("replacementCardId", replacementCardId);
    startTransition(async () => {
      try {
        await markPrepaidCardDamaged(formData);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.updateFailed"));
      }
    });
  }

  return (
    <PrepaidDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pages.pettyCash.markDamaged")}
      description={t("pages.pettyCash.markDamagedDesc")}
    >
      <form className={employeeDialogFormClass} onSubmit={submit}>
        <div className={choiceGridClassForCount(2)}>
          <button
            type="button"
            onClick={() => setAssignNew(true)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold",
              assignNew
                ? outlineChipTones.emeraldInteractive
                : "border border-border bg-elevated text-muted"
            )}
          >
            {t("pages.pettyCash.assignNewNow")}
          </button>
          <button
            type="button"
            onClick={() => setAssignNew(false)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold",
              !assignNew
                ? outlineChipTones.emeraldInteractive
                : "border border-border bg-elevated text-muted"
            )}
          >
            {t("pages.pettyCash.keepDamagedAssigned")}
          </button>
        </div>
        {assignNew ? (
          <CardSelect
            cards={standbyCards}
            value={replacementCardId}
            onChange={setReplacementCardId}
            label={t("pages.pettyCash.replacementCard")}
          />
        ) : (
          <p className={employeeDialogHintClass}>{t("pages.pettyCash.keepDamagedHint")}</p>
        )}
        <div className="flex justify-end gap-2">
          <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </EmployeeSecondaryButton>
          <EmployeePrimaryButton type="submit" disabled={pending}>
            {t("pages.pettyCash.markDamaged")}
          </EmployeePrimaryButton>
        </div>
      </form>
    </PrepaidDialog>
  );
}

function ReplaceDialog({
  open,
  onOpenChange,
  card,
  destinationCards,
  bankAccounts,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: PrepaidCardView;
  destinationCards: PrepaidCardView[];
  bankAccounts: BankOption[];
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const stillAssigned = Boolean(card.vehicleItemId || card.custodianEmployeeId);
  const [continueSame, setContinueSame] = useState(stillAssigned);
  const [destinationCardId, setDestinationCardId] = useState("");
  const [fee, setFee] = useState("0");
  const [feeSource, setFeeSource] = useState<"LEFTOVER" | "BANK">("LEFTOVER");
  const [bankAccountId, setBankAccountId] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("prepaidCardId", card.id);
    formData.set("continueSame", continueSame ? "1" : "0");
    formData.set("destinationCardId", destinationCardId);
    formData.set("fee", fee);
    formData.set("feeSource", feeSource);
    formData.set("bankAccountId", bankAccountId);
    formData.set("entryDate", todayDateInput());
    startTransition(async () => {
      try {
        await replacePrepaidCard(formData);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.updateFailed"));
      }
    });
  }

  return (
    <PrepaidDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pages.pettyCash.cardReplaced")}
      description={t("pages.pettyCash.cardReplacedDesc")}
    >
      <form className={employeeDialogFormClass} onSubmit={submit}>
        {stillAssigned ? (
          <div className={choiceGridClassForCount(2)}>
            <button
              type="button"
              onClick={() => setContinueSame(true)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold",
                continueSame
                  ? outlineChipTones.emeraldInteractive
                  : "border border-border bg-elevated text-muted"
              )}
            >
              {t("pages.pettyCash.continueSameCard")}
            </button>
            <button
              type="button"
              onClick={() => setContinueSame(false)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold",
                !continueSame
                  ? outlineChipTones.emeraldInteractive
                  : "border border-border bg-elevated text-muted"
              )}
            >
              {t("pages.pettyCash.moveLeftover")}
            </button>
          </div>
        ) : null}
        {!continueSame ? (
          <CardSelect
            cards={destinationCards}
            value={destinationCardId}
            onChange={setDestinationCardId}
            label={t("pages.pettyCash.destinationCard")}
          />
        ) : null}
        <label className={employeeDialogFieldClass}>
          <span className={employeeDialogLabelClass}>{t("pages.pettyCash.replacementFee")}</span>
          <MoneyInput value={fee} onValueChange={setFee} className={employeeInputClass} />
        </label>
        <div className={choiceGridClassForCount(2)}>
          <button
            type="button"
            onClick={() => setFeeSource("LEFTOVER")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold",
              feeSource === "LEFTOVER"
                ? outlineChipTones.emeraldInteractive
                : "border border-border bg-elevated text-muted"
            )}
          >
            {t("pages.pettyCash.feeFromLeftover")}
          </button>
          <button
            type="button"
            onClick={() => setFeeSource("BANK")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold",
              feeSource === "BANK"
                ? outlineChipTones.emeraldInteractive
                : "border border-border bg-elevated text-muted"
            )}
          >
            {t("pages.pettyCash.feeFromBank")}
          </button>
        </div>
        {feeSource === "BANK" ? (
          <BankSelect
            accounts={bankAccounts}
            value={bankAccountId}
            onChange={setBankAccountId}
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </EmployeeSecondaryButton>
          <EmployeePrimaryButton type="submit" disabled={pending}>
            {t("pages.pettyCash.cardReplaced")}
          </EmployeePrimaryButton>
        </div>
      </form>
    </PrepaidDialog>
  );
}

function MisuseDialog({
  open,
  onOpenChange,
  card,
  employees,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: PrepaidCardView;
  employees: PrepaidEmployeeOption[];
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState(card.custodianEmployeeId ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("prepaidCardId", card.id);
    formData.set("employeeId", employeeId);
    formData.set("amount", amount);
    formData.set("note", note);
    startTransition(async () => {
      try {
        await reportPrepaidCardMisuse(formData);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.updateFailed"));
      }
    });
  }

  return (
    <PrepaidDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pages.pettyCash.reportMisuse")}
      description={t("pages.pettyCash.reportMisuseDesc")}
    >
      <form className={employeeDialogFormClass} onSubmit={submit}>
        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass}>
            {t("pages.pettyCash.misuseEmployee")}
          </label>
          <Select
            value={employeeId || null}
            onValueChange={(value) => setEmployeeId(value ?? "")}
            items={employees.map((row) => ({
              value: row.id,
              label: row.name,
            }))}
          >
            <SelectTrigger className={employeeSelectTriggerClass}>
              <SelectValue placeholder={t("pages.pettyCash.misuseEmployee")} />
            </SelectTrigger>
            <SelectContent>
              {employees.map((row) => (
                <SelectItem key={row.id} value={row.id} label={row.name}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass}>
            {t("pages.pettyCash.misuseAmount")}
          </label>
          <MoneyInput
            className={employeeInputClass}
            value={amount}
            onValueChange={setAmount}
            required
          />
        </div>
        <div className={employeeDialogFieldClass}>
          <label className={employeeDialogLabelClass}>
            {t("pages.pettyCash.misuseNote")}
          </label>
          <Input
            className={employeeInputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <EmployeePrimaryButton type="submit" disabled={pending || !employeeId}>
          {t("pages.pettyCash.reportMisuse")}
        </EmployeePrimaryButton>
      </form>
    </PrepaidDialog>
  );
}

function LostDialog({
  open,
  onOpenChange,
  card,
  employees,
  bankAccounts,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: PrepaidCardView;
  employees: PrepaidEmployeeOption[];
  bankAccounts: BankOption[];
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [employeeCovers, setEmployeeCovers] = useState(false);
  const [recoveryKind, setRecoveryKind] = useState("NEXT_PAY");
  const [department, setDepartment] = useState("all");
  const [employeeId, setEmployeeId] = useState(card.custodianEmployeeId ?? "");
  const [bankAccountId, setBankAccountId] = useState("");
  const departments = Array.from(
    new Set(employees.map((row) => row.department).filter(Boolean))
  ) as string[];
  const visibleEmployees = employees.filter(
    (row) => department === "all" || row.department === department
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("prepaidCardId", card.id);
    formData.set("employeeCovers", employeeCovers ? "1" : "0");
    formData.set("recoveryKind", employeeCovers ? recoveryKind : "COMPANY");
    formData.set("employeeId", employeeId);
    formData.set("bankAccountId", bankAccountId);
    formData.set("entryDate", todayDateInput());
    startTransition(async () => {
      try {
        await reportPrepaidCardLost(formData);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.updateFailed"));
      }
    });
  }

  return (
    <PrepaidDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("pages.pettyCash.reportLost")}
      description={t("pages.pettyCash.reportLostDesc")}
    >
      <form className={employeeDialogFormClass} onSubmit={submit}>
        <p className={employeeDialogHintClass}>
          {t("pages.pettyCash.lostLeftover")}: {formatContractPrice(card.currentBalance)}
        </p>
        <div className={choiceGridClassForCount(2)}>
          <button
            type="button"
            onClick={() => setEmployeeCovers(false)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold",
              !employeeCovers
                ? outlineChipTones.emeraldInteractive
                : "border border-border bg-elevated text-muted"
            )}
          >
            {t("pages.pettyCash.companyWriteOff")}
          </button>
          <button
            type="button"
            onClick={() => setEmployeeCovers(true)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold",
              employeeCovers
                ? outlineChipTones.emeraldInteractive
                : "border border-border bg-elevated text-muted"
            )}
          >
            {t("pages.pettyCash.employeeCovers")}
          </button>
        </div>
        {employeeCovers ? (
          <>
            <label className={employeeDialogFieldClass}>
              <span className={employeeDialogLabelClass}>{t("pages.pettyCash.department")}</span>
              <Select value={department} onValueChange={(value) => setDepartment(value ?? "all")}>
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue>
                    {() =>
                      department === "all"
                        ? t("pages.pettyCash.filterAllDepartments")
                        : department
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("pages.pettyCash.filterAllDepartments")}</SelectItem>
                  {departments.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <EmployeeSelect
              employees={visibleEmployees}
              value={employeeId}
              onChange={setEmployeeId}
            />
            <div className={choiceGridClassForCount(3)}>
              {(["NEXT_PAY", "INSTALLMENTS", "PAY_NOW"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRecoveryKind(value)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-semibold",
                    recoveryKind === value
                      ? outlineChipTones.emeraldInteractive
                      : "border border-border bg-elevated text-muted"
                  )}
                >
                  {value === "NEXT_PAY"
                    ? t("pages.pettyCash.recoveryNextPay")
                    : value === "INSTALLMENTS"
                      ? t("pages.pettyCash.recoveryInstallments")
                      : t("pages.pettyCash.recoveryPayNow")}
                </button>
              ))}
            </div>
            {recoveryKind === "PAY_NOW" ? (
              <BankSelect
                accounts={bankAccounts}
                value={bankAccountId}
                onChange={setBankAccountId}
              />
            ) : null}
          </>
        ) : null}
        <div className="flex justify-end gap-2">
          <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </EmployeeSecondaryButton>
          <EmployeePrimaryButton type="submit" disabled={pending}>
            {t("pages.pettyCash.reportLost")}
          </EmployeePrimaryButton>
        </div>
      </form>
    </PrepaidDialog>
  );
}

function VehicleSelect({
  vehicles,
  value,
  onChange,
}: {
  vehicles: VehicleOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useT();
  return (
    <label className={employeeDialogFieldClass}>
      <span className={employeeDialogLabelClass}>{t("pages.pettyCash.vehicle")}</span>
      <Select value={value || null} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger className={employeeSelectTriggerClass}>
          <SelectValue>
            {() => {
              const vehicle = vehicles.find((row) => row.id === value);
              return vehicle
                ? formatVehicleIdentityLabel(vehicle)
                : t("pages.pettyCash.vehicle");
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {vehicles.map((vehicle) => (
            <SelectItem key={vehicle.id} value={vehicle.id}>
              {formatVehicleIdentityLabel(vehicle)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function EmployeeSelect({
  employees,
  value,
  onChange,
}: {
  employees: PrepaidEmployeeOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useT();
  return (
    <label className={employeeDialogFieldClass}>
      <span className={employeeDialogLabelClass}>{t("pages.pettyCash.personInCharge")}</span>
      <Select value={value || null} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger className={employeeSelectTriggerClass}>
          <SelectValue>
            {() => employees.find((row) => row.id === value)?.name ?? t("pages.pettyCash.personInCharge")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {employees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              {employee.name}
              {employee.department ? ` · ${employee.department}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function CardSelect({
  cards,
  value,
  onChange,
  label,
}: {
  cards: PrepaidCardView[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const { t } = useT();
  return (
    <label className={employeeDialogFieldClass}>
      <span className={employeeDialogLabelClass}>{label}</span>
      <Select value={value || null} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger
          className={cn(
            employeeSelectTriggerClass,
            value ? "h-auto min-h-9 py-1.5" : null
          )}
        >
          <SelectValue>
            {() => {
              const card = cards.find((row) => row.id === value);
              return card ? (
                <CardIdentityStack
                  card={card}
                  standbyLabel={t("pages.pettyCash.statusStandby")}
                />
              ) : (
                label
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {cards.map((card) => (
            <SelectItem
              key={card.id}
              value={card.id}
              className="items-start whitespace-normal"
            >
              <CardIdentityStack
                card={card}
                standbyLabel={t("pages.pettyCash.statusStandby")}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function BankSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: BankOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useT();
  return (
    <label className={employeeDialogFieldClass}>
      <span className={employeeDialogLabelClass}>{t("pages.pettyCash.companyBank")}</span>
      <Select value={value || null} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger className={employeeSelectTriggerClass}>
          <SelectValue>
            {() => accounts.find((row) => row.id === value)?.label ?? t("pages.pettyCash.companyBank")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
