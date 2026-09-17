"use client";

import { Fragment, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Percent } from "lucide-react";

import {
  addCompanyTaxRate,
  addCompanyTaxType,
} from "@/app/billing/tax-invoices/rates/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
} from "@/components/employees/employee-dialog-ui";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDisplayDate } from "@/lib/format-date";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";
import {
  formatTaxRatePercent,
  type TaxRateTypeView,
} from "@/lib/tax-rate-codes";
import { cn } from "@/lib/utils";

function appliesToLabel(
  appliesTo: TaxRateTypeView["appliesTo"],
  t: ReturnType<typeof useT>["t"]
) {
  return appliesTo === "CORPORATE"
    ? t("pages.taxRates.appliesCorporate")
    : t("pages.taxRates.appliesClient");
}

export default function TaxRatesPanel({ types }: { types: TaxRateTypeView[] }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [rateTypeId, setRateTypeId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rateType = useMemo(
    () => types.find((row) => row.id === rateTypeId) ?? null,
    [rateTypeId, types]
  );

  async function submitType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await addCompanyTaxType(new FormData(event.currentTarget));
      setAddTypeOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.taxRates.saveFailed")
      );
    } finally {
      setPending(false);
    }
  }

  async function submitRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await addCompanyTaxRate(new FormData(event.currentTarget));
      setRateTypeId(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.taxRates.saveFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text">
            {t("pages.taxRates.heading")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {t("pages.taxRates.hint")}
          </p>
        </div>
        <DirectoryAddButton
          label={t("pages.taxRates.addType")}
          onClick={() => {
            setError(null);
            setAddTypeOpen(true);
          }}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table className="min-w-[44rem]">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[12%]" />
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 sm:px-5">
                {t("pages.taxRates.columnType")}
              </TableHead>
              <TableHead className="px-3 text-center sm:px-4">
                {t("pages.taxRates.columnRate")}
              </TableHead>
              <TableHead className="px-4 pl-8 sm:px-5 sm:pl-10">
                {t("pages.taxRates.columnFrom")}
              </TableHead>
              <TableHead className="px-4 sm:px-5">
                {t("pages.taxRates.columnApplies")}
              </TableHead>
              <TableHead className="px-4 text-right sm:px-5">
                <span className="sr-only">{t("pages.taxRates.addRate")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((type) => {
              const open = expanded === type.id;
              return (
                <Fragment key={type.id}>
                  <TableRow>
                    <TableCell className="px-4 sm:px-5">
                      <button
                        type="button"
                        className="text-left font-semibold text-text"
                        onClick={() => setExpanded(open ? null : type.id)}
                      >
                        {type.name}
                      </button>
                    </TableCell>
                    <TableCell className="px-3 text-center tabular-nums sm:px-4">
                      {type.currentPercent != null
                        ? formatTaxRatePercent(type.currentPercent)
                        : t("pages.taxRates.noRate")}
                    </TableCell>
                    <TableCell className="px-4 pl-8 text-subtle sm:px-5 sm:pl-10">
                      {type.currentFrom
                        ? formatDisplayDate(
                            new Date(`${type.currentFrom}T00:00:00Z`),
                            { timeZone: "UTC" },
                            locale === "id" ? "id-ID" : "en-GB"
                          )
                        : "—"}
                    </TableCell>
                    <TableCell className="px-4 text-subtle sm:px-5">
                      {appliesToLabel(type.appliesTo, t)}
                    </TableCell>
                    <TableCell className="px-4 text-right sm:px-5">
                      <DirectoryAddButton
                        label={t("pages.taxRates.addRate")}
                        icon={<Pencil className="h-3.5 w-3.5 shrink-0" />}
                        onClick={() => {
                          setError(null);
                          setRateTypeId(type.id);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                  {open ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="whitespace-normal bg-surface-muted/30 px-4 py-3 sm:px-5"
                      >
                        <p className="mb-2 text-xs font-medium text-subtle">
                          {t("pages.taxRates.history")}
                        </p>
                        {type.versions.length === 0 ? (
                          <p className="text-sm text-muted">
                            {t("pages.taxRates.noRateHint")}
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {type.versions.map((version) => (
                              <li
                                key={version.id}
                                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                              >
                                <span className="tabular-nums text-text">
                                  {formatTaxRatePercent(version.ratePercent)}
                                </span>
                                <span className="text-subtle">
                                  {t("pages.taxRates.fromDate", {
                                    date: formatDisplayDate(
                                      new Date(
                                        `${version.effectiveFrom}T00:00:00Z`
                                      ),
                                      { timeZone: "UTC" },
                                      locale === "id" ? "id-ID" : "en-GB"
                                    ),
                                  })}
                                </span>
                                {version.note ? (
                                  <span className="w-full text-xs text-muted">
                                    {version.note}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={addTypeOpen}
        onOpenChange={(next) => {
          setAddTypeOpen(next);
          if (!next) setError(null);
        }}
      >
        <EmployeeDialogShell
          icon={Percent}
          title={t("pages.taxRates.addTypeTitle")}
          description={t("pages.taxRates.addTypeDesc")}
          maxWidth="md"
          footer={
            <div className="flex w-full flex-col gap-3">
              <EmployeePrimaryButton
                type="submit"
                form="tax-rate-add-type"
                disabled={pending}
              >
                {pending ? t("common.actions.saving") : t("pages.taxRates.saveType")}
              </EmployeePrimaryButton>
              <EmployeeSecondaryButton
                disabled={pending}
                onClick={() => setAddTypeOpen(false)}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
            </div>
          }
        >
          <form
            id="tax-rate-add-type"
            onSubmit={submitType}
            className={employeeDialogFormClass}
          >
            <div className={employeeDialogFieldClass}>
              <label htmlFor="tax-type-name" className={employeeDialogLabelClass}>
                {t("pages.taxRates.typeName")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="tax-type-name"
                name="name"
                required
                disabled={pending}
                placeholder={t("pages.taxRates.typeNamePlaceholder")}
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label htmlFor="tax-type-applies" className={employeeDialogLabelClass}>
                {t("pages.taxRates.columnApplies")}
              </label>
              <select
                id="tax-type-applies"
                name="appliesTo"
                defaultValue="CLIENT_CHARGE"
                disabled={pending}
                className={cn(employeeInputClass, "h-11")}
              >
                <option value="CLIENT_CHARGE">
                  {t("pages.taxRates.appliesClient")}
                </option>
                <option value="CORPORATE">
                  {t("pages.taxRates.appliesCorporate")}
                </option>
              </select>
              <p className={employeeDialogHintClass}>
                {t("pages.taxRates.appliesHint")}
              </p>
            </div>
            <div className={employeeDialogFieldClass}>
              <label htmlFor="tax-type-rate" className={employeeDialogLabelClass}>
                {t("pages.taxRates.columnRate")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="tax-type-rate"
                name="ratePercent"
                required
                inputMode="decimal"
                disabled={pending}
                placeholder="11"
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label htmlFor="tax-type-from" className={employeeDialogLabelClass}>
                {t("pages.taxRates.effectiveFrom")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="tax-type-from"
                name="effectiveFrom"
                type="date"
                required
                disabled={pending}
                defaultValue={todayDateInput()}
                className={employeeInputClass}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.taxRates.effectiveFromHint")}
              </p>
            </div>
            <div className={employeeDialogFieldClass}>
              <label htmlFor="tax-type-note" className={employeeDialogLabelClass}>
                {t("pages.taxRates.note")}
              </label>
              <Textarea
                id="tax-type-note"
                name="note"
                disabled={pending}
                rows={2}
                className="min-h-[4.5rem] rounded-xl border border-border bg-elevated px-4 py-3 text-sm"
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </form>
        </EmployeeDialogShell>
      </Dialog>

      <Dialog
        open={rateTypeId != null}
        onOpenChange={(next) => {
          if (!next) {
            setRateTypeId(null);
            setError(null);
          }
        }}
      >
        <EmployeeDialogShell
          icon={Percent}
          title={t("pages.taxRates.addRateTitle", {
            name: rateType?.name ?? "",
          })}
          description={t("pages.taxRates.addRateDesc")}
          maxWidth="md"
          footer={
            <div className="flex w-full flex-col gap-3">
              <EmployeePrimaryButton
                type="submit"
                form="tax-rate-add-version"
                disabled={pending}
              >
                {pending ? t("common.actions.saving") : t("pages.taxRates.saveRate")}
              </EmployeePrimaryButton>
              <EmployeeSecondaryButton
                disabled={pending}
                onClick={() => setRateTypeId(null)}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
            </div>
          }
        >
          <form
            id="tax-rate-add-version"
            onSubmit={submitRate}
            className={employeeDialogFormClass}
          >
            <input type="hidden" name="typeId" value={rateType?.id ?? ""} />
            <div className={employeeDialogFieldClass}>
              <label htmlFor="tax-rate-percent" className={employeeDialogLabelClass}>
                {t("pages.taxRates.columnRate")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="tax-rate-percent"
                name="ratePercent"
                required
                inputMode="decimal"
                disabled={pending}
                defaultValue={
                  rateType?.currentPercent != null
                    ? String(rateType.currentPercent)
                    : ""
                }
                className={employeeInputClass}
              />
            </div>
            <div className={employeeDialogFieldClass}>
              <label htmlFor="tax-rate-from" className={employeeDialogLabelClass}>
                {t("pages.taxRates.effectiveFrom")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="tax-rate-from"
                name="effectiveFrom"
                type="date"
                required
                disabled={pending}
                defaultValue={todayDateInput()}
                className={employeeInputClass}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.taxRates.effectiveFromHint")}
              </p>
            </div>
            <div className={employeeDialogFieldClass}>
              <label htmlFor="tax-rate-note" className={employeeDialogLabelClass}>
                {t("pages.taxRates.note")}
              </label>
              <Textarea
                id="tax-rate-note"
                name="note"
                disabled={pending}
                rows={2}
                className="min-h-[4.5rem] rounded-xl border border-border bg-elevated px-4 py-3 text-sm"
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </form>
        </EmployeeDialogShell>
      </Dialog>
    </div>
  );
}
