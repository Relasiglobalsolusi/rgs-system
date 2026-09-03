"use client";

import {
  showMissingRequiredFields,
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { FolderKanban } from "lucide-react";

import { createProjectsInBulk } from "@/app/projects/actions";
import BulkLineList from "@/components/bulk-create/BulkLineList";
import ProjectFormFields, {
  type ProjectFormClient,
} from "@/components/projects/ProjectFormFields";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import type { ProjectTeamOption } from "@/components/projects/ProjectTeamPicker";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeUnsavedExitDialog,
  handleEmployeeDialogOpenChange,
  useHtmlFormDirty,
  type HtmlFormDirtyBaseline,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { bulkLineField, createBulkLineKey } from "@/lib/bulk-create";
import {
  commercialTaxRequiresRatePercent,
  isCommercialTaxKind,
} from "@/lib/commercial-tax";
import { useT } from "@/lib/i18n/use-t";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import type { ProjectCatalogAreaDTO } from "@/lib/project-service-catalog";

const FORM_ID = "bulk-create-project-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: ProjectStaffEmployee[];
  teams?: ProjectTeamOption[];
  clients: ProjectFormClient[];
  catalog?: ProjectCatalogAreaDTO[];
  bankAccounts?: CompanyBankAccountOption[];
  showCatchUpIntake?: boolean;
};

export default function ProjectBulkCreateDialog({
  open: controlledOpen,
  onOpenChange,
  employees,
  teams = [],
  clients,
  catalog = [],
  bankAccounts = [],
  showCatchUpIntake = true,
}: Props) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [lineKeys, setLineKeys] = useState<string[]>(() => [createBulkLineKey()]);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    FORM_ID,
    "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetForm() {
    resetDirtyTracking();
    setBaseline(null);
    setLineKeys([createBulkLineKey()]);
  }

  function closeDialog() {
    onOpenChange(false);
    resetForm();
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => {
        onOpenChange(true);
        resetForm();
      },
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  useEffect(() => {
    if (!controlledOpen) {
      setBaseline(null);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(FORM_ID, ""));
    });
    return () => cancelAnimationFrame(frame);
  }, [controlledOpen]);

  function submit(formData: FormData) {
    const form = document.getElementById(FORM_ID);
    if (
      showMissingRequiredFields(
        form instanceof HTMLFormElement ? form : null
      )
    ) {
      return;
    }
    for (let index = 0; index < lineKeys.length; index += 1) {
      const name = String(formData.get(bulkLineField(index, "name")) ?? "").trim();
      const clientId = String(
        formData.get(bulkLineField(index, "clientId")) ?? ""
      ).trim();
      const initialStatus = String(
        formData.get(bulkLineField(index, "initialStatus")) ?? ""
      ).trim();
      if (!name) {
        showRejection({
          reasons: t("bulkCreate.lineError", {
            n: String(index + 1),
            message: t("pages.projects.projectName"),
          }),
        });
        return;
      }
      if (!clientId) {
        showRejection({
          reasons: t("bulkCreate.lineError", {
            n: String(index + 1),
            message: t("pages.projects.selectClient"),
          }),
        });
        return;
      }
      const isComplimentary =
        String(formData.get(bulkLineField(index, "isComplimentary")) ?? "") ===
        "true";
      const chargedTaxKind = String(
        formData.get(bulkLineField(index, "chargedTaxKind")) ?? ""
      ).trim();
      const resolvedTaxKind = isCommercialTaxKind(chargedTaxKind)
        ? chargedTaxKind
        : null;
      if (!isComplimentary && !resolvedTaxKind) {
        showRejection({
          reasons: t("bulkCreate.lineError", {
            n: String(index + 1),
            message: t("pages.projects.chargedTaxKindRequired"),
          }),
        });
        return;
      }
      if (
        !isComplimentary &&
        resolvedTaxKind === "OTHER" &&
        !String(formData.get(bulkLineField(index, "otherTaxName")) ?? "").trim()
      ) {
        showRejection({
          reasons: t("bulkCreate.lineError", {
            n: String(index + 1),
            message: t("pages.billing.otherTaxNameRequired"),
          }),
        });
        return;
      }
      if (
        !isComplimentary &&
        resolvedTaxKind &&
        commercialTaxRequiresRatePercent(resolvedTaxKind) &&
        !String(formData.get(bulkLineField(index, "pphRatePercent")) ?? "").trim()
      ) {
        showRejection({
          reasons: t("bulkCreate.lineError", {
            n: String(index + 1),
            message:
              resolvedTaxKind === "OTHER"
                ? t("pages.billing.otherTaxRateRequired")
                : t("pages.projects.pphRatePercentRequired"),
          }),
        });
        return;
      }
      if (initialStatus === "IN_PROGRESS" || isComplimentary || String(formData.get(bulkLineField(index, "isDemo")) ?? "") === "true") {
        const proof = formData.get(bulkLineField(index, "contractProof"));
        if (!(proof instanceof File) || proof.size === 0) {
          showRejection({
            reasons: t("bulkCreate.lineError", {
              n: String(index + 1),
              message: t("pages.projects.contractProofHint"),
            }),
          });
          return;
        }
      }
    }

    startTransition(async () => {
      try {
        await createProjectsInBulk(formData);
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.finish.createFailed"));
      }
    });
  }

  return (
    <>
      <Dialog
        open={controlledOpen}
        onOpenChange={handleOpenChange}
        disablePointerDismissal
      >
        <EmployeeDialogShell
          icon={FolderKanban}
          title={t("pages.projects.bulkCreateTitle")}
          description={t("pages.projects.bulkCreateDesc")}
          maxWidth="lg"
          footer={
            <EmployeePrimaryButton form={FORM_ID} disabled={pending}>
              {pending
                ? t("bulkCreate.addingCount", { count: String(lineKeys.length) })
                : t("bulkCreate.addCount", { count: String(lineKeys.length) })}
            </EmployeePrimaryButton>
          }
        >
          <form
            id={FORM_ID}
            action={submit}
            noValidate
            onInput={handleFormInput}
          >
            <input type="hidden" name="lineCount" value={lineKeys.length} />
            <BulkLineList
              title={t("pages.projects.bulkCreateLines")}
              description={t("pages.projects.bulkCreateLinesHint")}
              lineKeys={lineKeys}
              onAdd={(count) =>
                setLineKeys((current) => [
                  ...current,
                  ...Array.from({ length: count }, () => createBulkLineKey()),
                ])
              }
              onRemove={(index) =>
                setLineKeys((current) =>
                  current.length <= 1
                    ? current
                    : current.filter((_, itemIndex) => itemIndex !== index)
                )
              }
              renderLine={(index) => (
                <ProjectFormFields
                  employees={employees}
                  teams={teams}
                  clients={clients}
                  catalog={catalog}
                  bankAccounts={bankAccounts}
                  showCatchUpIntake={showCatchUpIntake}
                  namePrefix={`line.${index}.`}
                  idPrefix={`bulk-project-${index}-`}
                  onFormValuesChange={handleFormInput}
                />
              )}
            />
          </form>
        </EmployeeDialogShell>
      </Dialog>
      <EmployeeUnsavedExitDialog
        open={exitConfirmOpen}
        onConfirm={() => {
          setExitConfirmOpen(false);
          closeDialog();
        }}
        onCancel={() => setExitConfirmOpen(false)}
      />
    </>
  );
}
