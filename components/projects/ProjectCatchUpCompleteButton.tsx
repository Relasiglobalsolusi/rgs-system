"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";

import { completeCatchUpPeriod } from "@/app/projects/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { FileDropField } from "@/components/ui/FileDropField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { StackedChipLabel } from "@/components/ui/StatusBadge";
import { detailActionBarButtonClassName } from "@/components/projects/detail-action-bar";
import type { CatchUpCompleteTarget } from "@/lib/project-catch-up-periods";
import { useT } from "@/lib/i18n/use-t";
import { formatEmployeeName } from "@/lib/employee-user-link";

const OTHER_ITEM = "__other__";

type InventoryOption = { id: string; name: string; unit: string | null };
type StaffOption = { id: string; firstName: string; lastName: string };

type InventoryLine = {
  key: string;
  itemId: string;
  name: string;
  qty: string;
  amount: string;
};

type StaffLine = {
  key: string;
  employeeId: string;
  name: string;
  amount: string;
};

const ORDINAL_KEYS = [
  "ordinalFirst",
  "ordinalSecond",
  "ordinalThird",
  "ordinalFourth",
  "ordinalFifth",
  "ordinalSixth",
  "ordinalSeventh",
  "ordinalEighth",
  "ordinalNinth",
  "ordinalTenth",
] as const;

