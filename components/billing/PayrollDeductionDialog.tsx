"use client";

import { useState, useTransition } from "react";
import { MinusCircle } from "lucide-react";
import { toast } from "sonner";

import { addPayrollDeduction } from "@/app/billing/payroll-actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { Textarea } from "@/components/ui/textarea";
import type {
  PayrollCatalogItem,
  PayrollProjectOption,
} from "@/lib/internal-payroll-month";
import { useT } from "@/lib/i18n/use-t";
import { HEAD_OFFICE_PAYROLL_PROJECT } from "@/lib/payroll-deductions";

type DeductionType =
  | "SECURITY_DEPOSIT"
  | "LOST_STOCK"
  | "PENALTY"
  | "OTHER"
  | "CLIENT_COMPENSATION";

function deductionTypeLabelKey(type: DeductionType) {
  switch (type) {
    case "SECURITY_DEPOSIT":
      return "pages.payroll.deductionTypes.securityDeposit" as const;
    case "LOST_STOCK":
      return "pages.payroll.deductionTypes.lostStock" as const;
    case "CLIENT_COMPENSATION":
      return "pages.payroll.deductionTypes.clientCompensation" as const;
    case "PENALTY":
      return "pages.payroll.deductionTypes.penalty" as const;
    default:
      return "pages.payroll.deductionTypes.other" as const;
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
  items: PayrollCatalogItem[];
  projects: PayrollProjectOption[];
  securityDepositBlocked?: boolean;
  securityDepositBlockReason?: "held" | "notRequired";
};

export default function PayrollDeductionDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  year,
  month,
  items,
  projects,
  securityDepositBlocked = false,
  securityDepositBlockReason = "held",
}: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<DeductionType>(
    securityDepositBlocked ? "PENALTY" : "SECURITY_DEPOSIT"
  );
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [projectId, setProjectId] = useState(HEAD_OFFICE_PAYROLL_PROJECT);
  const [alreadyExpensed, setAlreadyExpensed] = useState(false);
  const commercialProjects = projects.filter(
    (project) => project.id !== HEAD_OFFICE_PAYROLL_PROJECT
  );
  const selectedProject =
    projects.find((project) => project.id === projectId) ?? null;
  const selectedItem = items.find((item) => item.id === itemId) ?? null;

  function reset() {
    setType(securityDepositBlocked ? "PENALTY" : "SECURITY_DEPOSIT");
    setAmount("");
    setReason("");
    setItemId("");
    setItemName("");
    setQuantity("");
    setProjectId(HEAD_OFFICE_PAYROLL_PROJECT);
    setAlreadyExpensed(false);
  }

  function submit() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("employeeId", employeeId);
        formData.set("year", String(year));
        formData.set("month", String(month));
        formData.set("type", type);
        formData.set("amount", amount);
        formData.set("reason", reason);
        if (type === "LOST_STOCK") {
          formData.set("inventoryItemId", itemId);
          formData.set("itemName", itemName);
          formData.set("quantity", quantity);
          formData.set("projectId", projectId);
          if (alreadyExpensed) formData.set("alreadyExpensed", "true");
        }
        if (type === "CLIENT_COMPENSATION") {
          formData.set("projectId", projectId);
        }
        await addPayrollDeduction(formData);
        toast.success(t("pages.payroll.deductionSaved"));
        reset();
        onOpenChange(false);
      } catch (error) {
        showRejectionFromError(error, t("pages.payroll.errors.saveFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={MinusCircle}
        title={t("pages.payroll.addDeduction")}
        description={t("pages.payroll.addDeductionDesc", { name: employeeName })}
        maxWidth="md"
        footer={
          <EmployeePrimaryButton
            type="button"
            disabled={pending}
            onClick={submit}
          >
            {pending ? t("common.actions.saving") : t("pages.payroll.saveDeduction")}
          </EmployeePrimaryButton>
        }
      >
        <div className="flex flex-col gap-5">
          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-semibold text-text">
              {t("pages.payroll.deductionType")}
            </label>
            <Select
              value={type}
              onValueChange={(value) => {
                if (!value) return;
                const next = value as DeductionType;
                setType(next);
                if (
                  next === "CLIENT_COMPENSATION" &&
                  (projectId === HEAD_OFFICE_PAYROLL_PROJECT || !projectId)
                ) {
                  const first = commercialProjects[0];
                  if (first) setProjectId(first.id);
                }
              }}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue>{t(deductionTypeLabelKey(type))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!securityDepositBlocked ? (
                  <SelectItem value="SECURITY_DEPOSIT">
                    {t("pages.payroll.deductionTypes.securityDeposit")}
                  </SelectItem>
                ) : null}
                <SelectItem value="LOST_STOCK">
                  {t("pages.payroll.deductionTypes.lostStock")}
                </SelectItem>
                <SelectItem value="CLIENT_COMPENSATION">
                  {t("pages.payroll.deductionTypes.clientCompensation")}
                </SelectItem>
                <SelectItem value="PENALTY">
                  {t("pages.payroll.deductionTypes.penalty")}
                </SelectItem>
                <SelectItem value="OTHER">
                  {t("pages.payroll.deductionTypes.other")}
                </SelectItem>
              </SelectContent>
            </Select>
            {securityDepositBlocked ? (
              <p className={employeeDialogHintClass}>
                {securityDepositBlockReason === "notRequired"
                  ? t("pages.payroll.errors.securityDepositNotRequired")
                  : t("pages.payroll.errors.securityDepositAlreadyHeld")}
              </p>
            ) : null}
          </div>

          <div className={employeeDialogFieldClass}>
            <label className="text-sm font-semibold text-text">
              {t("pages.payroll.deductionAmount")}
            </label>
            <Input
              className={employeeInputClass}
              inputMode="numeric"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="0"
            />
            <p className={employeeDialogHintClass}>
              {t("pages.payroll.deductionAmountHint")}
            </p>
          </div>

          {type === "OTHER" || type === "PENALTY" || type === "CLIENT_COMPENSATION" ? (
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-semibold text-text">
                {t("pages.payroll.deductionReason")}
                {type === "OTHER" || type === "CLIENT_COMPENSATION" ? " *" : ""}
              </label>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
              />
            </div>
          ) : null}

          {type === "CLIENT_COMPENSATION" ? (
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-semibold text-text">
                {t("pages.payroll.lostStockProject")}
              </label>
              <Select
                value={projectId}
                onValueChange={(value) => {
                  if (value) setProjectId(value);
                }}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue>
                    {selectedProject &&
                    selectedProject.id !== HEAD_OFFICE_PAYROLL_PROJECT
                      ? selectedProject.name
                      : t("pages.payroll.selectProject")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {commercialProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {type === "LOST_STOCK" ? (
            <>
              <div className={employeeDialogFieldClass}>
                <label className="text-sm font-semibold text-text">
                  {t("pages.payroll.lostStockItem")}
                </label>
                <Select
                  value={itemId || "__none__"}
                  onValueChange={(value) =>
                    setItemId(!value || value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue>
                      {selectedItem
                        ? `${selectedItem.name} (${selectedItem.sku})`
                        : t("pages.payroll.lostStockItemNone")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t("pages.payroll.lostStockItemNone")}
                    </SelectItem>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={employeeDialogFieldClass}>
                <label className="text-sm font-semibold text-text">
                  {t("pages.payroll.lostStockItemName")}
                </label>
                <Input
                  className={employeeInputClass}
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                />
              </div>
              {itemId ? (
                <div className={employeeDialogFieldClass}>
                  <label className="text-sm font-semibold text-text">
                    {t("pages.payroll.lostStockQuantity")}
                  </label>
                  <Input
                    className={employeeInputClass}
                    inputMode="numeric"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(event.target.value.replace(/[^\d]/g, ""))
                    }
                  />
                </div>
              ) : null}
              <div className={employeeDialogFieldClass}>
                <label className="text-sm font-semibold text-text">
                  {t("pages.payroll.lostStockProject")}
                </label>
                <Select
                  value={projectId}
                  onValueChange={(value) => {
                    if (value) setProjectId(value);
                  }}
                >
                  <SelectTrigger className={employeeSelectTriggerClass}>
                    <SelectValue>
                      {selectedProject?.name ?? t("pages.payroll.selectProject")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-start gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={alreadyExpensed}
                  onChange={(event) => setAlreadyExpensed(event.target.checked)}
                />
                <span>{t("pages.payroll.alreadyExpensed")}</span>
              </label>
            </>
          ) : null}
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
