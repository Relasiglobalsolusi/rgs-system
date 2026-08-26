"use client";

import {
  showMissingRequiredFields,
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { Briefcase } from "lucide-react";

import { createClientsInBulk } from "@/app/clients/actions";
import BulkLineList from "@/components/bulk-create/BulkLineList";
import ClientFormFields from "@/components/clients/ClientFormFields";
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
import { useT } from "@/lib/i18n/use-t";
import { isValidNpwp } from "@/lib/npwp";

const FORM_ID = "bulk-create-client-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ClientBulkCreateDialog({
  open: controlledOpen,
  onOpenChange,
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
      const isIndividual =
        String(formData.get(bulkLineField(index, "clientType")) ?? "")
          .trim()
          .toUpperCase() === "INDIVIDUAL";
      const npwpInvalidMessage = isIndividual
        ? t("validation.npwpOrNikInvalid")
        : t("validation.npwpInvalid");
      const npwpRequiredMessage = isIndividual
        ? t("validation.npwpOrNikRequired")
        : t("validation.npwpRequired");
      const npwp = String(formData.get(bulkLineField(index, "npwp")) ?? "").trim();
      if (!npwp || !isValidNpwp(npwp)) {
        showRejection({
          reasons: t("bulkCreate.lineError", {
            n: String(index + 1),
            message: !npwp ? npwpRequiredMessage : npwpInvalidMessage,
          }),
        });
        return;
      }
    }

    startTransition(async () => {
      try {
        await createClientsInBulk(formData);
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.clients.createFailed"));
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
          icon={Briefcase}
          title={t("pages.clients.bulkCreateTitle")}
          description={t("pages.clients.bulkCreateDesc")}
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
              title={t("pages.clients.bulkCreateLines")}
              description={t("pages.clients.bulkCreateLinesHint")}
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
                <ClientFormFields
                  mode="create"
                  namePrefix={`line.${index}.`}
                  idPrefix={`bulk-client-${index}-`}
                  hideShortCode
                  hideLoginId
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
