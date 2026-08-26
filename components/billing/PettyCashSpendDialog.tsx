"use client";

import { useState, type FormEvent } from "react";
import { Receipt } from "lucide-react";
import { useRouter } from "next/navigation";

import { recordPettyCashSpend } from "@/app/billing/petty-cash/actions";
import { BillingDocumentFilePick } from "@/components/billing/BillingDocumentVerifyDialog";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import DirectoryFilterTab from "@/components/ui/DirectoryFilterTab";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import SearchableClientSelect from "@/components/ui/SearchableClientSelect";
import SearchableProjectSelect from "@/components/ui/SearchableProjectSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { showMissingRequiredFields } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { todayDateInput } from "@/lib/project-contract";
import { cn } from "@/lib/utils";

type ProjectOption = {
  id: string;
  name: string;
  clientName: string | null;
  subCategory?: string | null;
};

type ClientOption = {
  id: string;
  name: string;
};

type BillForEmployee = {
  id: string;
  name: string;
};

type ChargeType = "client" | "project";

export default function PettyCashSpendDialog({
  projects,
  clients,
  billForEmployees,
}: {
  projects: ProjectOption[];
  clients: ClientOption[];
  billForEmployees: BillForEmployee[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayDateInput());
  const [description, setDescription] = useState("");
  const [chargeType, setChargeType] = useState<ChargeType | "">("");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const typedAmount = Number(amount.replace(/[^\d]/g, ""));

  function reset() {
    setError(null);
    setDocumentFile(null);
    setAmount("");
    setEntryDate(todayDateInput());
    setDescription("");
    setChargeType("");
    setProjectId("");
    setClientId("");
    setEmployeeId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const extraMissing: string[] = [];
    if (!documentFile) extraMissing.push(t("pages.pettyCash.proof"));
    if (!employeeId) extraMissing.push(t("pages.pettyCash.billIsForRequired"));
    if (!chargeType) extraMissing.push(t("pages.pettyCash.chargeTypeRequired"));
    if (chargeType === "client" && !clientId) {
      extraMissing.push(t("pages.pettyCash.chargeTypeRequired"));
    }
    if (chargeType === "project" && !projectId) {
      extraMissing.push(t("pages.pettyCash.chargeTypeRequired"));
    }
    if (showMissingRequiredFields(event.currentTarget, extraMissing)) {
      return;
    }
    if (!documentFile || !chargeType) return;

    const formData = new FormData(event.currentTarget);
    formData.set("document", documentFile);
    formData.set("amount", String(Math.round(typedAmount)));
    formData.set("entryDate", entryDate);
    formData.set("description", description.trim());
    formData.set("chargeType", chargeType);
    formData.set("projectId", chargeType === "project" ? projectId : "");
    formData.set("clientId", chargeType === "client" ? clientId : "");
    formData.set("employeeId", employeeId);

    setPending(true);
    try {
      await recordPettyCashSpend(formData);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pages.pettyCash.spendFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="permissionsBadge" size="badgeFlex">
          <Receipt className="h-3.5 w-3.5" aria-hidden />
          {t("pages.pettyCash.recordSpend")}
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={Receipt}
        title={t("pages.pettyCash.spendTitle")}
        description={t("pages.pettyCash.spendDesc")}
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="submit"
              form="petty-cash-spend-form"
              disabled={pending}
            >
              {pending
                ? t("pages.pettyCash.spending")
                : t("pages.pettyCash.spendConfirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <form
          id="petty-cash-spend-form"
          onSubmit={handleSubmit}
          noValidate
          className={employeeDialogFormClass}
        >
          <div className={employeeDialogGridClass}>
            <div className="sm:col-span-2 space-y-2">
              <BillingDocumentFilePick
                id="petty-cash-proof"
                label={t("pages.pettyCash.proof")}
                required
                fileName={documentFile?.name ?? null}
                onPick={(file) => {
                  setDocumentFile(file);
                  setError(null);
                }}
                disabled={pending}
              />
              <p className={employeeDialogHintClass}>
                {t("pages.pettyCash.proofHint")}
              </p>
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="petty-cash-amount"
                className={employeeDialogLabelClass}
              >
                {t("pages.pettyCash.enteredAmount")}
                <span className="text-red-400"> *</span>
              </label>
              <MoneyInput
                id="petty-cash-amount"
                name="amount"
                required
                disabled={pending}
                value={amount}
                onValueChange={setAmount}
                placeholder={t("pages.pettyCash.amountPlaceholder")}
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label
                htmlFor="petty-cash-date"
                className={employeeDialogLabelClass}
              >
                {t("pages.pettyCash.date")}
                <span className="text-red-400"> *</span>
              </label>
              <Input
                id="petty-cash-date"
                name="entryDate"
                type="date"
                required
                disabled={pending}
                value={entryDate}
                onChange={(event) => setEntryDate(event.target.value)}
                className={employeeInputClass}
              />
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label
                htmlFor="petty-cash-description"
                className={employeeDialogLabelClass}
              >
                {t("pages.pettyCash.descriptionLabel")}
                <span className="text-red-400"> *</span>
              </label>
              <Textarea
                id="petty-cash-description"
                name="description"
                required
                disabled={pending}
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("pages.pettyCash.descriptionPlaceholder")}
                className="min-h-[4.5rem] rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text shadow-none placeholder:text-subtle focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/10"
              />
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <label className={employeeDialogLabelClass}>
                {t("pages.pettyCash.billIsFor")}
                <span className="text-red-400"> *</span>
              </label>
              <Select
                value={employeeId || undefined}
                onValueChange={(value) => setEmployeeId(value ?? "")}
                disabled={pending}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue
                    placeholder={t("pages.pettyCash.billIsForPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {billForEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={employeeDialogHintClass}>
                {t("pages.pettyCash.billIsForHint")}
              </p>
            </div>

            <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
              <p className={employeeDialogLabelClass}>
                {t("pages.pettyCash.chargeType")}
                <span className="text-red-400"> *</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <DirectoryFilterTab
                  size="sm"
                  active={chargeType === "client"}
                  onClick={() => {
                    setChargeType("client");
                    setProjectId("");
                  }}
                >
                  {t("pages.pettyCash.chargeTypeClient")}
                </DirectoryFilterTab>
                <DirectoryFilterTab
                  size="sm"
                  active={chargeType === "project"}
                  onClick={() => {
                    setChargeType("project");
                    setClientId("");
                  }}
                >
                  {t("pages.pettyCash.chargeTypeProject")}
                </DirectoryFilterTab>
              </div>
            </div>

            {chargeType === "client" ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.pettyCash.client")}
                  <span className="text-red-400"> *</span>
                </label>
                <SearchableClientSelect
                  value={clientId}
                  onValueChange={setClientId}
                  clients={clients}
                  placeholder={t("pages.pettyCash.clientPlaceholder")}
                  disabled={pending}
                  required
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.pettyCash.clientHint")}
                </p>
              </div>
            ) : null}

            {chargeType === "project" ? (
              <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                <label className={employeeDialogLabelClass}>
                  {t("pages.pettyCash.project")}
                  <span className="text-red-400"> *</span>
                </label>
                <SearchableProjectSelect
                  value={projectId}
                  onValueChange={setProjectId}
                  projects={projects}
                  placeholder={t("pages.pettyCash.projectPlaceholder")}
                  disabled={pending}
                  required
                />
                <p className={employeeDialogHintClass}>
                  {t("pages.pettyCash.projectHint")}
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="sm:col-span-2 text-sm text-danger">{error}</p>
            ) : null}
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
