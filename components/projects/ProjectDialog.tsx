"use client";

import {
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { createProject } from "@/app/projects/actions";
import type { LocationValue } from "@/components/projects/LocationPicker";
import { DEFAULT_LOCATION_RADIUS_METERS } from "@/lib/geo";

const LocationPicker = dynamic(
  () => import("@/components/projects/LocationPicker"),
  { ssr: false }
);
import MilestonePaymentPlanFields from "@/components/projects/MilestonePaymentPlanFields";
import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import ProjectStaffPicker, {
  type ProjectStaffEmployee,
} from "@/components/projects/ProjectStaffPicker";
import ProjectTimelineFields from "@/components/projects/ProjectTimelineFields";
import ServiceCommercialFields from "@/components/projects/ServiceCommercialFields";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDirectoryDialogOpen,
  type DirectoryDialogControlProps,
} from "@/components/ui/use-directory-dialog-open";
import { FolderKanban } from "lucide-react";
import {
  COMMERCIAL_PROJECT_SUB_CATEGORIES,
  isServiceProjectSubCategory,
  subCategoryForServiceArea,
} from "@/lib/project-subcategory";
import type { ProjectServiceAreaValue } from "@/lib/service-area";
import {
  DEFAULT_CONTRACT_DURATION_MONTHS,
  DEFAULT_PROJECT_DURATION_DAYS,
  isContractSubCategory,
  todayDateInput,
  usesMonthDurationTimeline,
} from "@/lib/project-contract";
import {
  DEFAULT_MILESTONE_PAYMENTS,
  defaultBillingMode,
  isMilestoneSubCategory,
  MILESTONE_ELIGIBLE_BILLING_MODES,
  splitEvenlyPercents,
} from "@/lib/project-billing";
import type {
  BillingMode,
  BillingPeriodBasis,
  ProjectSubCategory,
} from "@prisma/client";
import { taxInvoiceDefaultsFromClient } from "@/lib/npwp";
import { localizeBillingMode, localizeSubCategory } from "@/lib/i18n/labels";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type Client = {
  id: string;
  name: string;
  npwp?: string | null;
  paymentTermsDays?: number | null;
};

type InitialStatus = "PLANNED" | "IN_PROGRESS";

type Props = DirectoryDialogControlProps & {
  employees: ProjectStaffEmployee[];
  clients: Client[];
};

const FORM_ID = "create-project-form";

