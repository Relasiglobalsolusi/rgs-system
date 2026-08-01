"use client";

import { useMemo, useState, useTransition } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { createPosition } from "@/app/positions/actions";
import type { EmployeeCategoryOption } from "@/components/employees/EmployeeFormFields";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { titleCaseWords } from "@/lib/text-case";

function formatDepartmentLabel(category: EmployeeCategoryOption): string {
  return `${titleCaseWords(category.name)} (${category.prefix.toUpperCase()})`;
}

export default function PositionDialog({
  categories,
  onCreated,
}: {
  categories: EmployeeCategoryOption[];
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [pending, startTransition] = useTransition();

  const selectableCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.active && category.prefix.toUpperCase() !== "UNA"
      ),
    [categories]
  );

  // Same pattern as ProgressDialog / CicoActions: Base UI Select.Value shows the
  // raw value unless Root `items` maps id → label, and SelectValue renders the label.
  const departmentSelectItems = selectableCategories.map((category) => ({
    value: category.id,
    label: formatDepartmentLabel(category),
  }));

  function submit(formData: FormData) {
    formData.set("categoryId", categoryId);
    startTransition(async () => {
      try {
        await createPosition(formData);
        setOpen(false);
        setCategoryId("");
        onCreated?.();
      } catch (error) {
        showRejectionFromError(error, "Failed to create position.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} disablePointerDismissal>
      <DialogTrigger asChild>
        <Button variant="successBadge" size="badge">
          Add Position
        </Button>
      </DialogTrigger>
      <EmployeeDialogShell
        icon={BriefcaseBusiness}
        title="Add Position"
        description="Add a job position for a department."
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton
            form="create-position-form"
            disabled={pending || !categoryId}
          >
            {pending ? "Adding…" : "Add Position"}
          </EmployeePrimaryButton>
        }
      >
        <form id="create-position-form" action={submit}>
          <div className={employeeDialogFormClass}>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-muted">Department</label>
              <Select
                value={categoryId}
                onValueChange={(value) => setCategoryId(value ?? "")}
                items={departmentSelectItems}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue placeholder="Select Department">
                    {(value) => {
                      if (!value) return null;
                      const category = selectableCategories.find(
                        (item) => item.id === value
                      );
                      return category
                        ? formatDepartmentLabel(category)
                        : String(value);
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {selectableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {formatDepartmentLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-muted">Position Name</label>
              <Input name="name" required className={employeeInputClass} />
            </div>
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-muted">Description</label>
              <Input name="description" className={employeeInputClass} />
            </div>
          </div>
        </form>
      </EmployeeDialogShell>
    </Dialog>
  );
}
