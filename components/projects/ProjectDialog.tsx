"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { createProject } from "@/app/projects/actions";
import ProjectFormFields, {
  type ProjectFormClient,
  type ProjectFormFieldsState,
} from "@/components/projects/ProjectFormFields";
import type { ProjectTeamOption } from "@/components/projects/ProjectTeamPicker";
import type { ProjectStaffEmployee } from "@/components/projects/ProjectStaffPicker";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeUnsavedExitDialog,
  employeeDialogFormClass,
  handleEmployeeDialogOpenChange,
  useHtmlFormDirty,
  type HtmlFormDirtyBaseline,
} from "@/components/employees/employee-dialog-ui";

import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useDirectoryDialogOpen,
  type DirectoryDialogControlProps,
} from "@/components/ui/use-directory-dialog-open";
import { FolderKanban } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";

type Props = DirectoryDialogControlProps & {
  employees: ProjectStaffEmployee[];
  teams?: ProjectTeamOption[];
  clients: ProjectFormClient[];
};

const FORM_ID = "create-project-form";

const INITIAL_FIELDS_STATE: ProjectFormFieldsState = {
  clientId: "",
  planSumOk: true,
  isService: false,
  isContract: true,
  showPaymentPlan: false,
  initialStatus: "PLANNED",
  controlledSignature: "",
};

export default function ProjectDialog({
  employees,
  teams = [],
  clients,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [fieldsState, setFieldsState] =
    useState<ProjectFormFieldsState>(INITIAL_FIELDS_STATE);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const isBusy = pending || submitting;

  const {
    clientId,
    planSumOk,
    isService,
    isContract,
    showPaymentPlan,
    initialStatus,
    controlledSignature,
  } = fieldsState;

  const controlledSignatureRef = useRef(controlledSignature);
  controlledSignatureRef.current = controlledSignature;

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    FORM_ID,
    controlledSignature,
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetForm() {
    setFieldsState({
      ...INITIAL_FIELDS_STATE,
      clientId: clients[0]?.id ?? "",
    });
    resetDirtyTracking();
  }

  function closeDialog() {
    setOpen(false);
    resetForm();
    setBaseline(null);
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => {
        setOpen(true);
        resetForm();
      },
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  useEffect(() => {
    if (!open) {
      setBaseline(null);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setBaseline(
        captureHtmlFormBaseline(FORM_ID, controlledSignatureRef.current)
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  async function submit(formData: FormData) {
    if (initialStatus === "IN_PROGRESS") {
      const proof = formData.get("contractProof");
      if (!(proof instanceof File) || proof.size === 0) {
        showRejection({ reasons: t("pages.projects.contractProofHint") });
        return;
      }
    }

    formData.delete("requiresTaxInvoice");
    formData.delete("npwp");

    if (!showPaymentPlan) {
      formData.delete("milestoneInstallmentPercent");
    }

    setSubmitting(true);
    startTransition(async () => {
      try {
        await createProject(formData);
        setExitConfirmOpen(false);
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.finish.createFailed"));
      } finally {
        setSubmitting(false);
      }
    });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        disablePointerDismissal
      >
        {showTrigger ? (
          <DialogTrigger asChild>
            <Button variant="successBadge" size="badge">
              {t("pages.projects.newProject")}
            </Button>
          </DialogTrigger>
        ) : null}

        <EmployeeDialogShell
          icon={FolderKanban}
          title={t("pages.projects.createProject")}
          description={
            isService
              ? t("pages.projects.createDescriptionService")
              : isContract
                ? t("pages.projects.createDescriptionContract")
                : showPaymentPlan
                  ? t("pages.projects.createDescriptionMilestone")
                  : t("pages.projects.createDescription")
          }
          maxWidth="lg"
          footer={
            <EmployeePrimaryButton
              form={FORM_ID}
              disabled={isBusy || !clientId || !planSumOk}
            >
              {isBusy
                ? t("pages.projects.creating")
                : t("pages.projects.createProject")}
            </EmployeePrimaryButton>
          }
        >
          <form
            id={FORM_ID}
            key={open ? "open" : "closed"}
            action={submit}
            className={employeeDialogFormClass}
            onInput={handleFormInput}
          >
            {open ? (
              <ProjectFormFields
                employees={employees}
                teams={teams}
                clients={clients}
                onFormValuesChange={handleFormInput}
                onStateChange={setFieldsState}
              />
            ) : null}
          </form>
        </EmployeeDialogShell>
      </Dialog>

      <EmployeeUnsavedExitDialog
        open={exitConfirmOpen}
        onConfirm={() => {
          setExitConfirmOpen(false);
          closeDialog();
        }}
        onCancel={() => setExitConfirmOpen(false)}
      />
    </>
  );
}
