"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

import {
  getClientPortalModuleAccess,
  saveClientPortalModuleAccess,
} from "@/app/clients/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeDialogFieldClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
} from "@/components/employees/employee-dialog-ui";
import { downloadSystemGuidePdf } from "@/components/system-guide/download-guide";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { Dialog } from "@/components/ui/dialog";
import {
  showRejectionFromError,
  showRejection,
} from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import {
  getClientModuleOverrides,
  getClientPortalManageableModules,
  type ModuleAccessFlags,
  type ModuleKey,
} from "@/lib/permissions";
import { enabledClientGuideModules } from "@/lib/system-guide/access";

type Props = {
  disabled?: boolean;
};

function ModuleSwitch({
  label,
  enabled,
  disabled,
  ariaLabel,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  disabled: boolean;
  ariaLabel: string;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${
        enabled
          ? "border-primary/25 bg-card-tint-emerald"
          : "border-border bg-elevated"
      }`}
    >
      <p className="min-w-0 pr-3 text-sm font-medium text-text">{label}</p>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onToggle}
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

export default function ClientModuleAccessButton({
  disabled = false,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessFlags>(
    getClientModuleOverrides
  );

  const modules = getClientPortalManageableModules();
  const enabledCount = modules.filter((module) => moduleAccess[module]).length;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getClientPortalModuleAccess()
      .then((flags) => {
        if (!cancelled) setModuleAccess(flags);
      })
      .catch((error) => {
        if (!cancelled) {
          showRejectionFromError(
            error,
            t("pages.clients.moduleAccessLoadFailed")
          );
          setOpen(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  function toggle(module: ModuleKey) {
    setModuleAccess((current) => ({
      ...current,
      [module]: !current[module],
    }));
  }

  async function downloadGuide() {
    const modules = enabledClientGuideModules(moduleAccess);
    if (modules.length === 0) {
      showRejection({
        reasons: t("pages.clients.downloadSystemGuideEmpty"),
      });
      return;
    }
    setDownloading(true);
    try {
      await downloadSystemGuidePdf({
        url: "/api/clients/system-guide",
        body: { modules },
        fallbackFilename: "RGS-ONE-System-Guide.pdf",
        failedMessage: t("pages.clients.downloadSystemGuideFailed"),
      });
    } catch (error) {
      showRejectionFromError(
        error,
        t("pages.clients.downloadSystemGuideFailed")
      );
    } finally {
      setDownloading(false);
    }
  }

  async function save() {
    setPending(true);
    try {
      await saveClientPortalModuleAccess(moduleAccess);
      setOpen(false);
    } catch (error) {
      showRejectionFromError(
        error,
        t("pages.clients.moduleAccessSaveFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DirectoryAddButton
        label={t("pages.clients.manageModuleAccess")}
        variant="infoBadge"
        icon={<Shield className="h-3.5 w-3.5 shrink-0" />}
        disabled={disabled}
        onClick={() => setOpen(true)}
      />

      <Dialog
        skipUnsavedGuard
        open={open}
        onOpenChange={(next) => {
          if (pending || downloading) return;
          setOpen(next);
        }}
      >
        <EmployeeDialogShell
          icon={Shield}
          title={t("pages.clients.manageModuleAccess")}
          description={t("pages.clients.manageModuleAccessDescription")}
          maxWidth="lg"
          footer={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
              <EmployeeSecondaryButton
                disabled={pending || downloading}
                onClick={() => {
                  void downloadGuide();
                }}
              >
                {downloading
                  ? t("pages.clients.downloadingSystemGuide")
                  : t("pages.clients.downloadSystemGuide")}
              </EmployeeSecondaryButton>
              <EmployeeSecondaryButton
                disabled={pending || downloading}
                onClick={() => setOpen(false)}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
              <EmployeePrimaryButton
                type="button"
                disabled={pending || loading}
                onClick={() => {
                  if (enabledCount === 0) {
                    showRejection({
                      reasons: t("pages.clients.moduleAccessEmpty"),
                    });
                    return;
                  }
                  void save();
                }}
              >
                {pending
                  ? t("common.actions.saving")
                  : t("common.actions.save")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <div className={employeeDialogFieldClass}>
            <p className={employeeDialogHintClass}>
              {t("pages.clients.manageModuleAccessHint")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t("pages.users.permissionsModulesEnabled", {
                enabled: enabledCount,
                total: modules.length,
              })}
            </p>
            <div className={`mt-3 ${employeeDialogGridClass}`}>
              {loading ? (
                <p className="text-sm text-muted">{t("common.actions.loading")}</p>
              ) : (
                modules.map((module) => {
                  const enabled = Boolean(moduleAccess[module]);
                  const moduleLabel = t(`modules.${module}`);
                  return (
                    <ModuleSwitch
                      key={module}
                      label={moduleLabel}
                      enabled={enabled}
                      disabled={pending}
                      ariaLabel={t("pages.users.permissionsModuleAccessAria", {
                        module: moduleLabel,
                      })}
                      onToggle={() => toggle(module)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
