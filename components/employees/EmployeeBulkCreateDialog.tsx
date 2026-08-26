"use client";

import {
  showMissingRequiredFields,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useRef, useState, useTransition } from "react";
import { Users } from "lucide-react";

import {
  createEmployeesInBulk,
  previewEmployeeNumbersForLines,
} from "@/app/employees/actions";
import BulkLineList from "@/components/bulk-create/BulkLineList";
import EmployeeFormFields, {
  type EmployeeCategoryOption,
  type PositionOption,
  type ProjectOption,
} from "@/components/employees/EmployeeFormFields";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeUnsavedExitDialog,
  handleEmployeeDialogOpenChange,
  useHtmlFormDirty,
  type HtmlFormDirtyBaseline,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { createBulkLineKey } from "@/lib/bulk-create";
import { useT } from "@/lib/i18n/use-t";

const FORM_ID = "bulk-create-employee-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employmentType: "FULL_TIME" | "PART_TIME";
  categories: EmployeeCategoryOption[];
  positions: PositionOption[];
  projects: ProjectOption[];
};

export default function EmployeeBulkCreateDialog({
  open: controlledOpen,
  onOpenChange,
  employmentType: lockedEmploymentType,
  categories,
  positions,
  projects,
}: Props) {
  const { t } = useT();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [lineKeys, setLineKeys] = useState<string[]>(() => [createBulkLineKey()]);
  const [lineCategoryIds, setLineCategoryIds] = useState<Record<string, string>>(
    {}
  );
  const [linePositionIds, setLinePositionIds] = useState<Record<string, string>>(
    {}
  );
  const [previewNos, setPreviewNos] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    FORM_ID,
    "",
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const categoryList = lineKeys.map((key) => lineCategoryIds[key] ?? "");
  const allLinesReady = lineKeys.every(
    (key) => Boolean(lineCategoryIds[key]) && Boolean(linePositionIds[key])
  );

  function resetForm() {
    resetDirtyTracking();
    setBaseline(null);
    setLineKeys([createBulkLineKey()]);
    setLineCategoryIds({});
    setLinePositionIds({});
    setPreviewNos([]);
  }

  function closeDialog() {
    onOpenChange(false);
    resetForm();
  }

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void }
  ) {
    handleEmployeeDialogOpenChange(nextOpen, eventDetails, {
      isDirty: isDirtyRef.current,
      onOpen: () => {
        onOpenChange(true);
        resetForm();
      },
      onClose: closeDialog,
      onRequestExitConfirm: () => setExitConfirmOpen(true),
    });
  }

  useEffect(() => {
    if (!controlledOpen) {
      setBaseline(null);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setBaseline(captureHtmlFormBaseline(FORM_ID, ""));
    });
    return () => cancelAnimationFrame(frame);
  }, [controlledOpen]);

  useEffect(() => {
    if (!controlledOpen || categoryList.every((id) => !id)) {
      setPreviewNos([]);
      return;
    }
    let cancelled = false;
    previewEmployeeNumbersForLines(categoryList)
      .then((numbers) => {
        if (!cancelled) setPreviewNos(numbers);
      })
      .catch(() => {
        if (!cancelled) setPreviewNos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [controlledOpen, categoryList.join("|")]);

  function submit(formData: FormData) {
    const form = document.getElementById(FORM_ID);
    if (
      showMissingRequiredFields(
        form instanceof HTMLFormElement ? form : null
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await createEmployeesInBulk(formData);
        closeDialog();
      } catch (error) {
        showRejectionFromError(error, t("pages.employees.form.createFailed"));
      }
    });
  }

  return (
    <>
      <Dialog
        open={controlledOpen}
        onOpenChange={handleOpenChange}
        disablePointerDismissal
      >
        <EmployeeDialogShell
          icon={Users}
          title={
            lockedEmploymentType === "PART_TIME"
              ? t("pages.employees.bulkCreatePartTimeTitle")
              : t("pages.employees.bulkCreateFullTimeTitle")
          }
          description={t("pages.employees.bulkCreateDesc")}
          maxWidth="lg"
          footer={
            <EmployeePrimaryButton
              form={FORM_ID}
              disabled={pending || !allLinesReady}
            >
              {pending
                ? t("bulkCreate.addingCount", { count: String(lineKeys.length) })
                : t("bulkCreate.addCount", { count: String(lineKeys.length) })}
            </EmployeePrimaryButton>
          }
        >
          <form
            id={FORM_ID}
            action={submit}
            noValidate
            onInput={handleFormInput}
          >
            <input type="hidden" name="lineCount" value={lineKeys.length} />
            <BulkLineList
              title={t("pages.employees.bulkCreatePeople")}
              description={t("pages.employees.bulkCreatePeopleHint")}
              lineKeys={lineKeys}
              onAdd={(count) =>
                setLineKeys((current) => [
                  ...current,
                  ...Array.from({ length: count }, () => createBulkLineKey()),
                ])
              }
              onRemove={(index) =>
                setLineKeys((current) =>
                  current.length <= 1
                    ? current
                    : current.filter((_, itemIndex) => itemIndex !== index)
                )
              }
              renderLine={(index) => {
                const lineKey = lineKeys[index];
                return (
                  <EmployeeFormFields
                    mode="create"
                    lockEmploymentType
                    namePrefix={`line.${index}.`}
                    idPrefix={`bulk-employee-${index}-`}
                    categories={categories}
                    positions={positions}
                    projects={projects}
                    categoryId={lineCategoryIds[lineKey] ?? ""}
                    onCategoryIdChange={(value) => {
                      setLineCategoryIds((current) => ({
                        ...current,
                        [lineKey]: value,
                      }));
                      setLinePositionIds((current) => ({
                        ...current,
                        [lineKey]: "",
                      }));
                    }}
                    positionId={linePositionIds[lineKey] ?? ""}
                    onPositionIdChange={(value) =>
                      setLinePositionIds((current) => ({
                        ...current,
                        [lineKey]: value,
                      }))
                    }
                    employmentType={lockedEmploymentType}
                    onEmploymentTypeChange={() => undefined}
                    previewEmployeeNo={previewNos[index] ?? ""}
                    onFormValuesChange={handleFormInput}
                  />
                );
              }}
            />
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
