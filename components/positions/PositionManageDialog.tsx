"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import PositionTable from "@/components/positions/PositionTable";
import type { PositionRow } from "@/components/positions/PositionEditDialog";
import type { EmployeeCategoryOption } from "@/components/employees/EmployeeFormFields";
import { EmployeeDialogShell, EmployeeSecondaryButton } from "@/components/employees/employee-dialog-ui";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";

export default function PositionManageDialog({ positions, categories }: { positions: PositionRow[]; categories: EmployeeCategoryOption[] }) {
  const [open, setOpen] = useState(false); const router = useRouter();
  const { t } = useT();
  return <><DirectoryAddButton label={t("pages.employees.managePositions")} variant="warningBadge" icon={<BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />} onClick={() => setOpen(true)} className="text-xs tracking-[0.06em]" /><Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) router.refresh(); }}><EmployeeDialogShell icon={BriefcaseBusiness} title={t("pages.employees.managePositions")} description="Define job positions within each department." maxWidth="lg" footer={<EmployeeSecondaryButton onClick={() => setOpen(false)}>Close</EmployeeSecondaryButton>}><PositionTable positions={positions} categories={categories} /></EmployeeDialogShell></Dialog></>;
}
