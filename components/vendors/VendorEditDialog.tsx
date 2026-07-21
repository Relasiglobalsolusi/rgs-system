"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { contactPersonNamePartsChanged } from "@/lib/contact-person";
import { useT } from "@/lib/i18n/use-t";
import { isValidNpwp } from "@/lib/npwp";
import { capitalizeName } from "@/lib/text-case";

const PORTAL_LOGIN_RESET_CONFIRM =
  "Changing the contact person's name will reset the portal login for this vendor.\n\n" +
  "The current portal user will be permanently deleted and a new login will be created under the new contact name. " +
  "The new contact must set a password and recovery email on first login (existing credentials will no longer work).\n\n" +
  "Continue?";

type Vendor = {
  id: string;
  name: string;
  shortCode: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  npwp: string | null;
  contactPersonFirstName: string | null;
  contactPersonLastName: string | null;
  contactPersonPosition: string | null;
  contactPersonEmail: string | null;
  contactPersonPhone: string | null;
  vendorSince: Date | string;
  paymentTermsDays?: number | null;
  active: boolean;
  /** Linked portal users — any linked login means a name change resets it. */
  users?: Array<{ id: string; active?: boolean }>;
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
  const [active, setActive] = useState(vendor.active);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const controlledSignature = useMemo(
    () => JSON.stringify({ active }),
    [active]
  );
  const controlledSignatureRef = useRef(controlledSignature);
  controlledSignatureRef.current = controlledSignature;

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    formId,
    controlledSignature,
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetFormState() {
    setActive(vendor.active);
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
      setBaseline(
        captureHtmlFormBaseline(formId, controlledSignatureRef.current)
      );
    });

    return () => cancelAnimationFrame(frame);
    // Fresh mount / open — remount via key={vendor.id} from VendorTable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formId, vendor.id]);

  function vendorHasLinkedPortalLogin() {
    return (vendor.users?.length ?? 0) > 0;
  }

  async function submit(formData: FormData) {
    formData.set("active", String(active));

    const npwpRaw = String(formData.get("npwp") ?? "").trim();
    if (npwpRaw && !isValidNpwp(npwpRaw)) {
      const form = document.getElementById(formId);
      const input =
        form instanceof HTMLFormElement
          ? form.elements.namedItem("npwp")
          : null;
      if (input instanceof HTMLInputElement) {
        input.setCustomValidity(t("validation.npwpInvalid"));
        input.reportValidity();
      } else {
        showRejection({ reasons: t("validation.npwpInvalid") });
      }
      return;
    }

    const nextFirstName = capitalizeName(
      String(formData.get("contactPersonFirstName") ?? "").trim()
    );
    const nextLastName = capitalizeName(
      String(formData.get("contactPersonLastName") ?? "").trim()
    );
    const nameChanged = contactPersonNamePartsChanged(
      {
        firstName: vendor.contactPersonFirstName,
        lastName: vendor.contactPersonLastName,
      },
      {
        firstName: nextFirstName,
        lastName: nextLastName || null,
      }
    );

    // Mirror server: reset only when contact name changes, a linked portal
    // login exists, and the vendor remains/becomes active after save.
    if (nameChanged && vendorHasLinkedPortalLogin() && active) {
      const confirmed = window.confirm(PORTAL_LOGIN_RESET_CONFIRM);
      if (!confirmed) {
        return;
      }
    }

    startTransition(async () => {
      try {
        const result = await updateVendor(vendor.id, formData);
        if (result.portalLoginReset) {
          toast.success(
            "Vendor saved. Portal login was reset — the new contact must set password and recovery email on first login."
          );
        }
        setExitConfirmOpen(false);
        setOpen(false);
        setBaseline(null);
      } catch (error) {
        showRejectionFromError(error, "Failed to update vendor.");
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

            <div className="mt-8 border-t border-border pt-6">
              <label className="flex items-center gap-3 text-sm text-text">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                  className="rounded border-border bg-elevated"
                />
                {t("pages.vendors.activeOrganization")}
              </label>
            </div>
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
