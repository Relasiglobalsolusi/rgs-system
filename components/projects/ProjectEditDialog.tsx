"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { updateProject } from "@/app/projects/actions";
import type { LocationValue } from "@/components/projects/LocationPicker";

const LocationPicker = dynamic(
  () => import("@/components/projects/LocationPicker"),
  { ssr: false }
);
import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import ProjectStaffPicker, {
  type ProjectStaffEmployee,
} from "@/components/projects/ProjectStaffPicker";
import ProjectTimelineFields from "@/components/projects/ProjectTimelineFields";
import {
  captureHtmlFormBaseline,
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeUnsavedExitDialog,
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
  employeeSelectTriggerClass,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil } from "lucide-react";
import { localizeBillingMode, localizeSubCategory } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { PROJECT_SUB_CATEGORIES } from "@/lib/project-subcategory";
import {
  DEFAULT_CONTRACT_DURATION_MONTHS,
  DEFAULT_PROJECT_DURATION_DAYS,
  clampProjectDurationDays,
  daysBetweenDates,
  isContractSubCategory,
  monthsBetweenDates,
  toDateInputValue,
  todayDateInput,
} from "@/lib/project-contract";
import {
  defaultBillingMode,
  isMilestoneSubCategory,
  MILESTONE_ELIGIBLE_BILLING_MODES,
} from "@/lib/project-billing";
import type {
  BillingMode,
  BillingPeriodBasis,
  ProjectStatus,
  ProjectSubCategory,
} from "@prisma/client";
import { isPlanningProjectStatus } from "@/lib/project-status";
import { taxInvoiceDefaultsFromClient } from "@/lib/npwp";
import { cn } from "@/lib/utils";

type Client = {
  id: string;
  name: string;
  npwp?: string | null;
};

type Project = {
  id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  locationRadiusMeters: number | null;
  estimatedStartDate?: Date | null;
  estimatedDurationDays?: number | null;
  startDate: Date | null;
  endDate: Date | null;
  progress: number;
  subCategory: ProjectSubCategory;
  serviceArea?: "CLEANING" | "PARKING" | "SECURITY";
  billingMode?: BillingMode;
  billingPeriodBasis?: BillingPeriodBasis | null;
  requiresTaxInvoice?: boolean;
  clientId: string | null;
  /** When PLANNED, Edit hides Assign Staff (assignment happens at Move to In Progress). */
  status?: ProjectStatus | string;
  assignments: { employeeId: string }[];
};

function timelineStartForProject(project: Project): string {
  if (isPlanningProjectStatus(project.status)) {
    return (
      toDateInputValue(project.estimatedStartDate) ||
      toDateInputValue(project.startDate) ||
      todayDateInput()
    );
  }
  return (
    toDateInputValue(project.startDate) ||
    toDateInputValue(project.estimatedStartDate) ||
    todayDateInput()
  );
}

function durationDaysForProject(project: Project): number {
  const start = isPlanningProjectStatus(project.status)
    ? project.estimatedStartDate ?? project.startDate
    : project.startDate ?? project.estimatedStartDate;
  const fromDates = daysBetweenDates(start, project.endDate);
  // Prefer current start→end span when dates exist; else frozen planning estimate.
  if (fromDates != null) {
    return clampProjectDurationDays(fromDates);
  }
  if (
    project.estimatedDurationDays != null &&
    Number.isFinite(project.estimatedDurationDays)
  ) {
    return clampProjectDurationDays(project.estimatedDurationDays);
  }
  return DEFAULT_PROJECT_DURATION_DAYS;
}

type Props = {
  project: Project;
  employees: ProjectStaffEmployee[];
  clients: Client[];
  /** Compact trigger for table rows; default matches project detail page. */
  compact?: boolean;
} & DirectoryDialogControlProps;

