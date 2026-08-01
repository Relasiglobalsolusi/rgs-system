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
  const targets = useMemo(
    () =>
      otherPositions.filter(
        (item) => item.active && item.categoryId === position.categoryId
      ),
    [otherPositions, position.categoryId]
  );

  // Same pattern as ProgressDialog / CicoActions.
  const replacementSelectItems = targets.map((target) => ({
    value: target.id,
    label: titleCaseWords(target.name),
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
        showRejectionFromError(error, "Failed to delete position.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={Trash2}
        title="Delete Position"
        description={
          hasEmployees
            ? "Reassign employees before deleting this position."
            : "This position has no employees."
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
              {pending ? "Deleting…" : "Delete Position"}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton onClick={() => onOpenChange(false)}>
              Cancel
            </EmployeeSecondaryButton>
          </div>
        }
      >
        {hasEmployees ? (
          <div className="space-y-3">
            <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-card-tint-amber p-4 text-sm text-text">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              {position._count.employees} employee(s) will be reassigned.
            </div>
            <Select
              value={targetId}
              onValueChange={(value) => setTargetId(value ?? "")}
              items={replacementSelectItems}
            >
              <SelectTrigger className={employeeSelectTriggerClass}>
                <SelectValue placeholder="Select Replacement Position">
                  {(value) => {
                    if (!value) return null;
                    const target = targets.find((item) => item.id === value);
                    return target
                      ? titleCaseWords(target.name)
                      : String(value);
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {titleCaseWords(target.name)}
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
