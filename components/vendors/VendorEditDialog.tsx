"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { Truck } from "lucide-react";
import { toast } from "sonner";

import { updateVendor } from "@/app/vendors/actions";
import VendorDeleteDialog from "@/components/vendors/VendorDeleteDialog";
import VendorFormFields from "@/components/vendors/VendorFormFields";
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

type Vendor = {
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
  vendorSince: Date | string;
  paymentTermsDays?: number | null;
  active: boolean;
};

type Props = {
  vendor: Vendor;
  showDelete?: boolean;
} & DirectoryDialogControlProps;

export default function VendorEditDialog({
  vendor,
  showDelete = false,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const formId = `edit-vendor-form-${vendor.id}`;
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
    // Fresh mount / open — remount via key={vendor.id} from VendorTable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formId, vendor.id]);

  async function submit(formData: FormData) {
    const npwpRaw = String(formData.get("npwp") ?? "").trim();
    if (!npwpRaw || !isValidNpwp(npwpRaw)) {
      const npwpMessage = !npwpRaw
        ? t("validation.npwpRequired")
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
        await updateVendor(vendor.id, formData);
        toast.success(t("pages.vendors.savedToast"));
        setExitConfirmOpen(false);
        setOpen(false);
        setBaseline(null);
      } catch (error) {
        showRejectionFromError(error, t("pages.vendors.updateFailed"));
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
          icon={Truck}
          title={t("pages.vendors.editVendor")}
          description={t("pages.vendors.editDescription")}
          maxWidth="lg"
          footer={
            <div className="flex w-full flex-col gap-3">
              {showDelete ? (
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
            key={`${vendor.id}-${open ? "open" : "closed"}`}
            action={submit}
            onInput={handleFormInput}
          >
            <VendorFormFields
              mode="edit"
              defaults={{
                name: vendor.name,
                shortCode: vendor.shortCode,
                email: vendor.email ?? "",
                phone: vendor.phone ?? "",
                address: vendor.address ?? "",
                npwp: vendor.npwp ?? "",
                taxIdDocumentUrl: vendor.taxIdDocumentUrl ?? null,
                vendorSince: vendor.vendorSince,
                paymentTermsDays: vendor.paymentTermsDays,
                contactPersonFirstName: vendor.contactPersonFirstName ?? "",
                contactPersonLastName: vendor.contactPersonLastName ?? "",
                contactPersonPosition: vendor.contactPersonPosition ?? "",
                contactPersonEmail: vendor.contactPersonEmail ?? "",
                contactPersonPhone: vendor.contactPersonPhone ?? "",
              }}
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

      {showDelete ? (
        <VendorDeleteDialog
          vendor={{
            id: vendor.id,
            name: vendor.name,
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
