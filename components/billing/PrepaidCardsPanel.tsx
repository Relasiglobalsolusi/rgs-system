"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Scale } from "lucide-react";

import {
  createPrepaidCard,
  deletePrepaidCard,
  recordPrepaidCardSpend,
  updatePrepaidCard,
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
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useConfirm } from "@/components/ui/confirm-dialog";
import FinanceRecordRow, {
  financeRecordListClassName,
} from "@/components/ui/FinanceRecordRow";
import EmptyState from "@/components/ui/EmptyState";
import DirectoryStatCard from "@/components/ui/DirectoryStatCard";
import SectionCard from "@/components/ui/SectionCard";
import { useT } from "@/lib/i18n/use-t";
import { formatContractPrice } from "@/lib/project-billing";
import { todayDateInput } from "@/lib/project-contract";
import { formatDisplayDate } from "@/lib/format-date";
import { choiceGridClassForCount } from "@/components/employees/employee-dialog-ui";
import { cn } from "@/lib/utils";
import { outlineChipTones } from "@/components/ui/StatusBadge";
import {
  directoryToolbarActionClass,
  directoryToolbarDownloadClass,
} from "@/components/ui/DirectoryFilterSelect";
import { Button } from "@/components/ui/button";
import { jakartaYearMonth } from "@/lib/vat";
import { formatVehicleIdentityLabel } from "@/lib/vehicle-plate";

type CardEntry = {
  id: string;
  kind: "TOP_UP" | "SPEND";
  spendKind: "FUEL" | "TOLL" | "PARKING" | null;
  amount: number;
  entryDate: string;
  description: string;
  proofPath: string | null;
};

type CardRow = {
  id: string;
  cardNumber: string;
  currentBalance: number;
  vehicleName: string;
  vehicleSku?: string;
  vehiclePlate?: string | null;
  vehicleItemId: string;
  entries: CardEntry[];
};

type VehicleOption = {
  id: string;
  name: string;
  sku: string;
  plate: string | null;
};

function vehiclePickerLabel(vehicle: VehicleOption) {
  return formatVehicleIdentityLabel({
    plate: vehicle.plate,
    name: vehicle.name,
    sku: vehicle.sku,
  });
}

function vehicleCardLabel(row: {
  vehicleName: string;
  vehicleSku?: string | null;
  vehiclePlate?: string | null;
  cardNumber?: string | null;
}) {
  return formatVehicleIdentityLabel({
    plate: row.vehiclePlate,
    name: row.vehicleName,
    sku: row.vehicleSku,
    cardNumber: row.cardNumber,
  });
}

