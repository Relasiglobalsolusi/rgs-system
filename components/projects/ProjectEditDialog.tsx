"use client";

import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { updateProject } from "@/app/projects/actions";
import type { LocationValue } from "@/components/projects/LocationPicker";
import {
  clampLocationRadiusMeters,
  DEFAULT_LOCATION_RADIUS_METERS,
} from "@/lib/geo";

const LocationPicker = dynamic(
  () => import("@/components/projects/LocationPicker"),
  { ssr: false }
);
import BillingPeriodBasisFields from "@/components/projects/BillingPeriodBasisFields";
import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import ProjectShiftCountField from "@/components/projects/ProjectShiftCountField";
import ProjectStaffPicker, {
  type ProjectStaffEmployee,
} from "@/components/projects/ProjectStaffPicker";
import ProjectTeamPicker, {
  type ProjectTeamOption,
} from "@/components/projects/ProjectTeamPicker";
import ProjectTimelineFields from "@/components/projects/ProjectTimelineFields";
import PaymentTermsField from "@/components/billing/PaymentTermsField";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
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
import {
  isInternalProjectSubCategory,
  isServiceProjectSubCategory,
  subCategoryForServiceArea,
} from "@/lib/project-subcategory";
import {
  ONE_TIME_FORM_VALUE,
  formSubcategoryFromStored,
  storedSubCategoryFromForm,
  type CleaningOneTimeType,
} from "@/lib/project-form-subcategory";
import {
  billingSubCategoryForCatalog,
  catalogDisplayName,
  catalogSubsForAddProject,
  type ProjectCatalogAreaDTO,
} from "@/lib/project-service-catalog";
import { teamsForProjectServiceArea } from "@/lib/operations-team-kind";
import type { ProjectServiceAreaValue } from "@/lib/service-area";
import type { ProjectShiftWindow } from "@/lib/project-shifts";
import {
  DEFAULT_CONTRACT_DURATION_MONTHS,
  DEFAULT_PROJECT_DURATION_DAYS,
  clampProjectDurationDays,
  daysBetweenDates,
  isContractCycleSubCategory,
  isContractSubCategory,
  monthsBetweenDates,
  toDateInputValue,
  todayDateInput,
  usesMonthDurationTimeline,
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
import CommercialTaxKindField from "@/components/billing/CommercialTaxKindField";
import {
  commercialTaxRequiresOtherName,
  commercialTaxRequiresRatePercent,
  defaultCommercialNonVatRatePercent,
  isCommercialTaxKind,
  projectChargedTaxKindFromRecord,
  type CommercialTaxKind,
} from "@/lib/commercial-tax";
import { taxInvoiceDefaultsFromClient } from "@/lib/npwp";
import { cn } from "@/lib/utils";

type Client = {
  id: string;
  name: string;
  npwp?: string | null;
  paymentTermsDays?: number | null;
  payrollCutoffStartDay?: number | null;
  payrollCutoffEndDay?: number | null;
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
  serviceArea?: ProjectServiceAreaValue | "OTHER";
  areaCatalogId?: string | null;
  subcategoryCatalogId?: string | null;
  billingMode?: BillingMode;
  billingPeriodBasis?: BillingPeriodBasis | null;
  billingCycleStartDay?: number | null;
  billingCycleEndDay?: number | null;
  requiresTaxInvoice?: boolean;
  chargedTaxKind?: CommercialTaxKind | null;
  pphRatePercent?: number | null;
  otherTaxName?: string | null;
  contractPrice?: number | null;
  setupCost?: number | null;
  profitSharePercent?: number | null;
  monthlyClientFee?: number | null;
  serviceFeePercent?: number | null;
  paymentTermsDays?: number | null;
  bankAccountId?: string | null;
  payrollCutoffStartDay?: number | null;
  payrollCutoffEndDay?: number | null;
  payrollTaxPercent?: number | null;
  memberParkingUnitFee?: number | null;
  memberParkingUnitCount?: number | null;
  parkingTaxPercent?: number | null;
  clientId: string | null;
  /** When PLANNED, Edit hides Assign Staff (assignment happens at Move to In Progress). */
  status?: ProjectStatus | string;
  shiftCount?: number;
  shifts?: ProjectShiftWindow[];
  assignments: { employeeId: string }[];
  operationsTeamLinks?: { teamId: string }[];
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

function cycleDayFromDateInput(value: string): number {
  const day = Number(value.slice(8, 10));
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1;
}

function customCycleDaysForProject(project: Project): {
  fromDay: number;
  toDay: number;
} {
  if (
    project.billingCycleStartDay != null &&
    project.billingCycleEndDay != null
  ) {
    return {
      fromDay: project.billingCycleStartDay,
      toDay: project.billingCycleEndDay,
    };
  }
  const from =
    toDateInputValue(project.startDate) ||
    toDateInputValue(project.estimatedStartDate) ||
    todayDateInput();
  const day = cycleDayFromDateInput(from);
  return { fromDay: day, toDay: day };
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
  teams?: ProjectTeamOption[];
  assignedTeamIds?: string[];
  clients: Client[];
  catalog?: ProjectCatalogAreaDTO[];
  bankAccounts?: CompanyBankAccountOption[];
  /** Compact trigger for table rows; default matches project detail page. */
  compact?: boolean;
} & DirectoryDialogControlProps;

export default function ProjectEditDialog({
  project,
  employees,
  teams = [],
  assignedTeamIds,
  clients,
  catalog = [],
  bankAccounts = [],
  compact: _compact = false,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const { t, locale } = useT();
  const { open, setOpen } = useDirectoryDialogOpen(controlledOpen, onOpenChange);

  const isInternal = isInternalProjectSubCategory(project.subCategory);

  const generalFacadeBillingOptions = useMemo(
    () =>
      MILESTONE_ELIGIBLE_BILLING_MODES.map((value) => ({
        value,
        label: localizeBillingMode(value, locale),
      })),
    [locale]
  );

  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const storedForm = formSubcategoryFromStored(
    project.subCategory,
    project.serviceArea
  );
  const [serviceArea, setServiceArea] = useState<
    ProjectServiceAreaValue | "OTHER"
  >(project.serviceArea === "OTHER" ? "OTHER" : project.serviceArea ?? "CLEANING");
  const [areaCatalogId, setAreaCatalogId] = useState(
    () =>
      project.areaCatalogId ??
      catalog.find((area) => area.systemArea === (project.serviceArea ?? "CLEANING"))
        ?.id ??
      ""
  );
  const [uiSubcategory, setUiSubcategory] = useState(
    project.subcategoryCatalogId &&
      catalog
        .flatMap((area) => area.subcategories)
        .some((sub) => sub.id === project.subcategoryCatalogId && !sub.isSystem)
      ? project.subcategoryCatalogId
      : storedForm.uiSubcategory
  );
  const [oneTimeCleaningType, setOneTimeCleaningType] =
    useState<CleaningOneTimeType>(
      storedForm.oneTimeCleaningType || "GENERAL_CLEANING"
    );
  const [subcategoryCatalogId, setSubcategoryCatalogId] = useState(
    project.subcategoryCatalogId ?? ""
  );
  const selectedCatalogArea = useMemo(
    () =>
      catalog.find((area) => area.id === areaCatalogId) ??
      catalog.find((area) => area.systemArea === serviceArea) ??
      null,
    [areaCatalogId, catalog, serviceArea]
  );
  const selectedCustomSub = useMemo(
    () =>
      selectedCatalogArea?.subcategories.find(
        (sub) => sub.id === subcategoryCatalogId && !sub.isSystem
      ) ?? null,
    [selectedCatalogArea, subcategoryCatalogId]
  );
  const subCategory: ProjectSubCategory = isInternal
    ? "INTERNAL"
    : selectedCustomSub
      ? billingSubCategoryForCatalog({
          systemArea: selectedCatalogArea?.systemArea ?? serviceArea,
          billingKind: selectedCustomSub.billingKind,
          systemSubCategory: selectedCustomSub.systemSubCategory,
        })
      : storedSubCategoryFromForm({
          serviceArea,
          uiSubcategory,
          oneTimeCleaningType,
        }) ?? project.subCategory;
  const [billingMode, setBillingMode] = useState<BillingMode>(
    project.billingMode ?? defaultBillingMode(project.subCategory)
  );
  const [billingPeriodBasis, setBillingPeriodBasis] =
    useState<BillingPeriodBasis>(
      project.billingPeriodBasis ?? "CONTRACT_CYCLE"
    );
  const [billingCycleStartDay, setBillingCycleStartDay] = useState(
    () => customCycleDaysForProject(project).fromDay
  );
  const [billingCycleEndDay, setBillingCycleEndDay] = useState(
    () => customCycleDaysForProject(project).toDay
  );
  const [clientId, setClientId] = useState(
    project.clientId ?? clients[0]?.id ?? ""
  );
  const [chargedTaxKind, setChargedTaxKind] = useState<
    CommercialTaxKind | ""
  >(() => projectChargedTaxKindFromRecord(project));
  const [pphRatePercent, setPphRatePercent] = useState(() =>
    project.pphRatePercent != null ? String(project.pphRatePercent) : ""
  );
  const [otherTaxName, setOtherTaxName] = useState(
    () => project.otherTaxName ?? ""
  );
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
  const [shiftCount, setShiftCount] = useState(
    project.shiftCount && project.shiftCount >= 1 ? project.shiftCount : 1
  );
  const [locationValue, setLocationValue] = useState<LocationValue>({
    location: project.location ?? "",
    latitude: project.latitude,
    longitude: project.longitude,
    locationRadiusMeters: clampLocationRadiusMeters(
      project.locationRadiusMeters ?? DEFAULT_LOCATION_RADIUS_METERS
    ),
  });
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<HtmlFormDirtyBaseline | null>(null);

  const assignedIds = new Set(
    project.assignments.map((assignment) => assignment.employeeId)
  );
  const isContract = isContractSubCategory(subCategory);
  const isService = isServiceProjectSubCategory(subCategory);
  const isMonthTimeline = usesMonthDurationTimeline(subCategory);
  const isMilestoneEligible = isMilestoneSubCategory(subCategory);
  const selectedClient = clients.find((item) => item.id === clientId);
  const formId = `edit-project-form-${project.id}`;

  const controlledSignature = useMemo(
    () =>
      JSON.stringify({
        clientId,
        chargedTaxKind,
        pphRatePercent,
        otherTaxName,
        npwp,
        subCategory,
        serviceArea,
        billingMode,
        billingPeriodBasis,
        billingCycleStartDay,
        billingCycleEndDay,
        startDate,
        durationMonths,
        durationDays,
        locationValue,
        shiftCount,
      }),
    [
      clientId,
      chargedTaxKind,
      pphRatePercent,
      otherTaxName,
      npwp,
      subCategory,
      serviceArea,
      billingMode,
      billingPeriodBasis,
      billingCycleStartDay,
      billingCycleEndDay,
      startDate,
      durationMonths,
      durationDays,
      locationValue,
      shiftCount,
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
    setNpwp(defaults.npwp);
  }

  function resetFromProject() {
    const nextClientId = project.clientId ?? clients[0]?.id ?? "";
    const nextForm = formSubcategoryFromStored(
      project.subCategory,
      project.serviceArea
    );
    setServiceArea(
      project.serviceArea === "OTHER"
        ? "OTHER"
        : project.serviceArea ?? "CLEANING"
    );
    setAreaCatalogId(
      project.areaCatalogId ??
        catalog.find(
          (area) => area.systemArea === (project.serviceArea ?? "CLEANING")
        )?.id ??
        ""
    );
    setSubcategoryCatalogId(project.subcategoryCatalogId ?? "");
    setUiSubcategory(
      project.subcategoryCatalogId &&
        catalog
          .flatMap((area) => area.subcategories)
          .some((sub) => sub.id === project.subcategoryCatalogId && !sub.isSystem)
        ? project.subcategoryCatalogId
        : nextForm.uiSubcategory
    );
    setOneTimeCleaningType(nextForm.oneTimeCleaningType || "GENERAL_CLEANING");
    setBillingMode(
      project.billingMode ?? defaultBillingMode(project.subCategory)
    );
    setBillingPeriodBasis(project.billingPeriodBasis ?? "CONTRACT_CYCLE");
    const cycle = customCycleDaysForProject(project);
    setBillingCycleStartDay(cycle.fromDay);
    setBillingCycleEndDay(cycle.toDay);
    setClientId(nextClientId);
    setChargedTaxKind(projectChargedTaxKindFromRecord(project));
    setPphRatePercent(
      project.pphRatePercent != null ? String(project.pphRatePercent) : ""
    );
    setOtherTaxName(project.otherTaxName ?? "");
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
      locationRadiusMeters: clampLocationRadiusMeters(
      project.locationRadiusMeters ?? DEFAULT_LOCATION_RADIUS_METERS
    ),
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

  function applyResolvedSubCategory(next: ProjectSubCategory) {
    setBillingMode(defaultBillingMode(next));
    if (isContractSubCategory(next) || usesMonthDurationTimeline(next)) {
      if (!startDate) {
        setStartDate(todayDateInput());
      }
      if (durationMonths < 1) {
        setDurationMonths(DEFAULT_CONTRACT_DURATION_MONTHS);
      }
    }
  }

  function handleUiSubcategoryChange(next: string) {
    setUiSubcategory(next);
    setSubcategoryCatalogId("");
    if (next === ONE_TIME_FORM_VALUE && serviceArea === "CLEANING") {
      applyResolvedSubCategory(oneTimeCleaningType);
      return;
    }
    applyResolvedSubCategory(
      storedSubCategoryFromForm({
        serviceArea,
        uiSubcategory: next,
        oneTimeCleaningType,
      }) ?? project.subCategory
    );
  }

  function handleServiceAreaChange(
    next: ProjectServiceAreaValue | "OTHER",
    catalogId?: string
  ) {
    setServiceArea(next);
    setAreaCatalogId(
      catalogId ?? catalog.find((area) => area.systemArea === next)?.id ?? ""
    );
    setSubcategoryCatalogId("");
    const locked = subCategoryForServiceArea(next);
    if (locked) {
      setUiSubcategory(locked);
      applyResolvedSubCategory(locked);
      return;
    }
    if (next === "CLEANING") {
      setUiSubcategory("REGULAR_CLEANING");
      applyResolvedSubCategory("REGULAR_CLEANING");
      return;
    }
    if (next === "LANDSCAPING") {
      setUiSubcategory("REGULAR_LANDSCAPING");
      applyResolvedSubCategory("REGULAR_LANDSCAPING");
      return;
    }
    if (next === "SECURITY") {
      setUiSubcategory("SECURITY");
      applyResolvedSubCategory("SECURITY");
      return;
    }
    const nextArea = catalog.find((area) => area.id === catalogId);
    const first = nextArea ? catalogSubsForAddProject(nextArea)[0] : undefined;
    if (first && nextArea) {
      setSubcategoryCatalogId(first.id);
      setUiSubcategory(first.id);
      applyResolvedSubCategory(
        billingSubCategoryForCatalog({
          systemArea: nextArea.systemArea,
          billingKind: first.billingKind,
          systemSubCategory: first.systemSubCategory,
        })
      );
    }
  }

  async function submit(formData: FormData) {
    if (isInternal) {
      formData.set("clientId", "");
      formData.set("subCategory", "INTERNAL");
      formData.set("serviceArea", "HEAD_OFFICE");
      formData.set("billingMode", billingMode);
      formData.delete("billingPeriodBasis");
    } else {
      if (!isCommercialTaxKind(chargedTaxKind)) {
        showRejection({ reasons: t("pages.projects.chargedTaxKindRequired") });
        return;
      }
      if (chargedTaxKind === "OTHER" && !otherTaxName.trim()) {
        showRejection({ reasons: t("pages.billing.otherTaxNameRequired") });
        return;
      }
      if (
        commercialTaxRequiresRatePercent(chargedTaxKind) &&
        !pphRatePercent.trim()
      ) {
        showRejection({
          reasons:
            chargedTaxKind === "OTHER"
              ? t("pages.billing.otherTaxRateRequired")
              : t("pages.projects.pphRatePercentRequired"),
        });
        return;
      }
      formData.set("clientId", clientId);
      formData.set("subCategory", subCategory);
      formData.set("serviceArea", serviceArea);
      formData.set("areaCatalogId", areaCatalogId);
      formData.set("subcategoryCatalogId", subcategoryCatalogId);
      formData.set("billingMode", billingMode);
      formData.set("chargedTaxKind", chargedTaxKind);
      if (commercialTaxRequiresRatePercent(chargedTaxKind)) {
        formData.set("pphRatePercent", pphRatePercent);
      } else {
        formData.delete("pphRatePercent");
      }
      if (commercialTaxRequiresOtherName(chargedTaxKind)) {
        formData.set("otherTaxName", otherTaxName.trim());
      } else {
        formData.delete("otherTaxName");
      }
      if (isContractCycleSubCategory(subCategory)) {
        formData.set("billingPeriodBasis", billingPeriodBasis);
      } else {
        formData.delete("billingPeriodBasis");
      }
    }
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

            {!isInternal ? (
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
            ) : (
              <input type="hidden" name="clientId" value="" />
            )}

            {!isInternal ? (
              <ProjectOptionPills
                label={t("pages.projects.serviceArea")}
                value={areaCatalogId || serviceArea}
                options={
                  catalog.length > 0
                    ? catalog.map((area) => ({
                        value: area.id,
                        label: catalogDisplayName(area, locale),
                      }))
                    : [
                        {
                          value: "CLEANING",
                          label: t("pages.projects.serviceAreaCleaning"),
                        },
                        {
                          value: "LANDSCAPING",
                          label: t("pages.projects.serviceAreaLandscaping"),
                        },
                        {
                          value: "PARKING",
                          label: t("pages.projects.serviceAreaParking"),
                        },
                        {
                          value: "SECURITY",
                          label: t("pages.projects.serviceAreaSecurity"),
                        },
                        {
                          value: "PAYROLL_MANAGEMENT",
                          label: t("pages.projects.serviceAreaPayroll"),
                        },
                      ]
                }
                onChange={(value) => {
                  const area = catalog.find((item) => item.id === value);
                  if (area) {
                    handleServiceAreaChange(
                      area.systemArea === "OTHER" ||
                        area.systemArea === "HEAD_OFFICE"
                        ? "OTHER"
                        : (area.systemArea as ProjectServiceAreaValue),
                      area.id
                    );
                    return;
                  }
                  handleServiceAreaChange(value as ProjectServiceAreaValue);
                }}
                columns={2}
                spanLastWhenOdd
              />
            ) : null}

            {isInternal ? (
              <ProjectOptionPills
                label={t("pages.projects.subcategory")}
                value="INTERNAL"
                options={[
                  {
                    value: "INTERNAL",
                    label: localizeSubCategory("INTERNAL", locale),
                  },
                ]}
                onChange={() => undefined}
                columns={2}
              />
            ) : null}

            {!isInternal && serviceArea === "CLEANING" ? (
              <>
                <ProjectOptionPills
                  label={t("pages.projects.subcategory")}
                  value={uiSubcategory}
                  options={[
                    {
                      value: "REGULAR_CLEANING",
                      label: localizeSubCategory("REGULAR_CLEANING", locale),
                    },
                    {
                      value: "CONTRACT_GENERAL_CLEANING",
                      label: localizeSubCategory(
                        "CONTRACT_GENERAL_CLEANING",
                        locale
                      ),
                    },
                    {
                      value: "CONTRACT_FACADE_CLEANING",
                      label: localizeSubCategory(
                        "CONTRACT_FACADE_CLEANING",
                        locale
                      ),
                    },
                    {
                      value: ONE_TIME_FORM_VALUE,
                      label: t("pages.projects.oneTime"),
                    },
                    ...(selectedCatalogArea?.subcategories
                      .filter((sub) => !sub.isSystem)
                      .map((sub) => ({
                        value: sub.id,
                        label: catalogDisplayName(sub, locale),
                      })) ?? []),
                  ]}
                  onChange={(value) => {
                    const custom = selectedCatalogArea?.subcategories.find(
                      (sub) => sub.id === value && !sub.isSystem
                    );
                    if (custom) {
                      setSubcategoryCatalogId(value);
                      setUiSubcategory(value);
                      applyResolvedSubCategory(
                        billingSubCategoryForCatalog({
                          systemArea: selectedCatalogArea!.systemArea,
                          billingKind: custom.billingKind,
                          systemSubCategory: custom.systemSubCategory,
                        })
                      );
                      return;
                    }
                    handleUiSubcategoryChange(value);
                  }}
                  columns={2}
                />
                {uiSubcategory === ONE_TIME_FORM_VALUE && !selectedCustomSub ? (
                  <ProjectOptionPills
                    label={t("pages.projects.oneTimeType")}
                    value={oneTimeCleaningType}
                    options={[
                      {
                        value: "GENERAL_CLEANING",
                        label: localizeSubCategory("GENERAL_CLEANING", locale),
                      },
                      {
                        value: "FACADE_CLEANING",
                        label: localizeSubCategory("FACADE_CLEANING", locale),
                      },
                    ]}
                    onChange={(value) => {
                      const next = value as CleaningOneTimeType;
                      setOneTimeCleaningType(next);
                      applyResolvedSubCategory(next);
                    }}
                    columns={2}
                  />
                ) : null}
              </>
            ) : null}

            {!isInternal && serviceArea === "LANDSCAPING" ? (
              <ProjectOptionPills
                label={t("pages.projects.subcategory")}
                value={uiSubcategory}
                options={[
                  {
                    value: "REGULAR_LANDSCAPING",
                    label: t("pages.projects.formRegular"),
                  },
                  ...(selectedCatalogArea?.allowsOneTime !== false
                    ? [
                        {
                          value: ONE_TIME_FORM_VALUE,
                          label: t("pages.projects.oneTime"),
                        },
                      ]
                    : []),
                ]}
                onChange={handleUiSubcategoryChange}
                columns={2}
              />
            ) : null}

            {!isInternal && serviceArea === "SECURITY" ? (
              <ProjectOptionPills
                label={t("pages.projects.subcategory")}
                value={uiSubcategory}
                options={[
                  {
                    value: "SECURITY",
                    label: t("pages.projects.formRegular"),
                  },
                  ...(selectedCatalogArea?.allowsOneTime !== false
                    ? [
                        {
                          value: ONE_TIME_FORM_VALUE,
                          label: t("pages.projects.oneTime"),
                        },
                      ]
                    : []),
                ]}
                onChange={handleUiSubcategoryChange}
                columns={2}
              />
            ) : null}

            {!isInternal && serviceArea === "OTHER" && selectedCatalogArea ? (
              <ProjectOptionPills
                label={t("pages.projects.subcategory")}
                value={uiSubcategory}
                options={catalogSubsForAddProject(selectedCatalogArea).map(
                  (sub) => ({
                    value: sub.id,
                    label: catalogDisplayName(sub, locale),
                  })
                )}
                onChange={(value) => {
                  const custom = selectedCatalogArea.subcategories.find(
                    (sub) => sub.id === value
                  );
                  if (!custom) return;
                  setSubcategoryCatalogId(value);
                  setUiSubcategory(value);
                  applyResolvedSubCategory(
                    billingSubCategoryForCatalog({
                      systemArea: selectedCatalogArea.systemArea,
                      billingKind: custom.billingKind,
                      systemSubCategory: custom.systemSubCategory,
                    })
                  );
                }}
                columns={2}
              />
            ) : null}

            {!isInternal && isMilestoneEligible ? (
              <>
                <ProjectOptionPills
                  label={t("pages.projects.billingLabel")}
                  value={billingMode}
                  options={generalFacadeBillingOptions}
                  onChange={setBillingMode}
                  columns={3}
                />
                {billingMode === "MILESTONE" ? (
                  <p className="rounded-xl border border-border bg-elevated/60 px-4 py-3 text-xs text-subtle">
                    {t("pages.projects.paymentPlan.scheduleLockedNote")}
                  </p>
                ) : null}
              </>
            ) : null}

            {!isInternal && isContractCycleSubCategory(subCategory) ? (
              <BillingPeriodBasisFields
                billingPeriodBasis={billingPeriodBasis}
                onBillingPeriodBasisChange={setBillingPeriodBasis}
                fromDay={billingCycleStartDay}
                toDay={billingCycleEndDay}
                onFromDayChange={setBillingCycleStartDay}
                onToDayChange={setBillingCycleEndDay}
              />
            ) : null}

            {!isInternal && isService ? (
              <ServiceCommercialFields
                key={`${subCategory}-${clientId}-${open ? "open" : "closed"}`}
                subCategory={subCategory}
                defaults={{
                  contractPrice: project.contractPrice,
                  setupCost: project.setupCost,
                  profitSharePercent: project.profitSharePercent,
                  monthlyClientFee: project.monthlyClientFee,
                  serviceFeePercent: project.serviceFeePercent,
                  payrollCutoffStartDay: project.payrollCutoffStartDay,
                  payrollCutoffEndDay: project.payrollCutoffEndDay,
                  payrollTaxPercent: project.payrollTaxPercent,
                  memberParkingUnitFee: project.memberParkingUnitFee,
                  memberParkingUnitCount: project.memberParkingUnitCount,
                  parkingTaxPercent: project.parkingTaxPercent,
                  paymentTermsDays: project.paymentTermsDays,
                }}
              />
            ) : null}

            {!isInternal && subCategory !== "PARKING" ? (
              <PaymentTermsField
                defaultValue={project.paymentTermsDays ?? 14}
              />
            ) : null}

            {!isInternal ? (
              <CompanyBankAccountField
                accounts={bankAccounts}
                defaultValue={project.bankAccountId ?? bankAccounts[0]?.id ?? ""}
              />
            ) : null}

            {!isInternal ? (
              <CommercialTaxKindField
                id={`edit-project-charged-tax-${project.id}`}
                name="chargedTaxKind"
                value={chargedTaxKind}
                onChange={(next) => {
                  setChargedTaxKind(next);
                  const nextRate = defaultCommercialNonVatRatePercent(next || null);
                  setPphRatePercent(nextRate != null ? String(nextRate) : "");
                  if (next !== "OTHER") setOtherTaxName("");
                }}
                label={t("pages.projects.chargedTaxKind")}
                hint={t("pages.projects.chargedTaxKindHint")}
                placeholder={t("pages.projects.chargedTaxKindPlaceholder")}
              />
            ) : null}

            {!isInternal &&
            chargedTaxKind &&
            commercialTaxRequiresOtherName(chargedTaxKind) ? (
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor={`edit-project-other-tax-${project.id}`}
                  className="text-sm font-medium text-text"
                >
                  {t("pages.billing.otherTaxName")}
                  <span className="text-red-400"> *</span>
                </label>
                <Input
                  id={`edit-project-other-tax-${project.id}`}
                  name="otherTaxName"
                  required
                  value={otherTaxName}
                  onChange={(event) => setOtherTaxName(event.target.value)}
                  placeholder={t("pages.billing.otherTaxNamePlaceholder")}
                  className={employeeInputClass}
                />
                <p className="text-xs text-subtle">
                  {t("pages.billing.otherTaxNameHint")}
                </p>
              </div>
            ) : null}

            {!isInternal &&
            chargedTaxKind &&
            commercialTaxRequiresRatePercent(chargedTaxKind) ? (
              <div className={employeeDialogFieldClass}>
                <label
                  htmlFor={`edit-project-pph-rate-${project.id}`}
                  className="text-sm font-medium text-text"
                >
                  {chargedTaxKind === "OTHER"
                    ? t("pages.billing.otherTaxRate")
                    : t("pages.projects.pphRatePercent")}
                  <span className="text-red-400"> *</span>
                </label>
                <Input
                  id={`edit-project-pph-rate-${project.id}`}
                  name="pphRatePercent"
                  required
                  inputMode="decimal"
                  value={pphRatePercent}
                  onChange={(event) => setPphRatePercent(event.target.value)}
                  placeholder={
                    chargedTaxKind === "OTHER"
                      ? t("pages.billing.otherTaxRatePlaceholder")
                      : t("pages.projects.pphRatePercentPlaceholder")
                  }
                  className={employeeInputClass}
                />
                <p className="text-xs text-subtle">
                  {chargedTaxKind === "OTHER"
                    ? t("pages.billing.otherTaxRateHint")
                    : t("pages.projects.pphRatePercentHint")}
                </p>
              </div>
            ) : null}

            {!isInternal ? (
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
                  {npwp
                    ? t("pages.projects.companyNpwpHint")
                    : t("pages.projects.withoutTaxNote")}
                </p>
              </div>
            ) : null}

            {isInternal ? (
              <p className="text-xs leading-relaxed text-subtle">
                {t("pages.projects.locationPicker.internalCicoHint")}
              </p>
            ) : null}
            <LocationPicker value={locationValue} onChange={setLocationValue} />

            <ProjectShiftCountField
              value={shiftCount}
              onChange={setShiftCount}
              windows={project.shifts}
            />

            {!isInternal ? (
              isMonthTimeline ? (
                <ProjectTimelineFields
                  mode="contract"
                  planning={isPlanningProjectStatus(project.status)}
                  startDate={startDate}
                  durationMonths={durationMonths}
                  onStartDateChange={setStartDate}
                  onDurationMonthsChange={setDurationMonths}
                />
              ) : isService ? (
                <div className={employeeDialogFieldClass}>
                  <label className="text-sm font-medium text-text">
                    {t("pages.projects.timelineFields.contractStart")}
                  </label>
                  <Input
                    name={
                      isPlanningProjectStatus(project.status)
                        ? "estimatedStartDate"
                        : "startDate"
                    }
                    type="date"
                    required
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className={employeeInputClass}
                  />
                </div>
              ) : (
                <ProjectTimelineFields
                  mode="standard"
                  planning={isPlanningProjectStatus(project.status)}
                  startDate={startDate}
                  durationDays={durationDays}
                  onStartDateChange={setStartDate}
                  onDurationDaysChange={setDurationDays}
                />
              )
            ) : null}

            {!isPlanningProjectStatus(project.status) ? (
              <>
                <ProjectTeamPicker
                  teams={teamsForProjectServiceArea(teams, {
                    areaCatalogId,
                    serviceArea,
                    subCategory,
                  })}
                  defaultCheckedIds={
                    assignedTeamIds ??
                    (project.operationsTeamLinks ?? []).map(
                      (link) => link.teamId
                    )
                  }
                />
                <ProjectStaffPicker
                  employees={employees}
                  defaultCheckedIds={assignedIds}
                />
              </>
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