function nextKey(prefix: string, index: number) {
  return `${prefix}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

export function catchUpCompleteButtonLabel(
  target: CatchUpCompleteTarget,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (target.kind === "job") {
    return t("pages.projects.catchUp.completeJob");
  }
  const ordinalKey = ORDINAL_KEYS[target.ordinal - 1];
  if (ordinalKey) {
    return t("pages.projects.catchUp.completePeriod", {
      ordinal: t(`pages.projects.catchUp.${ordinalKey}`),
    });
  }
  return t("pages.projects.catchUp.completePeriodN", { n: target.ordinal });
}

export default function ProjectCatchUpCompleteButton({
  projectId,
  target,
  inventoryItems,
  employees,
}: {
  projectId: string;
  target: CatchUpCompleteTarget;
  inventoryItems: InventoryOption[];
  employees: StaffOption[];
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, startTransition] = useTransition();
  const [inventory, setInventory] = useState<InventoryLine[]>([
    { key: "inv-0", itemId: "", name: "", qty: "", amount: "" },
  ]);
  const [staff, setStaff] = useState<StaffLine[]>([
    { key: "stf-0", employeeId: "", name: "", amount: "" },
  ]);
  const [paid, setPaid] = useState(false);

  const buttonLabel = useMemo(
    () => catchUpCompleteButtonLabel(target, t),
    [target, t]
  );
  const dialogTitle =
    target.kind === "job"
      ? t("pages.projects.catchUp.dialogTitleJob")
      : t("pages.projects.catchUp.dialogTitlePeriod", { label: target.label });

  function reset() {
    setStep(1);
    setPaid(false);
    setInventory([{ key: nextKey("inv", 0), itemId: "", name: "", qty: "", amount: "" }]);
    setStaff([{ key: nextKey("stf", 0), employeeId: "", name: "", amount: "" }]);
  }

  function submit(formData: FormData) {
    formData.set("projectId", projectId);
    formData.set("periodStart", target.periodStart);
    formData.set("periodEnd", target.periodEnd);
    formData.set("completeKind", target.kind);
    formData.set("inventoryCount", String(inventory.length));
    formData.set("staffCount", String(staff.length));
    inventory.forEach((line, index) => {
      formData.set(
        `inventoryItemId.${index}`,
        line.itemId === OTHER_ITEM ? "" : line.itemId
      );
      formData.set(`inventoryName.${index}`, line.name);
      formData.set(`inventoryQty.${index}`, line.qty);
      formData.set(`inventoryAmount.${index}`, line.amount);
    });
    staff.forEach((line, index) => {
      formData.set(`staffEmployeeId.${index}`, line.employeeId);
      formData.set(`staffName.${index}`, line.name);
      formData.set(`staffPay.${index}`, line.amount);
    });
    startTransition(async () => {
      try {
        await completeCatchUpPeriod(formData);
        setOpen(false);
        reset();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.catchUp.failed"));
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="successBadge"
        size="lg"
        className={detailActionBarButtonClassName}
        aria-label={buttonLabel}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <StackedChipLabel
          lines={
            target.kind === "job"
              ? [
                  t("pages.projects.catchUp.completeJob1"),
                  t("pages.projects.catchUp.completeJob2"),
                ]
              : [
                  t("pages.projects.catchUp.completePeriod1"),
                  t("pages.projects.catchUp.completePeriod2", {
                    ordinal:
                      ORDINAL_KEYS[target.ordinal - 1]
                        ? t(
                            `pages.projects.catchUp.${ORDINAL_KEYS[target.ordinal - 1]}`
                          )
                        : String(target.ordinal),
                  }),
                ]
          }
        />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <EmployeeDialogShell
          icon={CalendarCheck}
          title={dialogTitle}
          description={t("pages.projects.catchUp.dialogHint")}
          maxWidth="lg"
          footer={
            step === 1 ? (
              <EmployeePrimaryButton
                type="button"
                onClick={() => setStep(2)}
              >
                {t("pages.projects.catchUp.billingStep")}
              </EmployeePrimaryButton>
            ) : (
              <>
                <EmployeeSecondaryButton onClick={() => setStep(1)}>
                  {t("pages.projects.catchUp.costsStep")}
                </EmployeeSecondaryButton>
                <EmployeePrimaryButton
                  form="catch-up-complete-form"
                  disabled={pending}
                >
                  {target.kind === "job"
                    ? t("pages.projects.catchUp.saveJob")
                    : t("pages.projects.catchUp.savePeriod")}
                </EmployeePrimaryButton>
              </>
            )
          }
        >
          <form
            id="catch-up-complete-form"
            action={submit}
            className="flex flex-col gap-6"
          >
            {step === 1 ? (
              <>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-text">
                    {t("pages.projects.catchUp.inventoryIssued")}
                  </p>
                  <p className={employeeDialogHintClass}>
                    {t("pages.projects.catchUp.inventoryHint")}
                  </p>
                  {inventory.map((line, index) => (
                    <div
                      key={line.key}
                      className="grid gap-3 rounded-xl border border-border bg-elevated p-4 sm:grid-cols-2"
                    >
                      <div className={employeeDialogFieldClass}>
                        <label className={employeeDialogLabelClass}>
                          {t("pages.projects.catchUp.item")}
                        </label>
                        <Select
                          value={line.itemId || null}
                          onValueChange={(value) =>
                            setInventory((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      itemId: value ?? "",
                                      name:
                                        value === OTHER_ITEM
                                          ? row.name
                                          : inventoryItems.find((item) => item.id === value)
                                              ?.name ?? "",
                                    }
                                  : row
                              )
                            )
                          }
                          items={[
                            ...inventoryItems.map((item) => ({
                              value: item.id,
                              label: item.name,
                            })),
                            {
                              value: OTHER_ITEM,
                              label: t("pages.projects.catchUp.itemOther"),
                            },
                          ]}
                        >
                          <SelectTrigger className={employeeSelectTriggerClass}>
                            <SelectValue
                              placeholder={t("pages.projects.catchUp.item")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {inventoryItems.map((item) => (
                              <SelectItem
                                key={item.id}
                                value={item.id}
                                label={item.name}
                              >
                                {item.name}
                              </SelectItem>
                            ))}
                            <SelectItem
                              value={OTHER_ITEM}
                              label={t("pages.projects.catchUp.itemOther")}
                            >
                              {t("pages.projects.catchUp.itemOther")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {line.itemId === OTHER_ITEM ? (
                        <div className={employeeDialogFieldClass}>
                          <label className={employeeDialogLabelClass}>
                            {t("pages.projects.catchUp.itemName")}
                          </label>
                          <Input
                            className={employeeInputClass}
                            value={line.name}
                            onChange={(event) =>
                              setInventory((prev) =>
                                prev.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, name: event.target.value }
                                    : row
                                )
                              )
                            }
                          />
                        </div>
                      ) : null}
                      <div className={employeeDialogFieldClass}>
                        <label className={employeeDialogLabelClass}>
                          {t("pages.projects.catchUp.quantity")}
                        </label>
                        <Input
                          className={employeeInputClass}
                          inputMode="decimal"
                          value={line.qty}
                          onChange={(event) =>
                            setInventory((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, qty: event.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </div>
                      <div className={employeeDialogFieldClass}>
                        <label className={employeeDialogLabelClass}>
                          {t("pages.projects.catchUp.amount")}
                        </label>
                        <MoneyInput
                          className={employeeInputClass}
                          value={line.amount}
                          onValueChange={(next) =>
                            setInventory((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, amount: next } : row
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setInventory((prev) => [
                        ...prev,
                        {
                          key: nextKey("inv", prev.length),
                          itemId: "",
                          name: "",
                          qty: "",
                          amount: "",
                        },
                      ])
                    }
                  >
                    {t("pages.projects.catchUp.addInventory")}
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-text">
                    {t("pages.projects.catchUp.staffIssued")}
                  </p>
                  <p className={employeeDialogHintClass}>
                    {t("pages.projects.catchUp.staffHint")}
                  </p>
                  {staff.map((line, index) => (
                    <div
                      key={line.key}
                      className="grid gap-3 rounded-xl border border-border bg-elevated p-4 sm:grid-cols-2"
                    >
                      <div className={employeeDialogFieldClass}>
                        <label className={employeeDialogLabelClass}>
                          {t("pages.projects.catchUp.employee")}
                        </label>
                        <Select
                          value={line.employeeId || null}
                          onValueChange={(value) => {
                            const person = employees.find((row) => row.id === value);
                            setStaff((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      employeeId: value ?? "",
                                      name: person
                                        ? formatEmployeeName(person)
                                        : row.name,
                                    }
                                  : row
                              )
                            );
                          }}
                          items={employees.map((person) => ({
                            value: person.id,
                            label: formatEmployeeName(person),
                          }))}
                        >
                          <SelectTrigger className={employeeSelectTriggerClass}>
                            <SelectValue
                              placeholder={t("pages.projects.catchUp.employee")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((person) => (
                              <SelectItem
                                key={person.id}
                                value={person.id}
                                label={formatEmployeeName(person)}
                              >
                                {formatEmployeeName(person)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className={employeeDialogFieldClass}>
                        <label className={employeeDialogLabelClass}>
                          {t("pages.projects.catchUp.staffPay")}
                        </label>
                        <MoneyInput
                          className={employeeInputClass}
                          value={line.amount}
                          onValueChange={(next) =>
                            setStaff((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, amount: next } : row
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setStaff((prev) => [
                        ...prev,
                        {
                          key: nextKey("stf", prev.length),
                          employeeId: "",
                          name: "",
                          amount: "",
                        },
                      ])
                    }
                  >
                    {t("pages.projects.catchUp.addStaff")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className={employeeDialogFieldClass}>
                  <label className={employeeDialogLabelClass} htmlFor="catch-up-client-amount">
                    {t("pages.projects.catchUp.clientPays")}
                    <span className="text-red-400"> *</span>
                  </label>
                  <p className={employeeDialogHintClass}>
                    {t("pages.projects.catchUp.clientPaysHint")}
                  </p>
                  <MoneyInput
                    id="catch-up-client-amount"
                    name="clientAmount"
                    className={employeeInputClass}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FileDropField
                    id="catch-up-invoice"
                    name="catchUpInvoice"
                    label={t("pages.projects.catchUp.invoice")}
                    required
                    multiple
                  />
                  <FileDropField
                    id="catch-up-tax"
                    name="catchUpTaxInvoice"
                    label={t("pages.projects.catchUp.taxInvoice")}
                    required
                    multiple
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-text">
                  <Checkbox
                    checked={paid}
                    onCheckedChange={(next) => setPaid(Boolean(next))}
                    aria-label={t("pages.projects.catchUp.paymentReceived")}
                  />
                  {t("pages.projects.catchUp.paymentReceived")}
                </label>
                <input
                  type="hidden"
                  name="catchUpPaymentReceived"
                  value={paid ? "Yes" : "No"}
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.projects.catchUp.paymentHint")}
                </p>
                {paid ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={employeeDialogFieldClass}>
                      <label className={employeeDialogLabelClass} htmlFor="catch-up-paid-amount">
                        {t("pages.projects.catchUp.amountReceived")}
                        <span className="text-red-400"> *</span>
                      </label>
                      <MoneyInput
                        id="catch-up-paid-amount"
                        name="catchUpPaymentAmount"
                        className={employeeInputClass}
                        required
                      />
                    </div>
                    <FileDropField
                      id="catch-up-pay-proof"
                      name="catchUpPaymentProof"
                      label={t("pages.projects.catchUp.paymentProof")}
                      required
                      multiple
                    />
                  </div>
                ) : null}
              </div>
            )}
          </form>
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
