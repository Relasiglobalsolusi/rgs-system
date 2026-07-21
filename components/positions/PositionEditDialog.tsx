"use client";

import { useState, useTransition } from "react";
import { BriefcaseBusiness, Pencil } from "lucide-react";
import { updatePosition } from "@/app/positions/actions";
import PositionDeleteDialog from "@/components/positions/PositionDeleteDialog";
import { EmployeeDialogShell, EmployeePrimaryButton, employeeDialogFieldClass, employeeDialogFormClass, employeeInputClass } from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { showRejectionFromError } from "@/components/ui/rejection-notice";

export type PositionRow = { id: string; categoryId: string; name: string; description: string | null; active: boolean; sortOrder: number; category: { name: string; prefix: string }; _count: { employees: number } };
export default function PositionEditDialog({ position, otherPositions, open, onOpenChange, onUpdated }: { position: PositionRow; otherPositions: PositionRow[]; open: boolean; onOpenChange: (open: boolean) => void; onUpdated?: () => void }) {
  const [active, setActive] = useState(position.active); const [deleteOpen, setDeleteOpen] = useState(false); const [pending, startTransition] = useTransition();
  function submit(formData: FormData) { formData.set("active", String(active)); startTransition(async () => { try { await updatePosition(position.id, formData); onOpenChange(false); onUpdated?.(); } catch (error) { showRejectionFromError(error, "Failed to update position."); } }); }
  return <><Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (nextOpen) setActive(position.active); }} disablePointerDismissal><EmployeeDialogShell icon={BriefcaseBusiness} title="Edit position" description={`${position.category.name} (${position.category.prefix})`} maxWidth="lg" footer={<div className="flex w-full flex-col gap-3"><EmployeePrimaryButton type="button" variant="danger" disabled={pending} onClick={() => setDeleteOpen(true)}>Delete</EmployeePrimaryButton><EmployeePrimaryButton form="edit-position-form" disabled={pending}>{pending ? "Saving…" : "Save changes"}</EmployeePrimaryButton></div>}>
    <form id="edit-position-form" action={submit}><div className={employeeDialogFormClass}><div className={employeeDialogFieldClass}><label className="text-sm font-medium text-muted">Position name</label><Input name="name" defaultValue={position.name} required className={employeeInputClass} /></div><div className={employeeDialogFieldClass}><label className="text-sm font-medium text-muted">Description</label><Input name="description" defaultValue={position.description ?? ""} className={employeeInputClass} /></div><label className="flex items-center gap-3 text-sm text-muted"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Available for new employees</label><p className="text-xs text-subtle">{position._count.employees} employee(s) use this position.</p></div></form>
  </EmployeeDialogShell></Dialog><PositionDeleteDialog position={position} otherPositions={otherPositions} open={deleteOpen} onOpenChange={setDeleteOpen} onDeleted={onUpdated} /></>;
}
