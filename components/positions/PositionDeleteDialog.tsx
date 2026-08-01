"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deletePosition } from "@/app/positions/actions";
import type { PositionRow } from "@/components/positions/PositionEditDialog";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { localizeJobTitle } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { titleCaseWords } from "@/lib/text-case";

export default function PositionDeleteDialog({
  position,
  otherPositions,
  open,
  onOpenChange,
  onDeleted,
}: {
  position: PositionRow;
  otherPositions: PositionRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { t, locale } = useT();

  const targets = useMemo(
    () =>
      otherPositions.filter(
        (item) => item.active && item.categoryId === position.categoryId
      ),
    [otherPositions, position.categoryId]
  );

  function formatPositionLabel(name: string): string {
    return titleCaseWords(localizeJobTitle(name, locale) || name);
  }

  // Same pattern as ProgressDialog / CicoActions.
  const replacementSelectItems = targets.map((target) => ({
    value: target.id,
    label: formatPositionLabel(target.name),
  }));

  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const hasEmployees = position._count.employees > 0;

  function remove() {
    startTransition(async () => {
      try {
        await deletePosition(position.id, hasEmployees ? targetId : undefined);
        onOpenChange(false);
        onDeleted?.();
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.employees.positionDialog.deleteFailed")
        );
      }
    });
  }

  const reassignedKey =
    position._count.employees === 1
      ? "pages.employees.positionDialog.employeesReassignedOne"
      : "pages.employees.positionDialog.employeesReassignedOther";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Trash2}
        title={t("pages.employees.positionDialog.deleteTitle")}
        description={
          hasEmployees
            ? t("pages.employees.positionDialog.deleteDescWithEmployees")
            : t("pages.employees.positionDialog.deleteDescEmpty")
        }
        maxWidth="md"
        footer={
          <div className="flex w-full flex-col gap-3">
            <EmployeePrimaryButton
              type="button"
              variant="danger"
              disabled={pending || (hasEmployees && !targetId)}
              onClick={remove}
            >
              {pending
                ? t("common.actions.deleting")
                : t("pages.employees.positionDialog.deleteConfirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </div>
        }
      >
        {hasEmployees ? (
          <div className="space-y-3">
            <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-card-tint-amber p-4 text-sm text-text">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              {t(reassignedKey, { count: position._count.employees })}
            </div>
            <Select
              value={targetId}
              onValueChange={(value) => setTargetId(value ?? "")}
              items={replacementSelectItems}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue
                  placeholder={t(
                    "pages.employees.positionDialog.selectReplacement"
                  )}
                >
                  {(value) => {
                    if (!value) return null;
                    const target = targets.find((item) => item.id === value);
                    return target
                      ? formatPositionLabel(target.name)
                      : String(value);
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {formatPositionLabel(target.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </EmployeeDialogShell>
    </Dialog>
  );
}
