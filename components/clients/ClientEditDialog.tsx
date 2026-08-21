"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
import { toast } from "sonner";

import { updateClient } from "@/app/clients/actions";
import ClientDeleteDialog from "@/components/clients/ClientDeleteDialog";
import ClientFormFields from "@/components/clients/ClientFormFields";
import ClientMultiProjectPanel from "@/components/clients/ClientMultiProjectPanel";
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

type Client = {
  id: string;
  name: string;
  shortCode: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  npwp: string | null;
  taxIdDocumentUrl?: string | null;
  contactPersonFirstName: string | null;
  contactPersonLastName: string | null;
  contactPersonPosition: string | null;
  contactPersonEmail: string | null;
  contactPersonPhone: string | null;
  clientType?: "COMPANY" | "INDIVIDUAL";
  clientSince: Date | string;
  paymentTermsDays?: number | null;
  active: boolean;
  _count?: { projects: number; users: number };
};

type Props = {
  client: Client;
  showDelete?: boolean;
} & DirectoryDialogControlProps;

export default function ClientEditDialog({
  client,
  showDelete = false,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const router = useRouter();
  const formId = `edit-client-form-${client.id}`;
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    formId,
    "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetFormState() {
    resetDirtyTracking();
  }

  function closeDialog() {
    setOpen(false);
    resetFormState();
    setBaseline(null);
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => {
        setOpen(true);
        resetFormState();
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

    resetFormState();

    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(formId, ""));
    });

    return () => cancelAnimationFrame(frame);
    // Fresh mount / open — remount via key={client.id} from ClientTable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formId, client.id]);

  async function submit(formData: FormData) {
    const npwpRaw = String(formData.get("npwp") ?? "").trim();
    const isIndividual =
      String(formData.get("clientType") ?? "").toUpperCase() === "INDIVIDUAL";
    if (!npwpRaw || !isValidNpwp(npwpRaw)) {
      const npwpMessage = !npwpRaw
        ? isIndividual
          ? t("validation.npwpOrNikRequired")
          : t("validation.npwpRequired")
        : isIndividual
          ? t("validation.npwpOrNikInvalid")
          : t("validation.npwpInvalid");
      const form = document.getElementById(formId);
      const input =
        form instanceof HTMLFormElement
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
        await updateClient(client.id, formData);
        toast.success(t("pages.clients.savedToast"));
        setExitConfirmOpen(false);
        setOpen(false);
        setBaseline(null);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.clients.updateFailed"));
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
            <Button variant="infoBadge" size="badge">
              {t("common.actions.edit")}
            </Button>
          </DialogTrigger>
        ) : null}

        <EmployeeDialogShell
          icon={Briefcase}
          title={t("pages.clients.editClient")}
          description={t("pages.clients.editDescription")}
          maxWidth="lg"
          footer={
            <div className="flex w-full flex-col gap-3">
              {showDelete && client._count ? (
                <EmployeePrimaryButton
                  type="button"
                  variant="danger"
                  disabled={pending}
                  className="font-bold"
                  onClick={() => setDeleteOpen(true)}
                >
                  {t("common.actions.delete")}
                </EmployeePrimaryButton>
              ) : null}
              <EmployeePrimaryButton
                form={formId}
                disabled={pending}
                className="font-bold"
              >
                {pending
                  ? t("common.actions.saving")
                  : t("common.actions.saveChanges")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <form
            id={formId}
            key={`${client.id}-${open ? "open" : "closed"}`}
            action={submit}
            onInput={handleFormInput}
          >
            <ClientFormFields
              mode="edit"
              defaults={{
                name: client.name,
                shortCode: client.shortCode,
                email: client.email ?? "",
                phone: client.phone ?? "",
                address: client.address ?? "",
                npwp: client.npwp ?? "",
                taxIdDocumentUrl: client.taxIdDocumentUrl ?? null,
                clientSince: client.clientSince,
                contactPersonFirstName: client.contactPersonFirstName ?? "",
                contactPersonLastName: client.contactPersonLastName ?? "",
                contactPersonPosition: client.contactPersonPosition ?? "",
                contactPersonEmail: client.contactPersonEmail ?? "",
                contactPersonPhone: client.contactPersonPhone ?? "",
                clientType: client.clientType ?? "COMPANY",
              }}
              onFormValuesChange={handleFormInput}
            />
          </form>

          <div className="mt-8 border-t border-border pt-6">
            <ClientMultiProjectPanel
              clientId={client.id}
              open={open}
              formId={formId}
            />
          </div>
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

      {showDelete && client._count ? (
        <ClientDeleteDialog
          client={{
            id: client.id,
            name: client.name,
            _count: client._count,
          }}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          showTrigger={false}
          onDeleted={closeDialog}
        />
      ) : null}
    </>
  );
}