export default function ProjectDialog({
  employees,
  clients,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t, locale } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  const initialStatusOptions = useMemo(
    () => [
      { value: "PLANNED" as const, label: t("pages.projects.planningTitle") },
      {
        value: "IN_PROGRESS" as const,
        label: t("pages.projects.inProgressTitle"),
      },
    ],
    [t]
  );

  const subcategoryOptions = useMemo(
    () =>
      COMMERCIAL_PROJECT_SUB_CATEGORIES.map((value) => ({
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

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [requiresTaxInvoice, setRequiresTaxInvoice] = useState(
    () => taxInvoiceDefaultsFromClient(clients[0]).requiresTaxInvoice
  );
  const [npwp, setNpwp] = useState(
    () => taxInvoiceDefaultsFromClient(clients[0]).npwp
  );
  // Always open Create on Planning; user may switch Starting Stage to In Progress.
  const [initialStatus, setInitialStatus] = useState<InitialStatus>("PLANNED");
  const [subCategory, setSubCategory] =
    useState<ProjectSubCategory>("REGULAR_CLEANING");
  const [serviceArea, setServiceArea] = useState<ProjectServiceAreaValue>("CLEANING");
  const [billingMode, setBillingMode] = useState<BillingMode>(
    defaultBillingMode("REGULAR_CLEANING")
  );
  const [billingPeriodBasis, setBillingPeriodBasis] =
    useState<BillingPeriodBasis>("CONTRACT_CYCLE");
  const [paymentCount, setPaymentCount] = useState(DEFAULT_MILESTONE_PAYMENTS);
  const [installmentPercents, setInstallmentPercents] = useState(() =>
    splitEvenlyPercents(DEFAULT_MILESTONE_PAYMENTS)
  );
  const [startDate, setStartDate] = useState(todayDateInput);
  const [durationMonths, setDurationMonths] = useState(
    DEFAULT_CONTRACT_DURATION_MONTHS
  );
  const [durationDays, setDurationDays] = useState(
    DEFAULT_PROJECT_DURATION_DAYS
  );
  const [locationValue, setLocationValue] = useState<LocationValue>({
    location: "",
    latitude: null,
    longitude: null,
    locationRadiusMeters: DEFAULT_LOCATION_RADIUS_METERS,
  });
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);
  const isBusy = pending || submitting;

  const isContract = isContractSubCategory(subCategory);
  const isService = isServiceProjectSubCategory(subCategory);
  const isMonthTimeline = usesMonthDurationTimeline(subCategory);
  const isMilestoneEligible = isMilestoneSubCategory(subCategory);
  const showPaymentPlan =
    isMilestoneEligible && billingMode === "MILESTONE";
  const selectedClient = clients.find((item) => item.id === clientId);

  const controlledSignature = useMemo(
    () =>
      JSON.stringify({
        clientId,
        npwp,
        initialStatus,
        subCategory,
        serviceArea,
        billingMode,
        billingPeriodBasis,
        paymentCount,
        installmentPercents,
        requiresTaxInvoice,
        startDate,
        durationMonths,
        durationDays,
        locationValue,
      }),
    [
      clientId,
      npwp,
      initialStatus,
      subCategory,
      serviceArea,
      billingMode,
      billingPeriodBasis,
      paymentCount,
      installmentPercents,
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
    FORM_ID,
    controlledSignature,
    baseline
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function resetPaymentPlan() {
    setPaymentCount(DEFAULT_MILESTONE_PAYMENTS);
    setInstallmentPercents(splitEvenlyPercents(DEFAULT_MILESTONE_PAYMENTS));
  }

  function applyTaxDefaultsFromClient(
    client: Client | undefined
  ) {
    const defaults = taxInvoiceDefaultsFromClient(client);
    setRequiresTaxInvoice(defaults.requiresTaxInvoice);
    setNpwp(defaults.npwp);
  }

  function resetForm() {
    const today = todayDateInput();
    const initialClient = clients[0];
    setClientId(initialClient?.id ?? "");
    applyTaxDefaultsFromClient(initialClient);
    setInitialStatus("PLANNED");
    setSubCategory("REGULAR_CLEANING");
    setServiceArea("CLEANING");
    setBillingMode(defaultBillingMode("REGULAR_CLEANING"));
    setBillingPeriodBasis("CONTRACT_CYCLE");
    resetPaymentPlan();
    setStartDate(today);
    setDurationMonths(DEFAULT_CONTRACT_DURATION_MONTHS);
    setDurationDays(DEFAULT_PROJECT_DURATION_DAYS);
    setLocationValue({
      location: "",
      latitude: null,
      longitude: null,
      locationRadiusMeters: DEFAULT_LOCATION_RADIUS_METERS,
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

  function handleSubCategoryChange(next: ProjectSubCategory) {
    setSubCategory(next);
    // Prevent invalid combos: Regular → MONTHLY only; General/Facade → default MILESTONE.
    const nextMode = defaultBillingMode(next);
    setBillingMode(nextMode);
    if (!isMilestoneSubCategory(next) || nextMode !== "MILESTONE") {
      resetPaymentPlan();
    }
    if (
      (isContractSubCategory(next) || usesMonthDurationTimeline(next)) &&
      !startDate
    ) {
      setStartDate(todayDateInput());
    }
  }

  function handleServiceAreaChange(next: ProjectServiceAreaValue) {
    setServiceArea(next);
    const locked = subCategoryForServiceArea(next);
    if (locked) {
      handleSubCategoryChange(locked);
      return;
    }
    // Switching back to Cleaning: keep a valid cleaning subcategory.
    if (!COMMERCIAL_PROJECT_SUB_CATEGORIES.includes(
      subCategory as (typeof COMMERCIAL_PROJECT_SUB_CATEGORIES)[number]
    )) {
      handleSubCategoryChange("REGULAR_CLEANING");
    }
  }

  function handleBillingModeChange(next: BillingMode) {
    setBillingMode(next);
    if (next !== "MILESTONE") {
      resetPaymentPlan();
    }
  }

  async function submit(formData: FormData) {
    formData.set("clientId", clientId);
    formData.set("initialStatus", initialStatus);
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

    // Drop plan fields unless this create is a General/Facade milestone project.
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

  const planSumOk =
    !showPaymentPlan ||
    Math.abs(
      installmentPercents.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) -
        100
    ) <= 0.01;

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
            <div className={employeeDialogFieldClass}>
              <label className="text-sm font-medium text-text">
                {t("pages.projects.projectName")}
              </label>
              <Input
                name="name"
                placeholder={t("pages.projects.projectName")}
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
              label={t("pages.projects.startingStage")}
              value={initialStatus}
              options={initialStatusOptions}
              onChange={setInitialStatus}
              columns={2}
            />

            <ProjectOptionPills
              label={t("pages.projects.serviceArea")}
              value={serviceArea}
              options={[
                { value: "CLEANING", label: t("pages.projects.serviceAreaCleaning") },
                { value: "PARKING", label: t("pages.projects.serviceAreaParking") },
                { value: "SECURITY", label: t("pages.projects.serviceAreaSecurity") },
                {
                  value: "PAYROLL_MANAGEMENT",
                  label: t("pages.projects.serviceAreaPayroll"),
                },
              ]}
              onChange={(value) =>
                handleServiceAreaChange(value as ProjectServiceAreaValue)
              }
              columns={2}
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
              <ProjectOptionPills
                label={t("pages.projects.billingLabel")}
                value={billingMode}
                options={generalFacadeBillingOptions}
                onChange={handleBillingModeChange}
                columns={2}
              />
            ) : null}

            {/* Regular Cleaning only — Security/Parking/Payroll have no period basis. */}
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

            {showPaymentPlan ? (
              <MilestonePaymentPlanFields
                paymentCount={paymentCount}
                installmentPercents={installmentPercents}
                onPaymentCountChange={setPaymentCount}
                onInstallmentPercentsChange={setInstallmentPercents}
              />
            ) : null}

            {isService ? (
              <ServiceCommercialFields
                key={`${subCategory}-${clientId}`}
                subCategory={subCategory}
                clientPaymentTermsDays={selectedClient?.paymentTermsDays}
              />
            ) : null}

            {requiresTaxInvoice ? (
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor="create-project-npwp"
                  className="text-sm font-medium text-text"
                >
                  {t("pages.projects.companyNpwp")}
                </label>
                <Input
                  id="create-project-npwp"
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

            {/* Timeline before map so estimated start stays visible for Planning. */}
            {isMonthTimeline ? (
              <ProjectTimelineFields
                mode="contract"
                planning={initialStatus === "PLANNED"}
                startDate={startDate}
                durationMonths={durationMonths}
                onStartDateChange={setStartDate}
                onDurationMonthsChange={setDurationMonths}
              />
            ) : isService ? (
              <div className={employeeDialogFieldClass}>
                <label className="text-sm font-medium text-text">
                  {initialStatus === "PLANNED"
                    ? t("pages.projects.timelineFields.contractStart")
                    : t("pages.projects.timelineFields.contractStart")}
                </label>
                <Input
                  name={
                    initialStatus === "PLANNED"
                      ? "estimatedStartDate"
                      : "startDate"
                  }
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={employeeInputClass}
                />
                <p className="text-xs text-subtle">
                  {t("pages.projects.serviceCommercial.payrollTimelineHint")}
                </p>
              </div>
            ) : (
              <ProjectTimelineFields
                mode="standard"
                planning={initialStatus === "PLANNED"}
                startDate={startDate}
                durationDays={durationDays}
                onStartDateChange={setStartDate}
                onDurationDaysChange={setDurationDays}
              />
            )}

            <LocationPicker value={locationValue} onChange={setLocationValue} />

            {initialStatus === "IN_PROGRESS" ? (
              <ProjectStaffPicker employees={employees} />
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
