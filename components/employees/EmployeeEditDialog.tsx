"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { UserCog } from "lucide-react";
import { releaseEmployeeFromProject, updateEmployee, previewEmployeeNumber } from "@/app/employees/actions";
import EmployeeAssignDialog from "@/components/employees/EmployeeAssignDialog";
import EmployeeDeleteDialog from "@/components/employees/EmployeeDeleteDialog";
import EmployeeFormFields, { type EmployeeFormDefaults, type EmployeeCategoryOption, type PositionOption, type ProjectOption } from "@/components/employees/EmployeeFormFields";
import { buildEmployeeFormBaseline, EmployeeDialogShell, EmployeePrimaryButton, EmployeeUnsavedExitDialog, handleEmployeeDialogOpenChange, useEmployeeFormDirty } from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useDirectoryDialogOpen, type DirectoryDialogControlProps } from "@/components/ui/use-directory-dialog-open";
import { useT } from "@/lib/i18n/use-t";
import type { EmploymentType, Placement } from "@prisma/client";

type Employee = {
  id: string; employeeNo: string; firstName: string; lastName: string; email: string | null; phone: string | null;
  employmentType: EmploymentType; placement: Placement; portalAccessRequested: boolean; categoryId: string | null;
  category: { name: string; slug?: string } | null; positionId: string | null; position: string | null;
  idDocumentUrl: string | null; hiredAt: Date | string | null;
  projectAssignments: { project: { id: string; name: string } }[];
  user: { username: string } | null;
};
type Props = { employee: Employee; categories: EmployeeCategoryOption[]; positions: PositionOption[]; projects: ProjectOption[]; showDelete?: boolean } & DirectoryDialogControlProps;
const EDIT_FORM_ID = "edit-employee-form";

export default function EmployeeEditDialog({ employee, categories, positions, projects, showDelete = false, open: controlledOpen, onOpenChange, showTrigger = true }: Props) {
  const { t } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(employee.categoryId ?? "");
  const [positionId, setPositionId] = useState(employee.positionId ?? "");
  const [employmentType, setEmploymentType] = useState<"FULL_TIME" | "PART_TIME">(employee.employmentType);
  const [previewEmployeeNo, setPreviewEmployeeNo] = useState("");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState(() => buildEmployeeFormBaseline({ categoryId: employee.categoryId ?? "", positionId: employee.positionId ?? "", employmentType: employee.employmentType }));
  const controlled = { categoryId, positionId, employmentType };
  const { isDirty, handleFormInput, handleFormChange, resetDirtyTracking } = useEmployeeFormDirty(EDIT_FORM_ID, controlled, baseline);
  const isDirtyRef = useRef(isDirty); isDirtyRef.current = isDirty;
  const categoryChanged = categoryId !== (employee.categoryId ?? "");
  const defaults: EmployeeFormDefaults = { employeeNo: employee.employeeNo, firstName: employee.firstName, lastName: employee.lastName, email: employee.email ?? "", phone: employee.phone ?? "", categoryId: employee.categoryId, positionId: employee.positionId, employmentType: employee.employmentType, placement: employee.placement, portalAccessRequested: employee.portalAccessRequested, idDocumentUrl: employee.idDocumentUrl, hiredAt: employee.hiredAt };

  function resetFormState() {
    setCategoryId(employee.categoryId ?? ""); setPositionId(employee.positionId ?? ""); setEmploymentType(employee.employmentType);
    setPreviewEmployeeNo(""); setBaseline(buildEmployeeFormBaseline({ categoryId: employee.categoryId ?? "", positionId: employee.positionId ?? "", employmentType: employee.employmentType })); resetDirtyTracking();
  }
  function closeDialog() { setOpen(false); resetFormState(); }
  function handleOpenChange(nextOpen: boolean, eventDetails?: { cancel: () => void }) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, { isDirty: isDirtyRef.current, onOpen: () => { setOpen(true); resetFormState(); }, onClose: closeDialog, onRequestExitConfirm: () => setExitConfirmOpen(true) });
  }
  useEffect(() => {
    if (!open || !categoryChanged || !categoryId) { setPreviewEmployeeNo(""); return; }
    let cancelled = false;
    previewEmployeeNumber(categoryId).then((no) => !cancelled && setPreviewEmployeeNo(no)).catch(() => !cancelled && setPreviewEmployeeNo(""));
    return () => { cancelled = true; };
  }, [open, categoryChanged, categoryId]);
  function submit(formData: FormData) {
    startTransition(async () => { try { await updateEmployee(employee.id, formData); closeDialog(); } catch (error) { showRejectionFromError(error, t("pages.employees.form.updateFailed")); } });
  }
  function release() {
    startTransition(async () => { try { await releaseEmployeeFromProject(employee.id); closeDialog(); } catch (error) { showRejectionFromError(error, t("pages.employees.form.releaseFailed")); } });
  }

  return <>
    <Dialog open={open} onOpenChange={handleOpenChange} disablePointerDismissal>
      {showTrigger ? <DialogTrigger asChild><Button variant="infoBadge" size="badge">{t("common.actions.edit")}</Button></DialogTrigger> : null}
      <EmployeeDialogShell icon={UserCog} title={t("pages.employees.editEmployee")} description={t("pages.employees.editDescription")} footer={
        <div className="flex w-full flex-col gap-3">
          {employee.placement === "ON_PROJECT" ? <EmployeePrimaryButton type="button" variant="danger" disabled={pending} onClick={release}>{t("pages.employees.form.releaseFromProject")}</EmployeePrimaryButton> : <EmployeePrimaryButton type="button" disabled={pending} onClick={() => setAssignOpen(true)}>{t("pages.employees.form.assignToProject")}</EmployeePrimaryButton>}
          {showDelete ? <EmployeePrimaryButton type="button" variant="danger" disabled={pending} onClick={() => setDeleteOpen(true)}>{t("common.actions.delete")}</EmployeePrimaryButton> : null}
          <EmployeePrimaryButton form={EDIT_FORM_ID} disabled={pending}>{pending ? t("common.actions.saving") : t("common.actions.saveChanges")}</EmployeePrimaryButton>
        </div>
      }>
        <form id={EDIT_FORM_ID} key={`${employee.id}-${open ? "open" : "closed"}`} action={submit} onInput={handleFormInput} onChange={handleFormChange}>
          <EmployeeFormFields mode="edit" categories={categories} positions={positions} categoryId={categoryId} onCategoryIdChange={setCategoryId} positionId={positionId} onPositionIdChange={setPositionId} employmentType={employmentType} onEmploymentTypeChange={setEmploymentType} previewEmployeeNo={previewEmployeeNo} defaults={defaults} onFormValuesChange={handleFormInput} />
        </form>
      </EmployeeDialogShell>
    </Dialog>
    <EmployeeUnsavedExitDialog open={exitConfirmOpen} onConfirm={() => { setExitConfirmOpen(false); closeDialog(); }} onCancel={() => setExitConfirmOpen(false)} />
    {showDelete ? <EmployeeDeleteDialog employee={employee} open={deleteOpen} onOpenChange={setDeleteOpen} showTrigger={false} onDeleted={closeDialog} /> : null}
    <EmployeeAssignDialog open={assignOpen} onOpenChange={setAssignOpen} employeeId={employee.id} projects={projects} />
  </>;
}