export default function PrepaidCardsPanel({
  cards,
  vehicles,
  canManageCards = false,
}: {
  cards: CardRow[];
  vehicles: VehicleOption[];
  canManageCards?: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const now = jakartaYearMonth();
  const [createOpen, setCreateOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [spendCardId, setSpendCardId] = useState<string | null>(null);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [filterCardId, setFilterCardId] = useState("all");
  const [filterYear, setFilterYear] = useState(String(now.year));
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterDay, setFilterDay] = useState("all");

  const spendCard = cards.find((card) => card.id === spendCardId) ?? null;
  const editCard = cards.find((card) => card.id === editCardId) ?? null;
  const unusedVehicles = vehicles.filter(
    (vehicle) => !cards.some((card) => card.vehicleItemId === vehicle.id)
  );
  const yearOptions = Array.from(
    { length: 6 },
    (_, index) => String(now.year - index)
  );

  const filteredEntries = useMemo(() => {
    const year = Number(filterYear);
    const month = filterMonth === "all" ? null : Number(filterMonth);
    const day = filterDay === "all" ? null : Number(filterDay);
    return cards.flatMap((card) => {
      if (filterCardId !== "all" && card.id !== filterCardId) return [];
      return card.entries
        .filter((entry) => {
          const date = new Date(`${entry.entryDate}T00:00:00Z`);
          if (date.getUTCFullYear() !== year) return false;
          if (month != null && date.getUTCMonth() + 1 !== month) return false;
          if (day != null && date.getUTCDate() !== day) return false;
          return true;
        })
        .map((entry) => ({ ...entry, card }));
    });
  }, [cards, filterCardId, filterYear, filterMonth, filterDay]);

  const totalTopUp = filteredEntries
    .filter((entry) => entry.kind === "TOP_UP")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalSpend = filteredEntries
    .filter((entry) => entry.kind === "SPEND")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const visibleCards =
    filterCardId === "all"
      ? cards
      : cards.filter((card) => card.id === filterCardId);

  const reportHref = `/api/billing/prepaid-card-report?year=${filterYear}${
    filterMonth !== "all" ? `&month=${filterMonth}` : "&month=all"
  }${filterDay !== "all" ? `&day=${filterDay}` : ""}${
    filterCardId !== "all" ? `&card=${filterCardId}` : ""
  }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canManageCards ? (
          <Button
            type="button"
            variant="permissionsBadge"
            size="badgeFlex"
            className={directoryToolbarActionClass}
            onClick={() => setCreateOpen(true)}
          >
            {t("pages.pettyCash.prepaidAddCard")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="permissionsBadge"
          size="badgeFlex"
          className={directoryToolbarActionClass}
          onClick={() => {
            setSpendCardId(filterCardId !== "all" ? filterCardId : null);
            setSpendOpen(true);
          }}
        >
          {t("pages.pettyCash.prepaidSpend")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <FilterSelect
          label={t("pages.pettyCash.filterDay")}
          value={filterDay}
          onChange={setFilterDay}
          formatValue={(value) =>
            value === "all" ? t("pages.pettyCash.filterAllDays") : value
          }
        >
          <SelectItem value="all">{t("pages.pettyCash.filterAllDays")}</SelectItem>
          {Array.from({ length: 31 }, (_, index) => String(index + 1)).map(
            (day) => (
              <SelectItem key={day} value={day}>
                {day}
              </SelectItem>
            )
          )}
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
          {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(
            (month) => (
              <SelectItem key={month} value={month}>
                {t(`pages.reports.months.${month}`)}
              </SelectItem>
            )
          )}
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
          label={t("pages.pettyCash.filterCard")}
          value={filterCardId}
          onChange={setFilterCardId}
          className="min-w-[16rem]"
          formatValue={(value) => {
            if (value === "all") return t("pages.pettyCash.filterAllCards");
            const card = cards.find((row) => row.id === value);
            return card
              ? vehicleCardLabel(card)
              : t("pages.pettyCash.filterAllCards");
          }}
        >
          <SelectItem value="all">{t("pages.pettyCash.filterAllCards")}</SelectItem>
          {cards.map((card) => (
            <SelectItem key={card.id} value={card.id}>
              {vehicleCardLabel(card)}
            </SelectItem>
          ))}
        </FilterSelect>
        <a href={reportHref} className={directoryToolbarDownloadClass}>
          {t("pages.pettyCash.downloadReport")}
        </a>
      </div>

      {visibleCards.length === 0 ? (
        <SectionCard className="p-5 sm:p-6">
          <EmptyState
            titleKey="pages.pettyCash.prepaidEmptyTitle"
            descriptionKey="pages.pettyCash.prepaidEmptyDesc"
          />
        </SectionCard>
      ) : (
        <div className={financeRecordListClassName}>
          {visibleCards.map((card) => (
            <FinanceRecordRow
              key={card.id}
              title={
                canManageCards ? (
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setEditCardId(card.id)}
                  >
                    <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                      {card.cardNumber}
                    </h3>
                    <p className="mt-1 truncate text-xs leading-none text-subtle">
                      {formatVehicleIdentityLabel({
                        plate: card.vehiclePlate,
                        name: card.vehicleName,
                        sku: card.vehicleSku,
                      })}
                    </p>
                  </button>
                ) : (
                  <div>
                    <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                      {card.cardNumber}
                    </h3>
                    <p className="mt-1 truncate text-xs leading-none text-subtle">
                      {formatVehicleIdentityLabel({
                        plate: card.vehiclePlate,
                        name: card.vehicleName,
                        sku: card.vehicleSku,
                      })}
                    </p>
                  </div>
                )
              }
              status={
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center justify-center rounded-xl border border-border bg-elevated px-3 text-xs font-semibold text-text hover:bg-card-hover"
                  onClick={() => {
                    setSpendCardId(card.id);
                    setSpendOpen(true);
                  }}
                >
                  {t("pages.pettyCash.prepaidSpend")}
                </button>
              }
              amount={formatContractPrice(card.currentBalance)}
            />
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-text">
          {t("pages.pettyCash.entriesTitle")}
        </h3>
        {filteredEntries.length === 0 ? (
          <p className="text-sm text-muted">{t("pages.pettyCash.entriesEmpty")}</p>
        ) : (
          <div className={financeRecordListClassName}>
            {filteredEntries.map((entry) => (
              <FinanceRecordRow
                key={entry.id}
                title={
                  <>
                    <h3 className="text-left text-sm font-semibold leading-snug tracking-tight text-text">
                      {entry.kind === "TOP_UP"
                        ? t("pages.pettyCash.kind.TOP_UP")
                        : entry.spendKind === "TOLL"
                          ? t("pages.pettyCash.spendToll")
                          : entry.spendKind === "PARKING"
                            ? t("pages.pettyCash.spendParking")
                            : t("pages.pettyCash.spendFuel")}
                    </h3>
                    <p className="mt-1 truncate text-xs leading-none text-subtle">
                      {formatDisplayDate(entry.entryDate, { timeZone: "UTC" })}
                      <span className="mx-1.5 text-border-strong" aria-hidden>
                        ·
                      </span>
                      {entry.card.cardNumber}
                    </p>
                    {entry.proofPath ? (
                      <a
                        href={entry.proofPath}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-primary-dark underline-offset-2 hover:underline"
                      >
                        {t("pages.pettyCash.viewProof")}
                      </a>
                    ) : null}
                  </>
                }
                status={null}
                amount={`${entry.kind === "TOP_UP" ? "+" : "−"}${formatContractPrice(entry.amount)}`}
              />
            ))}
          </div>
        )}
      </div>

      {canManageCards ? (
        <PrepaidCardCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          vehicles={unusedVehicles}
          onSaved={() => router.refresh()}
        />
      ) : null}
      <PrepaidCardSpendDialog
        open={spendOpen}
        onOpenChange={(open) => {
          setSpendOpen(open);
          if (!open) setSpendCardId(null);
        }}
        card={spendCard}
        cards={cards}
        onCardChange={setSpendCardId}
        onSaved={() => {
          setSpendOpen(false);
          setSpendCardId(null);
          router.refresh();
        }}
      />
      {canManageCards ? (
        <PrepaidCardEditDialog
          open={Boolean(editCard)}
          onOpenChange={(open) => {
            if (!open) setEditCardId(null);
          }}
          card={editCard}
          vehicles={[
            ...unusedVehicles,
            ...(editCard
              ? vehicles.filter((vehicle) => vehicle.id === editCard.vehicleItemId)
              : []),
          ]}
          onSaved={() => {
            setEditCardId(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  formatValue,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  formatValue: (value: string) => string;
  className?: string;
}) {
  return (
    <label className={cn("grid min-w-[8rem] gap-1.5", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
        {label}
      </span>
      <Select value={value} onValueChange={(next) => onChange(next ?? value)}>
        <SelectTrigger className={employeeSelectTriggerClass}>
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
  vehicles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: VehicleOption[];
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [cardNumber, setCardNumber] = useState("");
  const [vehicleItemId, setVehicleItemId] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      showMissingRequiredFields(event.currentTarget, [
        ...(vehicleItemId ? [] : [t("pages.pettyCash.vehicle")]),
      ])
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("cardNumber", cardNumber);
    formData.set("vehicleItemId", vehicleItemId);
    startTransition(async () => {
      try {
        await createPrepaidCard(formData);
        setCardNumber("");
        setVehicleItemId("");
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.prepaidCreateFailed"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCardNumber("");
          setVehicleItemId("");
        }
        onOpenChange(next);
      }}
    >
      <EmployeeDialogShell
        icon={CreditCard}
        title={t("pages.pettyCash.prepaidCreate")}
        description={t("pages.pettyCash.prepaidCreateDesc")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            <EmployeePrimaryButton form="prepaid-card-create" disabled={pending}>
              {pending ? t("common.actions.saving") : t("common.actions.save")}
            </EmployeePrimaryButton>
          </div>
        }
      >
        <form
          id="prepaid-card-create"
          className={employeeDialogFormClass}
          onSubmit={submit}
        >
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass}>
              {t("pages.pettyCash.cardNumber")}
              <span className="text-red-400"> *</span>
            </label>
            <Input
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              className={employeeInputClass}
              required
              data-required-label={t("pages.pettyCash.cardNumber")}
            />
          </div>
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass}>
              {t("pages.pettyCash.vehicle")}
              <span className="text-red-400"> *</span>
            </label>
            <Select
              value={vehicleItemId || null}
              onValueChange={(value) => setVehicleItemId(value ?? "")}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue>
                  {(value) => {
                    const vehicle = vehicles.find((row) => row.id === value);
                    return vehicle
                      ? vehiclePickerLabel(vehicle)
                      : t("pages.pettyCash.vehicle");
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehiclePickerLabel(vehicle)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="vehicleItemId"
              value={vehicleItemId}
              required
              data-required-label={t("pages.pettyCash.vehicle")}
            />
            <p className={employeeDialogHintClass}>
              {t("pages.pettyCash.prepaidInventoryOnlyHint")}
            </p>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}

function PrepaidCardEditDialog({
  open,
  onOpenChange,
  card,
  vehicles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CardRow | null;
  vehicles: VehicleOption[];
  onSaved: () => void;
}) {
  const { t } = useT();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [cardNumber, setCardNumber] = useState(card?.cardNumber ?? "");
  const [vehicleItemId, setVehicleItemId] = useState(card?.vehicleItemId ?? "");

  useEffect(() => {
    if (!open) return;
    setCardNumber(card?.cardNumber ?? "");
    setVehicleItemId(card?.vehicleItemId ?? "");
  }, [open, card]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!card) return;
    if (
      showMissingRequiredFields(event.currentTarget, [
        ...(vehicleItemId ? [] : [t("pages.pettyCash.vehicle")]),
      ])
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("cardNumber", cardNumber);
    formData.set("vehicleItemId", vehicleItemId);
    startTransition(async () => {
      try {
        await updatePrepaidCard(card.id, formData);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.updateFailed"));
      }
    });
  }

  async function handleDelete() {
    if (!card) return;
    const confirmed = await confirm({
      title: t("pages.pettyCash.deleteCard"),
      description: t("pages.pettyCash.deleteCardConfirm"),
      confirmLabel: t("common.actions.delete"),
      tone: "danger",
    });
    if (!confirmed) return;
    startTransition(async () => {
      try {
        await deletePrepaidCard(card.id);
        onOpenChange(false);
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.deleteCardFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={CreditCard}
        title={t("pages.pettyCash.editCard")}
        description={t("pages.pettyCash.editCardDesc")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton form="prepaid-card-edit" disabled={pending}>
              {pending ? t("common.actions.saving") : t("common.actions.saveChanges")}
            </EmployeePrimaryButton>
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending}
              onClick={() => void handleDelete()}
            >
              {t("pages.pettyCash.deleteCard")}
            </EmployeePrimaryButton>
          </div>
        }
      >
        <form
          id="prepaid-card-edit"
          className={employeeDialogFormClass}
          onSubmit={submit}
        >
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass}>
              {t("pages.pettyCash.cardNumber")}
              <span className="text-red-400"> *</span>
            </label>
            <Input
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              className={employeeInputClass}
              required
              data-required-label={t("pages.pettyCash.cardNumber")}
            />
          </div>
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass}>
              {t("pages.pettyCash.vehicle")}
              <span className="text-red-400"> *</span>
            </label>
            <Select
              value={vehicleItemId || null}
              onValueChange={(value) => setVehicleItemId(value ?? "")}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue>
                  {(value) => {
                    const vehicle = vehicles.find((row) => row.id === value);
                    return vehicle
                      ? vehiclePickerLabel(vehicle)
                      : t("pages.pettyCash.vehicle");
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehiclePickerLabel(vehicle)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="vehicleItemId"
              value={vehicleItemId}
              required
              data-required-label={t("pages.pettyCash.vehicle")}
            />
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}

function PrepaidCardSpendDialog({
  open,
  onOpenChange,
  card,
  cards,
  onCardChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CardRow | null;
  cards: CardRow[];
  onCardChange: (id: string) => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [spendKind, setSpendKind] = useState<"FUEL" | "TOLL" | "PARKING">(
    "FUEL"
  );
  const [amount, setAmount] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const extraMissing: string[] = [];
    if (!card) extraMissing.push(t("pages.pettyCash.vehicle"));
    if (!amount.replace(/\D/g, "")) {
      extraMissing.push(t("pages.pettyCash.enteredAmount"));
    }
    if (showMissingRequiredFields(event.currentTarget, extraMissing)) {
      return;
    }
    if (!card) return;
    const formData = new FormData(event.currentTarget);
    formData.set("prepaidCardId", card.id);
    formData.set("spendKind", spendKind);
    formData.set("amount", amount);
    startTransition(async () => {
      try {
        await recordPrepaidCardSpend(formData);
        setAmount("");
        onSaved();
      } catch (error) {
        showRejectionFromError(error, t("pages.pettyCash.prepaidSpendFailed"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setAmount("");
          setSpendKind("FUEL");
        }
        onOpenChange(next);
      }}
    >
      <EmployeeDialogShell
        icon={CreditCard}
        title={t("pages.pettyCash.prepaidSpend")}
        description={
          card ? vehicleCardLabel(card) : t("pages.pettyCash.prepaidSpendDesc")
        }
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
            <EmployeePrimaryButton form="prepaid-card-spend" disabled={pending}>
              {pending
                ? t("common.actions.saving")
                : t("pages.pettyCash.prepaidSpendConfirm")}
            </EmployeePrimaryButton>
          </div>
        }
      >
        <form
          id="prepaid-card-spend"
          className={employeeDialogFormClass}
          noValidate
          onSubmit={submit}
        >
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass}>
              {t("pages.pettyCash.vehicle")}
              <span className="text-red-400"> *</span>
            </label>
            <Select
              value={card?.id ?? null}
              onValueChange={(value) => {
                if (value) onCardChange(value);
              }}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue>
                  {(value) => {
                    const selected = cards.find((row) => row.id === value);
                    return selected
                      ? vehicleCardLabel(selected)
                      : t("pages.pettyCash.prepaidChooseVehicle");
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cards.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {vehicleCardLabel(row)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="vehicleItemId"
              value={card?.vehicleItemId ?? ""}
              required
              data-required-label={t("pages.pettyCash.vehicle")}
            />
            {card ? (
              <p className={employeeDialogHintClass}>
                {t("pages.pettyCash.prepaidLinkedCard")}: {card.cardNumber} ·{" "}
                {t("pages.pettyCash.prepaidCardForVehicle")}
              </p>
            ) : (
              <p className={employeeDialogHintClass}>
                {t("pages.pettyCash.prepaidCardForVehicle")}
              </p>
            )}
          </div>
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass}>
              {t("pages.pettyCash.spendKind")}
            </label>
            <div className={choiceGridClassForCount(3)}>
              {(
                [
                  ["FUEL", t("pages.pettyCash.spendFuel")],
                  ["TOLL", t("pages.pettyCash.spendToll")],
                  ["PARKING", t("pages.pettyCash.spendParking")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpendKind(value)}
                  className={cn(
                    "inline-flex min-h-8 items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold",
                    spendKind === value
                      ? outlineChipTones.emeraldInteractive
                      : "border border-border bg-elevated text-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={employeeDialogFieldClass}>
            <label className={employeeDialogLabelClass}>
              {t("pages.pettyCash.enteredAmount")}
              <span className="text-red-400"> *</span>
            </label>
            <MoneyInput
              value={amount}
              onValueChange={setAmount}
              className={employeeInputClass}
              required
              data-required-label={t("pages.pettyCash.enteredAmount")}
            />
          </div>
          <input type="hidden" name="entryDate" value={todayDateInput()} />
          <FileDropField
            id="prepaid-spend-proof"
            name="proof"
            label={t("pages.pettyCash.proof")}
            required
            accept="image/*,.pdf,application/pdf"
          />
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
