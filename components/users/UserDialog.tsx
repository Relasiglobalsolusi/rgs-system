"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { KeyRound, UserPlus } from "lucide-react";

import { createUser, resetUserAccount, updateUser } from "@/app/users/actions";
import AdminPasswordDisplay from "@/components/users/AdminPasswordDisplay";
import UserPermanentlyRemovePortalLoginDialog from "@/components/users/UserPermanentlyRemovePortalLoginDialog";
import UserRevokeLoginAccessDialog from "@/components/users/UserRevokeLoginAccessDialog";
import UserSoftDeleteDialog from "@/components/users/UserSoftDeleteDialog";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeUnsavedExitDialog,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogGridClass,
  employeeInputClass,
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
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type EditUser = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  active: boolean;
  /** Present only when the viewer may see recoverable passwords. */
  passwordDisplay?: string | null;
  employee: {
    id: string;
    employeeNo: string;
    firstName: string;
    lastName: string;
    category?: { name: string; prefix: string } | null;
  } | null;
  client: { id: string; name: string } | null;
  vendor: { id: string; name: string } | null;
};

type CreateProps = {
  mode: "create";
} & DirectoryDialogControlProps;

type EditProps = {
  mode: "edit";
  user: EditUser;
  showDelete?: boolean;
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;
  /** When true, Revoke Access / Permanently Remove are disabled (e.g. current user). */
  revokeDisabled?: boolean;
  revokeDisabledReason?: string;
} & DirectoryDialogControlProps;

type Props = CreateProps | EditProps;

function formatEmployeeLinkLabel(employee: NonNullable<EditUser["employee"]>): string {
  const name = `${employee.firstName} ${employee.lastName}`.trim();
  if (employee.category?.name) {
    return `${employee.category.name} — ${name}`;
  }
  return `${employee.employeeNo} — ${name}`;
}

function linkedRecordLabel(user: EditUser): string | null {
  if (user.employee) {
    return `Linked employee: ${formatEmployeeLinkLabel(user.employee)}`;
  }
  if (user.client) {
    return `Linked client: ${user.client.name}`;
  }
  if (user.vendor) {
    return `Linked vendor: ${user.vendor.name}`;
  }
  return null;
}

