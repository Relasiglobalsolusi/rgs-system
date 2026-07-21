"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2 } from "lucide-react";

import EmployeeCategoryTable from "@/components/employee-categories/EmployeeCategoryTable";
import type { EmployeeCategoryRow } from "@/components/employee-categories/EmployeeCategoryEditDialog";
import {
  EmployeeDialogShell,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Props = {
  categories: EmployeeCategoryRow[];
  triggerSize?: "md" | "sm";
  triggerClassName?: string;
};

export default function EmployeeCategoryManageDialog({
  categories,
  triggerSize = "md",
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useT();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      router.refresh();
    }
  }

  return (
    <>
      <DirectoryAddButton
        label={t("pages.employees.manageDepartments")}
        variant="warningBadge"
        icon={<Building2 className="h-3.5 w-3.5 shrink-0" />}
        onClick={() => setOpen(true)}
        className={cn(
          "text-xs tracking-[0.06em]",
          triggerSize === "sm" && "h-8 min-h-8 text-[10px] tracking-[0.04em]",
          triggerClassName
        )}
      />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={Building2}
          title={t("pages.employees.employeeDepartmentsTitle")}
          description={t("pages.employees.employeeDepartmentsDescription")}
          maxWidth="lg"
          footer={
            <EmployeeSecondaryButton onClick={() => setOpen(false)}>
              {t("common.actions.close")}
            </EmployeeSecondaryButton>
          }
        >
          <div>
            <EmployeeCategoryTable categories={categories} />
          </div>
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
