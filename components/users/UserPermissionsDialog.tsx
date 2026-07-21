"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useMemo, useState, useTransition } from "react";
import { RotateCcw, ShieldCheck } from "lucide-react";
import type {
  EmployeeType,
  EmploymentType,
  Placement,
  UserRole,
} from "@prisma/client";

import { updateUserModuleOverrides } from "@/app/users/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFormClass,
  employeeDialogGridClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { permissionsChipTextClassName } from "@/components/ui/trash-action-buttons";
import {
  useDirectoryDialogOpen,
  type DirectoryDialogControlProps,
} from "@/components/ui/use-directory-dialog-open";
import { useT } from "@/lib/i18n/use-t";
import {
  buildOverridesFromToggle,
  getAccountType,
  getAccountTypeBaselineModules,
  getAllModuleAccessStates,
  getEmployeeModuleOverrides,
  getVisibleModules,
  MODULE_LABELS,
  type ModuleKey,
  type PermissionUser,
} from "@/lib/permissions";

type UserForPermissions = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  moduleOverrides: Record<string, boolean> | null;
  clientId?: string | null;
  client?: { id: string; name?: string } | null;
  vendorId?: string | null;
  vendor?: { id: string; name?: string } | null;
  employee: {
    employeeNo: string;
    employeeType: EmployeeType;
    employmentType: EmploymentType;
    placement: Placement;
    jobPosition?: { id: string; name: string } | null;
  } | null;
};

type Props = {
  user: UserForPermissions;
} & DirectoryDialogControlProps;

function ModuleToggle({
  module,
  enabled,
  isOverridden,
  defaultValue,
  disabled,
  onToggle,
}: {
  module: ModuleKey;
  enabled: boolean;
  isOverridden: boolean;
  defaultValue: boolean;
  disabled: boolean;
  onToggle: (module: ModuleKey, enabled: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${
        enabled
          ? "border-primary/25 bg-card-tint-emerald"
          : "border-border bg-elevated"
      }`}
    >
      <div className="min-w-0 pr-3">
        <p className="text-sm font-medium text-text">{MODULE_LABELS[module]}</p>
        <p className="mt-0.5 text-xs text-muted">
          Default: {defaultValue ? "On" : "Off"}
          {isOverridden && (
            <span className="ml-2 text-amber-400">· Overridden</span>
          )}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${MODULE_LABELS[module]} access`}
        disabled={disabled}
        onClick={() => onToggle(module, !enabled)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled ? "bg-primary" : "bg-inset"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function permissionsDescription(
  accountType: ReturnType<typeof getAccountType>,
  name: string,
  username: string
) {
  const intro = `Control which modules ${name} (${username}) can access.`;
  const footer =
    "Existing accounts keep stored overrides until you save. Saved changes apply on the next request.";

  if (accountType === "Client") {
    return `${intro} Client portal defaults on: Dashboard, Projects, Progress Reports, Attendance Report, Monthly Reports, and Invoice and Billing. ${footer}`;
  }

  if (accountType === "Vendor") {
    return `${intro} Vendor portal defaults on: Dashboard and Finance (their invoices/billing, tax PPN masukan upload, upload history/status, payment/settlement read-only). Vendors cannot edit vendor details. ${footer}`;
  }

  if (accountType === "Employee") {
    return `${intro} Employee defaults: Dashboard, Progress Reports, CICO (field staff), Leave & Sick; HO staff also get Projects and Attendance Report. ${footer}`;
  }

  return `${intro} Admin accounts start with full access to every module/page so they can delegate access per user. ${footer}`;
}

export default function UserPermissionsDialog({
  user,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [pending, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, boolean>>(
    user.moduleOverrides ?? {}
  );

  const accountType = useMemo(() => getAccountType(user), [user]);
  const baseline = useMemo(
    () =>
      user.employee
        ? getEmployeeModuleOverrides({
            placement: user.employee.placement,
            employeeType: user.employee.employeeType,
          })
        : getAccountTypeBaselineModules(user),
    [user]
  );

  const permissionUser: PermissionUser = useMemo(
    () => ({
      role: user.role,
      employeeType: user.employee?.employeeType ?? null,
      moduleOverrides: overrides,
    }),
    [user.role, user.employee?.employeeType, overrides]
  );

  const accessStates = useMemo(
    () => getAllModuleAccessStates(permissionUser, baseline),
    [permissionUser, baseline]
  );

  const visibleModules = useMemo(() => getVisibleModules(), []);
  const overrideCount = Object.keys(overrides).length;
  const enabledCount = visibleModules.filter(
    (module) => accessStates[module].effective
  ).length;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setOverrides(user.moduleOverrides ?? {});
    }
  }

  function handleToggle(module: ModuleKey, enabled: boolean) {
    setOverrides((current) =>
      buildOverridesFromToggle(
        permissionUser,
        module,
        enabled,
        current,
        baseline
      )
    );
  }

  function handleReset() {
    // Clear overrides so effective access falls back to the account-type baseline.
    setOverrides({});
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUserModuleOverrides(user.id, overrides);
        setOpen(false);
      } catch (error) {
        showRejectionFromError(error, "Failed to save.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button
            size="badge"
            variant="permissionsBadge"
            className={permissionsChipTextClassName}
          >
            {t("pages.users.permissions")}
          </Button>
        </DialogTrigger>
      ) : null}

      <EmployeeDialogShell
        icon={ShieldCheck}
        title={t("pages.users.permissionsTitle")}
        description={permissionsDescription(
          accountType,
          user.name,
          user.username
        )}
        maxWidth="lg"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="button"
              disabled={pending}
              onClick={handleSave}
            >
              {pending
                ? t("common.actions.saving")
                : t("pages.users.savePermissions")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton
              disabled={pending || overrideCount === 0}
              onClick={handleReset}
            >
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                {t("pages.users.resetPermissions")}
              </span>
            </EmployeeSecondaryButton>
          </div>
        }
      >
        <div className={employeeDialogFormClass}>
          <div className="rounded-xl border border-border bg-elevated p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted">Account type:</span>
              <span className="font-medium text-text">
                {t(
                  `common.roles.${
                    accountType === "Client"
                      ? "client"
                      : accountType === "Vendor"
                        ? "vendor"
                        : accountType === "Employee"
                          ? "employee"
                          : "admin"
                  }`
                )}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              {enabledCount} of {visibleModules.length} modules enabled
              {overrideCount > 0 &&
                ` · ${overrideCount} custom override${overrideCount !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div className={employeeDialogGridClass}>
            {visibleModules.map((module) => {
              const state = accessStates[module];
              return (
                <ModuleToggle
                  key={module}
                  module={module}
                  enabled={state.effective}
                  isOverridden={state.override !== null}
                  defaultValue={state.default}
                  disabled={pending}
                  onToggle={handleToggle}
                />
              );
            })}
          </div>
        </div>
      </EmployeeDialogShell>
    </Dialog>
  );
}
