"use client";

import {
  employeeDialogFieldClass,
  employeeDialogGridClass,
  employeeDialogHintClass,
} from "@/components/employees/employee-dialog-ui";
import { useT } from "@/lib/i18n/use-t";
import {
  getVisibleModules,
  type ModuleKey,
} from "@/lib/permissions";

type Props = {
  value: Record<ModuleKey, boolean>;
  onChange: (next: Record<ModuleKey, boolean>) => void;
  disabled?: boolean;
};

export default function PositionModuleAccessFields({
  value,
  onChange,
  disabled = false,
}: Props) {
  const { t } = useT();
  const modules = getVisibleModules();
  const enabledCount = modules.filter((module) => value[module]).length;

  function toggle(module: ModuleKey) {
    onChange({
      ...value,
      [module]: !value[module],
    });
  }

  return (
    <div className={employeeDialogFieldClass}>
      <div>
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
      <input
        type="hidden"
        name="defaultModuleAccess"
        value={JSON.stringify(value)}
      />
      <div className={employeeDialogGridClass}>
        {modules.map((module) => {
          const enabled = Boolean(value[module]);
          const moduleLabel = t(`modules.${module}`);
          return (
            <div
              key={module}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                enabled
                  ? "border-primary/25 bg-card-tint-emerald"
                  : "border-border bg-elevated"
              }`}
            >
              <p className="min-w-0 pr-3 text-sm font-medium text-text">
                {moduleLabel}
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={t("pages.users.permissionsModuleAccessAria", {
                  module: moduleLabel,
                })}
                disabled={disabled}
                onClick={() => toggle(module)}
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
        })}
      </div>
    </div>
  );
}