export default function UserDialog(props: Props) {
  const { t } = useT();
  const isEdit = props.mode === "edit";
  const showTrigger = props.showTrigger ?? true;
  const { open, setOpen } = useDirectoryDialogOpen(
    props.open,
    props.onOpenChange
  );
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removePortalLoginOpen, setRemovePortalLoginOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resetPending, startResetTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const [active, setActive] = useState(isEdit ? props.user.active : true);

  const formId = isEdit ? `edit-user-form-${props.user.id}` : "create-user-form";
  const linkLabel = isEdit ? linkedRecordLabel(props.user) : null;

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
    if (isEdit) {
      setActive(props.user.active);
      resetDirtyTracking();
      return;
    }

    setActive(true);
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

    const frame = requestAnimationFrame(() => {
      setBaseline(
        captureHtmlFormBaseline(formId, controlledSignatureRef.current)
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [open, formId]);

  async function submit(formData: FormData) {
    if (isEdit) {
      formData.set("active", String(active));
    }

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateUser(props.user.id, formData);
        } else {
          await createUser(formData);
        }
        setExitConfirmOpen(false);
        setOpen(false);
        setBaseline(null);
      } catch (error) {
        showRejectionFromError(error, "Failed to save user account.");
      }
    });
  }

  function handleResetAccount() {
    if (!isEdit) return;

    const confirmed = window.confirm(
      `Reset account for "${props.user.username}"?\n\nThis clears the recovery email and password. The user must complete first-login setup again (set password + recovery email). Employee/client links are kept.`
    );
    if (!confirmed) return;

    startResetTransition(async () => {
      try {
        await resetUserAccount(props.user.id);
        setExitConfirmOpen(false);
        setOpen(false);
        setBaseline(null);
      } catch (error) {
        showRejectionFromError(error, "Failed to reset user account.");
      }
    });
  }

  const busy = pending || resetPending;
  const canSubmit = !busy;
  const showDelete =
    isEdit && props.mode === "edit" ? (props.showDelete ?? false) : false;
  const deleteDisabled =
    isEdit && props.mode === "edit" ? (props.deleteDisabled ?? false) : false;
  const deleteDisabledReason =
    isEdit && props.mode === "edit" ? props.deleteDisabledReason : undefined;
  /** Same eligibility as Revoke Access: active client/vendor/employee-linked login. */
  const showLinkedLoginActions =
    isEdit &&
    props.mode === "edit" &&
    props.user.active &&
    Boolean(props.user.employee || props.user.client || props.user.vendor);
  const showRevoke = showLinkedLoginActions;
  const showRemovePortalLogin = showLinkedLoginActions;
  const revokeDisabled =
    isEdit && props.mode === "edit"
      ? (props.revokeDisabled ?? props.deleteDisabled ?? false)
      : false;
  const revokeDisabledReason =
    isEdit && props.mode === "edit"
      ? (props.revokeDisabledReason ??
        props.deleteDisabledReason ??
        undefined)
      : undefined;
  const removePortalLoginDisabled = revokeDisabled;
  const removePortalLoginDisabledReason =
    isEdit && props.mode === "edit" && revokeDisabled
      ? (props.revokeDisabledReason ??
        props.deleteDisabledReason ??
        "You cannot permanently remove portal login access for your own account")
      : undefined;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        disablePointerDismissal
      >
        {showTrigger ? (
          <DialogTrigger asChild>
            {isEdit ? (
              <Button variant="infoBadge" size="badge">
                {t("common.actions.edit")}
              </Button>
            ) : (
              <Button variant="successBadge" size="badge">
                {t("pages.users.addUser")}
              </Button>
            )}
          </DialogTrigger>
        ) : null}

        <EmployeeDialogShell
          icon={isEdit ? KeyRound : UserPlus}
          title={
            isEdit ? t("pages.users.editUser") : t("pages.users.createUser")
          }
          description={t("pages.users.description")}
          maxWidth="lg"
          footer={
            <div className="flex w-full flex-col gap-3">
              {showRemovePortalLogin ? (
                <EmployeePrimaryButton
                  type="button"
                  variant="danger"
                  disabled={busy || removePortalLoginDisabled}
                  className="font-bold whitespace-normal text-center leading-snug"
                  title={removePortalLoginDisabledReason}
                  onClick={() => setRemovePortalLoginOpen(true)}
                >
                  {t("pages.users.permanentlyRemoveLogin1")}{" "}
                  {t("pages.users.permanentlyRemoveLogin2")}
                </EmployeePrimaryButton>
              ) : null}
              {showRevoke ? (
                <EmployeePrimaryButton
                  type="button"
                  variant="danger"
                  disabled={busy || revokeDisabled}
                  className="font-bold"
                  title={revokeDisabledReason}
                  onClick={() => setRevokeOpen(true)}
                >
                  {t("pages.users.revokeAccess")}
                </EmployeePrimaryButton>
              ) : null}
              {showDelete ? (
                <EmployeePrimaryButton
                  type="button"
                  variant="danger"
                  disabled={busy || deleteDisabled}
                  className="font-bold"
                  title={deleteDisabledReason}
                  onClick={() => setDeleteOpen(true)}
                >
                  {t("common.actions.delete")}
                </EmployeePrimaryButton>
              ) : null}
              <EmployeePrimaryButton
                form={formId}
                disabled={!canSubmit}
                className="font-bold"
              >
                {pending
                  ? t("common.actions.saving")
                  : isEdit
                    ? t("common.actions.saveChanges")
                    : t("pages.users.createUser")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <form
            id={formId}
            key={`${formId}-${open ? "open" : "closed"}`}
            action={submit}
            onInput={handleFormInput}
          >
            <div className={employeeDialogFormClass}>
              <div className={employeeDialogGridClass}>
                <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                  <label
                    htmlFor="user-name"
                    className="text-sm font-medium text-text"
                  >
                    {t("pages.users.form.displayName")}
                  </label>
                  <Input
                    id="user-name"
                    name="name"
                    placeholder={t("pages.users.form.displayNamePlaceholder")}
                    defaultValue={isEdit ? props.user.name : ""}
                    required
                    className={employeeInputClass}
                  />
                </div>

                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor="user-username"
                    className="text-sm font-medium text-text"
                  >
                    {t("pages.users.form.username")}
                  </label>
                  <Input
                    id="user-username"
                    name="username"
                    placeholder={t("pages.users.form.usernamePlaceholder")}
                    defaultValue={isEdit ? props.user.username : ""}
                    required
                    minLength={3}
                    maxLength={32}
                    autoComplete="off"
                    className={employeeInputClass}
                  />
                </div>

                <div className={employeeDialogFieldClass}>
                  <label
                    htmlFor="user-email"
                    className="text-sm font-medium text-text"
                  >
                    {t("pages.users.form.recoveryEmail")}
                  </label>
                  <Input
                    id="user-email"
                    name="email"
                    type="email"
                    placeholder={t("pages.users.form.recoveryEmailPlaceholder")}
                    defaultValue={isEdit ? (props.user.email ?? "") : ""}
                    required
                    className={employeeInputClass}
                  />
                </div>

                <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                  <label
                    htmlFor="user-password"
                    className="text-sm font-medium text-text"
                  >
                    {isEdit
                      ? t("pages.users.form.newPassword")
                      : t("pages.users.form.temporaryPassword")}
                  </label>
                  <p className="text-xs text-muted">
                    {isEdit
                      ? t("pages.users.form.passwordKeepHint")
                      : t("pages.users.form.passwordCreateHint")}
                  </p>
                  <Input
                    id="user-password"
                    name="password"
                    type="password"
                    placeholder={
                      isEdit
                        ? t("pages.users.form.newPasswordPlaceholder")
                        : t("pages.users.form.tempPasswordPlaceholder")
                    }
                    minLength={6}
                    autoComplete="new-password"
                    className={employeeInputClass}
                  />
                </div>

                {isEdit && props.user.passwordDisplay !== undefined ? (
                  <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                    <p className="text-sm font-medium text-text">
                      {t("pages.users.form.currentPassword")}
                    </p>
                    <p className="text-xs text-muted">
                      {t("pages.users.form.currentPasswordHint")}
                    </p>
                    <div className="rounded-lg border border-border bg-elevated px-3 py-2.5">
                      <AdminPasswordDisplay
                        password={props.user.passwordDisplay}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {isEdit && (
                <div className="rounded-xl border border-border bg-elevated p-4">
                  <h3 className="text-sm font-semibold text-text">
                    {t("pages.users.form.accountLink")}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {linkLabel ?? t("pages.users.form.unlinkedAdmin")}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {t("pages.users.form.accountLinkHint")}
                  </p>
                </div>
              )}

              {isEdit && (
                <div className="border-t border-border pt-4">
                  <label className="flex items-center gap-3 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(event) => setActive(event.target.checked)}
                      className="rounded border-border bg-elevated"
                    />
                    {t("pages.users.form.activeLogin")}
                  </label>
                </div>
              )}

              {isEdit && (
                <div className="space-y-3 rounded-xl border border-red-500/25 bg-card-tint-red p-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-danger">
                      {t("pages.users.form.resetAccount")}
                    </h3>
                    <p className="text-xs text-muted">
                      {t("pages.users.form.resetAccountHint")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructiveBadge"
                    size="badge"
                    disabled={busy}
                    onClick={handleResetAccount}
                    className="!w-auto !min-w-[7.5rem] !max-w-none px-3"
                  >
                    {resetPending
                      ? t("common.actions.processing")
                      : t("pages.users.form.resetAccount")}
                  </Button>
                </div>
              )}
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

      {showRemovePortalLogin && isEdit ? (
        <UserPermanentlyRemovePortalLoginDialog
          user={{
            id: props.user.id,
            name: props.user.name,
            username: props.user.username,
          }}
          linkedLabel={linkLabel ?? "Linked account"}
          disabled={removePortalLoginDisabled}
          disabledReason={removePortalLoginDisabledReason}
          open={removePortalLoginOpen}
          onOpenChange={setRemovePortalLoginOpen}
          onRemoved={closeDialog}
        />
      ) : null}

      {showRevoke && isEdit ? (
        <UserRevokeLoginAccessDialog
          user={{
            id: props.user.id,
            name: props.user.name,
            username: props.user.username,
          }}
          linkedLabel={linkLabel ?? "Linked account"}
          disabled={revokeDisabled}
          disabledReason={revokeDisabledReason}
          open={revokeOpen}
          onOpenChange={setRevokeOpen}
          onRevoked={closeDialog}
        />
      ) : null}

      {showDelete && isEdit ? (
        <UserSoftDeleteDialog
          user={{
            id: props.user.id,
            name: props.user.name,
            username: props.user.username,
          }}
          disabled={deleteDisabled}
          disabledReason={deleteDisabledReason}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          showTrigger={false}
          onDeleted={closeDialog}
        />
      ) : null}
    </>
  );
}
