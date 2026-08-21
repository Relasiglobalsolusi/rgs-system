"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

import {
  resetUserAccount,
  updateUser,
  type ResetUserAccountResult,
} from "@/app/users/actions";
import AdminPasswordDisplay from "@/components/users/AdminPasswordDisplay";
import StatusBadge from "@/components/ui/StatusBadge";
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
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import {
  getAdminPasswordDisplayState,
  isLinkedPortalLogin,
} from "@/lib/user-account";
import { cn } from "@/lib/utils";

type EditUser = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  active: boolean;
  /** Present only when the viewer may see recoverable passwords. */
  passwordDisplay?: string | null;
  recoverableStoredAtRest?: boolean;
  decryptFailed?: boolean;
  mustSetPassword?: boolean;
  passwordSetupCompletedAt?: Date | string | null;
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

type Props = {
  user: EditUser;
  showDelete?: boolean;
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;
  /** When true, Revoke Access / Permanently Remove are disabled (e.g. current user). */
  revokeDisabled?: boolean;
  revokeDisabledReason?: string;
  /** Managers may rename Login ID / username. */
  canEditUsername?: boolean;
} & DirectoryDialogControlProps;

function formatEmployeeLinkLabel(
  employee: NonNullable<EditUser["employee"]>,
  locale: AppLocale
): string {
  const name = `${employee.firstName} ${employee.lastName}`.trim();
  if (employee.category?.name) {
    return `${localizeDepartmentLabel(null, employee.category.name, locale)} — ${name}`;
  }
  return `${employee.employeeNo} — ${name}`;
}

