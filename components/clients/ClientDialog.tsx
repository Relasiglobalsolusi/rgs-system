"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { Briefcase } from "lucide-react";

import {
  createClient,
  previewClientShortCode,
} from "@/app/clients/actions";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  useDirectoryDialogOpen,
  type DirectoryDialogControlProps,
} from "@/components/ui/use-directory-dialog-open";
import { useT } from "@/lib/i18n/use-t";
import { isValidNpwp } from "@/lib/npwp";

const CREATE_FORM_ID = "create-client-form";

type Props = DirectoryDialogControlProps;

export default function ClientDialog({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [previewShortCode, setPreviewShortCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    CREATE_FORM_ID,
    "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function closeDialog() {
    setOpen(false);
    resetDirtyTracking();
    setBaseline(null);
    setPreviewShortCode("");
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => {
        setOpen(true);
        resetDirtyTracking();
        setPreviewShortCode("");
      },
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  useEffect(() => {
    if (!open) {
      setBaseline(null);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(CREATE_FORM_ID, ""));
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    previewClientShortCode()
      .then((shortCode) => {
        if (!cancelled) {
          setPreviewShortCode(shortCode);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewShortCode("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function submit(formData: FormData) {
    const npwpRaw = String(formData.get("npwp") ?? "").trim();
    if (npwpRaw && !isValidNpwp(npwpRaw)) {
      const isIndividual =
        String(formData.get("clientType") ?? "").toUpperCase() ===
        "INDIVIDUAL";
      const npwpMessage = isIndividual
        ? t("validation.npwpOrNikInvalid")
        : t("validation.npwpInvalid");
      const form = document.getElementById(CREATE_FORM_ID);
      const input = form instanceof HTMLFormElement
        ? form.elements.namedItem("npwp")
        : null;
      if (input instanceof HTMLInputElement) {
        input.setCustomValidity(npwpMessage);
        input.reportValidity();
      } else {
        showRejection({ reasons: npwpMessage });
      }
      return;
    }

    startTransition(async () => {
      try {
        await createClient(formData);
        setExitConfirmOpen(false);
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, "Failed to create client.");
      }
    });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        disablePointerDismissal
      >
        {showTrigger ? (
          <DialogTrigger asChild>
            <Button variant="successBadge" size="badge">
              {t("pages.clients.addClient")}
            </Button>
          </DialogTrigger>
        ) : null}

        <EmployeeDialogShell
          icon={Briefcase}
          title={t("pages.clients.addClient")}
          description={t("pages.clients.descriptionAdmin")}
          maxWidth="lg"
          footer={
            <EmployeePrimaryButton form={CREATE_FORM_ID} disabled={pending}>
              {pending
                ? t("common.actions.adding")
                : t("pages.clients.addClient")}
            </EmployeePrimaryButton>
          }
        >
          <form
            id={CREATE_FORM_ID}
            action={submit}
            onInput={handleFormInput}
          >
            <ClientFormFields
              mode="create"
              previewShortCode={previewShortCode}
              onFormValuesChange={handleFormInput}
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