export default function ProjectEditDialog({
  project,
  employees,
  clients,
  compact: _compact = false,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t, locale } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);

  const subcategoryOptions = useMemo(
    () =>
      PROJECT_SUB_CATEGORIES.map((value) => ({
        value,
        label: localizeSubCategory(value, locale),
      })),
    [locale]
  );

  const generalFacadeBillingOptions = useMemo(
    () =>
      MILESTONE_ELIGIBLE_BILLING_MODES.map((value) => ({
        value,
        label: localizeBillingMode(value, locale),
      })),
    [locale]
  );

  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [subCategory, setSubCategory] = useState<ProjectSubCategory>(
    project.subCategory
  );
  const [serviceArea, setServiceArea] = useState<
    "CLEANING" | "PARKING" | "SECURITY"
  >(project.serviceArea ?? "CLEANING");
  const [billingMode, setBillingMode] = useState<BillingMode>(
    project.billingMode ?? defaultBillingMode(project.subCategory)
  );
  const [billingPeriodBasis, setBillingPeriodBasis] =
    useState<BillingPeriodBasis>(
      project.billingPeriodBasis ?? "CONTRACT_CYCLE"
    );
  const [clientId, setClientId] = useState(
    project.clientId ?? clients[0]?.id ?? ""
  );
  const [requiresTaxInvoice, setRequiresTaxInvoice] = useState(() => {
    const id = project.clientId ?? clients[0]?.id ?? "";
    return taxInvoiceDefaultsFromClient(
      clients.find((item) => item.id === id)
    ).requiresTaxInvoice;
  });
  const [npwp, setNpwp] = useState(() => {
    const id = project.clientId ?? clients[0]?.id ?? "";
    return taxInvoiceDefaultsFromClient(
      clients.find((item) => item.id === id)
    ).npwp;
  });
  const [startDate, setStartDate] = useState(() =>
    timelineStartForProject(project)
  );
  const [durationMonths, setDurationMonths] = useState(() =>
    monthsBetweenDates(
      project.startDate ?? project.estimatedStartDate,
      project.endDate
    )
  );
  const [durationDays, setDurationDays] = useState(() =>
    durationDaysForProject(project)
  );
  const [locationValue, setLocationValue] = useState<LocationValue>({
    location: project.location ?? "",
    latitude: project.latitude,
    longitude: project.longitude,
    locationRadiusMeters: project.locationRadiusMeters ?? 50,
  });
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const assignedIds = new Set(
    project.assignments.map((assignment) => assignment.employeeId)
  );
  const isContract = isContractSubCategory(subCategory);
  const isMilestoneEligible = isMilestoneSubCategory(subCategory);
  const formId = `edit-project-form-${project.id}`;

  const controlledSignature = useMemo(
    () =>
      JSON.stringify({
        clientId,
        npwp,
        subCategory,
        serviceArea,
        billingMode,
        billingPeriodBasis,
        requiresTaxInvoice,
        startDate,
        durationMonths,
        durationDays,
        locationValue,
      }),
    [
      clientId,
      npwp,
      subCategory,
      serviceArea,
      billingMode,
      billingPeriodBasis,
      requiresTaxInvoice,
      startDate,
      durationMonths,
      durationDays,
      locationValue,
    ]
  );
  const controlledSignatureRef = useRef(controlledSignature);
  controlledSignatureRef.current = controlledSignature;

  const { isDirty, handleFormInput, resetDirtyTracking } = useHtmlFormDirty(
    formId,
    controlledSignature,
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function applyTaxDefaultsFromClient(client: Client | undefined) {
    const defaults = taxInvoiceDefaultsFromClient(client);
    setRequiresTaxInvoice(defaults.requiresTaxInvoice);
    setNpwp(defaults.npwp);
  }

  function resetFromProject() {
    const nextClientId = project.clientId ?? clients[0]?.id ?? "";
    setSubCategory(project.subCategory);
    setServiceArea(project.serviceArea ?? "CLEANING");
    setBillingMode(
      project.billingMode ?? defaultBillingMode(project.subCategory)
    );
    setBillingPeriodBasis(project.billingPeriodBasis ?? "CONTRACT_CYCLE");
    setClientId(nextClientId);
    applyTaxDefaultsFromClient(clients.find((item) => item.id === nextClientId));
    setStartDate(timelineStartForProject(project));
    setDurationMonths(
      monthsBetweenDates(
        project.startDate ?? project.estimatedStartDate,
        project.endDate
      )
    );
    setDurationDays(durationDaysForProject(project));
    setLocationValue({
      location: project.location ?? "",
      latitude: project.latitude,
      longitude: project.longitude,
      locationRadiusMeters: project.locationRadiusMeters ?? 50,
    });
    resetDirtyTracking();
  }

  function handleClientChange(value: string | null) {
    const nextId = value === "none" || value == null ? "" : value;
    setClientId(nextId);
    applyTaxDefaultsFromClient(clients.find((item) => item.id === nextId));
  }

  function closeDialog() {
    setOpen(false);
    resetFromProject();
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
        resetFromProject();
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
        captureHtmlFormBaseline(formId, controlledSignatureRef.current)
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [open, formId]);

  function handleSubCategoryChange(next: ProjectSubCategory) {
    setSubCategory(next);
    // Clear invalid combos: Regular → MONTHLY; leaving General/Facade clears milestone.
    setBillingMode(defaultBillingMode(next));
    if (isContractSubCategory(next)) {
      if (!startDate) {
        setStartDate(todayDateInput());
      }
      if (durationMonths < 1) {
        setDurationMonths(DEFAULT_CONTRACT_DURATION_MONTHS);
      }
    }
  }

  async function submit(formData: FormData) {
    formData.set("clientId", clientId);
    formData.set("subCategory", subCategory);
    formData.set("serviceArea", serviceArea);
    formData.set("billingMode", billingMode);
    if (isContract) {
      formData.set("billingPeriodBasis", billingPeriodBasis);
    } else {
      formData.delete("billingPeriodBasis");
    }
    // Tax mode + NPWP are derived server-side from the selected client record.
    formData.delete("requiresTaxInvoice");
    formData.delete("npwp");

    startTransition(async () => {
      try {
        await updateProject(project.id, formData);
        setExitConfirmOpen(false);
        setOpen(false);
        setBaseline(null);
      } catch (error) {
        showRejectionFromError(error, t("pages.projects.finish.updateFailed"));
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
            <Button variant="infoBadge" size="badge">
              {t("common.actions.edit")}
            </Button>
          </DialogTrigger>
        ) : null}

        <EmployeeDialogShell
          icon={Pencil}
          title={t("pages.projects.editProject")}
          description={t("pages.projects.editDescription")}
          maxWidth="lg"
          footer={
            <EmployeePrimaryButton form={formId} disabled={pending}>
              {pending
                ? t("common.actions.saving")
                : t("common.actions.saveChanges")}
            </EmployeePrimaryButton>
          }
        >
          <form
            id={formId}
            key={`${project.id}-${open ? "open" : "closed"}`}
            action={submit}
            className={employeeDialogFormClass}
            onInput={handleFormInput}
          >
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.projects.projectName")}
              </label>
              <Input
                name="name"
                defaultValue={project.name}
                required
                className={employeeInputClass}
              />
            </div>

            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("common.labels.client")}
              </label>
              <Select
                value={clientId || "none"}
                onValueChange={handleClientChange}
              >
                <SelectTrigger className={employeeSelectTriggerClass}>
                  <SelectValue placeholder={t("pages.projects.selectClient")}>
                    {(value) => {
                      if (!value || value === "none") return null;
                      const client = clients.find((item) => item.id === value);
                      return client?.name ?? null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-muted">
                    {t("pages.projects.selectClient")}
                  </SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ProjectOptionPills
              label={t("pages.projects.serviceArea")}
              value={serviceArea}
              options={[
                { value: "CLEANING", label: t("pages.projects.serviceAreaCleaning") },
                { value: "PARKING", label: t("pages.projects.serviceAreaParking") },
                { value: "SECURITY", label: t("pages.projects.serviceAreaSecurity") },
              ]}
              onChange={(value) =>
                setServiceArea(value as "CLEANING" | "PARKING" | "SECURITY")
              }
              columns={3}
            />

            {serviceArea === "CLEANING" ? (
              <ProjectOptionPills
                label={t("pages.projects.subcategory")}
                value={subCategory}
                options={subcategoryOptions}
                onChange={handleSubCategoryChange}
                columns={3}
              />
            ) : null}

            {isMilestoneEligible ? (
              <>
                <ProjectOptionPills
                  label={t("pages.projects.billingLabel")}
                  value={billingMode}
                  options={generalFacadeBillingOptions}
                  onChange={setBillingMode}
                  columns={2}
                />
                {billingMode === "MILESTONE" ? (
                  <p className="rounded-xl border border-border bg-elevated/60 px-4 py-3 text-xs text-subtle">
                    {t("pages.projects.paymentPlan.scheduleLockedNote")}
                  </p>
                ) : null}
              </>
            ) : null}

            {isContract ? (
              <>
                <ProjectOptionPills
                  label={t("pages.projects.billingPeriodBasis")}
                  value={billingPeriodBasis}
                  options={[
                    {
                      value: "CONTRACT_CYCLE",
                      label: t(
                        "pages.projects.billingPeriodBasisContractCycle"
                      ),
                    },
                    {
                      value: "CALENDAR_MONTH",
                      label: t(
                        "pages.projects.billingPeriodBasisCalendarMonth"
                      ),
                    },
                  ]}
                  onChange={(value) =>
                    setBillingPeriodBasis(value as BillingPeriodBasis)
                  }
                  columns={2}
                />
                <p className="text-xs text-subtle">
                  {t("pages.projects.billingPeriodBasisHelp")}
                </p>
              </>
            ) : null}

            {requiresTaxInvoice ? (
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor={`edit-project-npwp-${project.id}`}
                  className="text-sm font-medium text-text"
                >
                  {t("pages.projects.companyNpwp")}
                </label>
                <Input
                  id={`edit-project-npwp-${project.id}`}
                  value={npwp}
                  readOnly
                  tabIndex={-1}
                  autoComplete="off"
                  className={cn(employeeInputClass, "bg-elevated text-muted")}
                />
                <p className="text-xs text-subtle">
                  {t("pages.projects.companyNpwpHint")}
                </p>
              </div>
            ) : (
              <p className="text-xs text-subtle">
                {t("pages.projects.withoutTaxNote")}
              </p>
            )}

            <LocationPicker value={locationValue} onChange={setLocationValue} />

            {isContract ? (
              <ProjectTimelineFields
                mode="contract"
                planning={isPlanningProjectStatus(project.status)}
                startDate={startDate}
                durationMonths={durationMonths}
                onStartDateChange={setStartDate}
                onDurationMonthsChange={setDurationMonths}
              />
            ) : (
              <ProjectTimelineFields
                mode="standard"
                planning={isPlanningProjectStatus(project.status)}
                startDate={startDate}
                durationDays={durationDays}
                onStartDateChange={setStartDate}
                onDurationDaysChange={setDurationDays}
              />
            )}

            {!isPlanningProjectStatus(project.status) ? (
              <ProjectStaffPicker
                employees={employees}
                defaultCheckedIds={assignedIds}
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