export default function UserDialog(props: Props) {
  const { t, locale } = useT();
  const router = useRouter();
  const showTrigger = props.showTrigger ?? true;
  const canEditUsername = props.canEditUsername ?? true;
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
  const [accountOverride, setAccountOverride] =
    useState<Partial<EditUser> | null>(null);
  const [formRevision, setFormRevision] = useState(0);

  const formId = `edit-user-form-${props.user.id}`;
  const linkLabel = props.user.employee
    ? t("pages.users.linkedEmployee", {
        label: formatEmployeeLinkLabel(props.user.employee, locale),
      })
    : props.user.client
      ? t("pages.users.linkedClient", { name: props.user.client.name })
      : props.user.vendor
        ? t("pages.users.linkedVendor", { name: props.user.vendor.name })
        : null;

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    formId,
    "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetFormState() {
    resetDirtyTracking();
    setAccountOverride(null);
    setFormRevision(0);
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
      setBaseline(captureHtmlFormBaseline(formId, ""));
    });

    return () => cancelAnimationFrame(frame);
  }, [open, formId, formRevision]);

  async function submit(formData: FormData) {
    // Login active/revoked is controlled only via Revoke Access / Restore Access.
    formData.delete("active");

    if (!canEditUsername) {
      formData.set("username", props.user.username);
    }

    startTransition(async () => {
      try {
        await updateUser(props.user.id, formData);
        setExitConfirmOpen(false);
        setOpen(false);
        setBaseline(null);
      } catch (error) {
        showRejectionFromError(error, t("pages.users.errors.saveFailed"));
      }
    });
  }

  function applyResetResult(result: ResetUserAccountResult) {
    setAccountOverride({
      passwordDisplay: result.passwordDisplay,
      recoverableStoredAtRest: false,
      decryptFailed: false,
      email: result.email,
      mustSetPassword: result.mustSetPassword,
      passwordSetupCompletedAt: result.passwordSetupCompletedAt,
    });
    setFormRevision((current) => current + 1);
    resetDirtyTracking();
    setBaseline(null);
  }

  function handleResetAccount() {
    const confirmed = window.confirm(
      t("pages.users.form.resetAccountConfirm", {
        username: props.user.username,
      })
    );
    if (!confirmed) return;

    startResetTransition(async () => {
      try {
        const result = await resetUserAccount(props.user.id);
        applyResetResult(result);
        setExitConfirmOpen(false);
        router.refresh();
      } catch (error) {
        showRejectionFromError(error, t("pages.users.errors.resetFailed"));
      }
    });
  }

  const busy = pending || resetPending;
  const canSubmit = !busy;
  const showDelete = props.showDelete ?? false;
  const deleteDisabled = props.deleteDisabled ?? false;
  const deleteDisabledReason = props.deleteDisabledReason;
  /** Same eligibility as Revoke Access: active client/vendor/employee-linked login. */
  const showLinkedLoginActions =
    props.user.active &&
    Boolean(props.user.employee || props.user.client || props.user.vendor);
  const showRevoke = showLinkedLoginActions;
  const showRemovePortalLogin = showLinkedLoginActions;
  const revokeDisabled = props.revokeDisabled ?? props.deleteDisabled ?? false;
  const revokeDisabledReason =
    props.revokeDisabledReason ?? props.deleteDisabledReason ?? undefined;
  const removePortalLoginDisabled = revokeDisabled;
  const removePortalLoginDisabledReason = revokeDisabled
    ? (props.revokeDisabledReason ??
      props.deleteDisabledReason ??
      t("pages.users.cannotRemovePortalOwn"))
    : undefined;

  const editUser = { ...props.user, ...accountOverride };
  const passwordSetupContext =
    editUser && editUser.passwordDisplay !== undefined
      ? {
          mustSetPassword: editUser.mustSetPassword,
          email: editUser.email,
          passwordSetupCompletedAt: editUser.passwordSetupCompletedAt,
          isLinkedPortalLogin: isLinkedPortalLogin(editUser),
        }
      : undefined;
  const passwordDisplayState =
    editUser && passwordSetupContext
      ? getAdminPasswordDisplayState({
          passwordDisplay: editUser.passwordDisplay,
          recoverableStoredAtRest: editUser.recoverableStoredAtRest,
          decryptFailed: editUser.decryptFailed,
          ...passwordSetupContext,
          passwordSetupCompletedAt: passwordSetupContext.passwordSetupCompletedAt
            ? new Date(passwordSetupContext.passwordSetupCompletedAt)
            : null,
        })
      : null;
  const firstLoginComplete = passwordDisplayState !== "pending";

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
          icon={KeyRound}
          title={t("pages.users.editUser")}
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
                  : t("common.actions.saveChanges")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <form
            id={formId}
            key={`${formId}-${open ? "open" : "closed"}-${formRevision}`}
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
                    defaultValue={editUser.name}
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
                  <p className="text-xs text-muted">
                    {canEditUsername
                      ? t("pages.users.form.usernameHint")
                      : t("pages.users.form.usernameReadOnlyHint")}
                  </p>
                  <Input
                    id="user-username"
                    name="username"
                    placeholder={t("pages.users.form.usernamePlaceholder")}
                    defaultValue={editUser.username}
                    required
                    minLength={3}
                    maxLength={32}
                    autoComplete="off"
                    readOnly={!canEditUsername}
                    className={cn(
                      employeeInputClass,
                      !canEditUsername && "cursor-not-allowed opacity-80"
                    )}
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
                    defaultValue={editUser.email ?? ""}
                    required
                    className={employeeInputClass}
                  />
                </div>

                {editUser.passwordDisplay !== undefined ? (
                  <div className={cn(employeeDialogFieldClass, "sm:col-span-2")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-text">
                        {t("pages.users.form.currentPassword")}
                      </p>
                      {passwordDisplayState ? (
                        <StatusBadge
                          status={firstLoginComplete ? "success" : "pending"}
                          compact
                        >
                          {firstLoginComplete
                            ? t("pages.users.firstLoginComplete")
                            : t("pages.users.firstLoginPending")}
                        </StatusBadge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted">
                      {t("pages.users.form.currentPasswordHint")}
                    </p>
                    <div className="rounded-lg border border-border bg-elevated px-3 py-2.5">
                      <AdminPasswordDisplay
                        key={editUser.passwordDisplay ?? "none"}
                        password={editUser.passwordDisplay}
                        recoverableStoredAtRest={editUser.recoverableStoredAtRest}
                        decryptFailed={editUser.decryptFailed}
                        setup={passwordSetupContext}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

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

      {showRemovePortalLogin ? (
        <UserPermanentlyRemovePortalLoginDialog
          user={{
            id: props.user.id,
            name: props.user.name,
            username: props.user.username,
          }}
          linkedLabel={linkLabel ?? t("pages.users.linkedAccount")}
          disabled={removePortalLoginDisabled}
          disabledReason={removePortalLoginDisabledReason}
          open={removePortalLoginOpen}
          onOpenChange={setRemovePortalLoginOpen}
          onRemoved={closeDialog}
        />
      ) : null}

      {showRevoke ? (
        <UserRevokeLoginAccessDialog
          user={{
            id: props.user.id,
            name: props.user.name,
            username: props.user.username,
          }}
          linkedLabel={linkLabel ?? t("pages.users.linkedAccount")}
          disabled={revokeDisabled}
          disabledReason={revokeDisabledReason}
          open={revokeOpen}
          onOpenChange={setRevokeOpen}
          onRevoked={closeDialog}
        />
      ) : null}

      {showDelete ? (
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
