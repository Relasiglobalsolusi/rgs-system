"use client";

import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { createEmployee, previewEmployeeNumber } from "@/app/employees/actions";
import EmployeeFormFields, {
  type EmployeeCategoryOption,
  type PositionOption,
  type ProjectOption,
} from "@/components/employees/EmployeeFormFields";
import {
  buildEmployeeFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeUnsavedExitDialog,
  handleEmployeeDialogOpenChange,
  useEmployeeFormDirty,
} from "@/components/employees/employee-dialog-ui";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useDirectoryDialogOpen, type DirectoryDialogControlProps } from "@/components/ui/use-directory-dialog-open";

type Props = {
  categories: EmployeeCategoryOption[];
  positions: PositionOption[];
  projects: ProjectOption[];
} & DirectoryDialogControlProps;

const CREATE_FORM_ID = "create-employee-form";

export default function EmployeeDialog({ categories, positions, open: controlledOpen, onOpenChange, showTrigger = true }: Props) {
  const { t } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [employmentType, setEmploymentType] = useState<"FULL_TIME" | "PART_TIME">("FULL_TIME");
  const [previewEmployeeNo, setPreviewEmployeeNo] = useState("");
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState(() => buildEmployeeFormBaseline({ categoryId: "", positionId: "", employmentType: "FULL_TIME" }));
  const controlled = { categoryId, positionId, employmentType };
  const { isDirty, handleFormInput, handleFormChange, resetDirtyTracking } = useEmployeeFormDirty(CREATE_FORM_ID, controlled, baseline);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetForm() {
    setCategoryId("");
    setPositionId("");
    setEmploymentType("FULL_TIME");
    setPreviewEmployeeNo("");
    setBaseline(buildEmployeeFormBaseline({ categoryId: "", positionId: "", employmentType: "FULL_TIME" }));
    resetDirtyTracking();
  }
  function closeDialog() { setOpen(false); resetForm(); }
  function handleOpenChange(nextOpen: boolean, eventDetails?: { cancel: () => void }) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => { setOpen(true); resetForm(); },
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  useEffect(() => {
    if (!open || !categoryId) { setPreviewEmployeeNo(""); return; }
    let cancelled = false;
    previewEmployeeNumber(categoryId).then((employeeNo) => !cancelled && setPreviewEmployeeNo(employeeNo)).catch(() => !cancelled && setPreviewEmployeeNo(""));
    return () => { cancelled = true; };
  }, [open, categoryId]);

  function submit(formData: FormData) {
    startTransition(async () => {
      try { await createEmployee(formData); closeDialog(); }
      catch (error) { showRejectionFromError(error, t("pages.employees.form.createFailed")); }
    });
  }

  return <>
    <Dialog open={open} onOpenChange={handleOpenChange} disablePointerDismissal>
      {showTrigger ? <DialogTrigger asChild><Button variant="successBadge" size="badge">{t("pages.employees.addEmployee")}</Button></DialogTrigger> : null}
      <EmployeeDialogShell icon={UserPlus} title={t("pages.employees.addEmployee")} description={t("pages.employees.descriptionAdmin")} footer={
        <EmployeePrimaryButton form={CREATE_FORM_ID} disabled={pending || !categoryId || !positionId}>
          {pending ? t("common.actions.adding") : t("pages.employees.addEmployee")}
        </EmployeePrimaryButton>
      }>
        <form id={CREATE_FORM_ID} action={submit} onInput={handleFormInput} onChange={handleFormChange}>
          <EmployeeFormFields mode="create" categories={categories} positions={positions} categoryId={categoryId} onCategoryIdChange={setCategoryId} positionId={positionId} onPositionIdChange={setPositionId} employmentType={employmentType} onEmploymentTypeChange={setEmploymentType} previewEmployeeNo={previewEmployeeNo} onFormValuesChange={handleFormInput} />
        </form>
      </EmployeeDialogShell>
    </Dialog>
    <EmployeeUnsavedExitDialog open={exitConfirmOpen} onConfirm={() => { setExitConfirmOpen(false); closeDialog(); }} onCancel={() => setExitConfirmOpen(false)} />
  </>;
}
