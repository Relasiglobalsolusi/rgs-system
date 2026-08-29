"use client";

import type { ReactNode } from "react";

import {
  employeeDialogFieldClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
} from "@/components/employees/employee-dialog-ui";
import { useT } from "@/lib/i18n/use-t";
import {
  ADVANCE_CASH_CHILD_KEYS,
  applyAdvanceCashChildToggle,
  applyAdvanceCashParentToggle,
  getVisibleModules,
  type AdvanceCashChildKey,
  type ModuleAccessFlags,
  type ModuleKey,
} from "@/lib/permissions";

type Props = {
  value: ModuleAccessFlags;
  onChange: (next: ModuleAccessFlags) => void;
  disabled?: boolean;
  headerAction?: ReactNode;
};

function ModuleSwitch({
  label,
  enabled,
  disabled,
  ariaLabel,
  onToggle,
  compact = false,
}: {
  label: string;
  enabled: boolean;
  disabled: boolean;
  ariaLabel: string;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border transition ${
        compact ? "px-2.5 py-2" : "px-4 py-3"
      } ${
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

export default function PositionModuleAccessFields({
  value,
  onChange,
  disabled = false,
  headerAction,
}: Props) {
  const { t } = useT();
  const modules = getVisibleModules();
  const enabledCount = modules.filter((module) => value[module]).length;

  function toggle(module: ModuleKey) {
    if (module === "pettyCash") {
      onChange(applyAdvanceCashParentToggle(value, !value.pettyCash));
      return;
    }
    onChange({
      ...value,
      [module]: !value[module],
    });
  }

  function toggleChild(child: AdvanceCashChildKey) {
    onChange(applyAdvanceCashChildToggle(value, child, !value[child]));
  }

  return (
    <div className={employeeDialogFieldClass}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">
            {t("pages.employees.positionDialog.moduleAccess")}
          </p>
          <p className={employeeDialogHintClass}>
            {t("pages.employees.positionDialog.moduleAccessHint")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("pages.users.permissionsModulesEnabled", {
              enabled: enabledCount,
              total: modules.length,
            })}
          </p>
        </div>
        {headerAction ? (
          <div className="w-full shrink-0 sm:w-auto sm:pt-0.5">{headerAction}</div>
        ) : null}
      </div>
      <input
        type="hidden"
        name="defaultModuleAccess"
        value={JSON.stringify(value)}
      />
      <div className={employeeDialogGridClass}>
        {modules.map((module) => {
          const enabled = Boolean(value[module]);
          const moduleLabel = t(`modules.${module}`);
          if (module === "pettyCash") {
            return (
              <div key={module} className="flex min-w-0 flex-col gap-1.5">
                <ModuleSwitch
                  label={moduleLabel}
                  enabled={enabled}
                  disabled={disabled}
                  ariaLabel={t("pages.users.permissionsModuleAccessAria", {
                    module: moduleLabel,
                  })}
                  onToggle={() => toggle(module)}
                />
                {enabled ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {ADVANCE_CASH_CHILD_KEYS.map((child) => {
                      const childEnabled = Boolean(value[child]);
                      const childLabel = t(`modules.${child}`);
                      return (
                        <ModuleSwitch
                          key={child}
                          compact
                          label={childLabel}
                          enabled={childEnabled}
                          disabled={disabled}
                          ariaLabel={t("pages.users.permissionsModuleAccessAria", {
                            module: childLabel,
                          })}
                          onToggle={() => toggleChild(child)}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <ModuleSwitch
              key={module}
              label={moduleLabel}
              enabled={enabled}
              disabled={disabled}
              ariaLabel={t("pages.users.permissionsModuleAccessAria", {
                module: moduleLabel,
              })}
              onToggle={() => toggle(module)}
            />
          );
        })}
      </div>
    </div>
  );
}
