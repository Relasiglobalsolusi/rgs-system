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
import ExclusiveContractPriceField from "@/components/projects/ExclusiveContractPriceField";
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
  isRgsInternalProject,
  projectUsesNamedShifts,
  isServiceProjectSubCategory,
  subCategoryForServiceArea,
} from "@/lib/project-subcategory";
import {
  ONE_TIME_FORM_VALUE,
  formSubcategoryFromStored,
  isCleaningOneTimeType,
  storedSubCategoryFromForm,
  type CleaningOneTimeType,
} from "@/lib/project-form-subcategory";
import {
  billingSubCategoryForCatalog,
  catalogDisplayName,
  catalogSubsForAddProject,
  findMaintenanceCatalogArea,
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
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import ProjectChargedTaxFields from "@/components/projects/ProjectChargedTaxFields";
import {
  commercialTaxRequiresOtherName,
  commercialTaxRequiresRatePercent,
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
  isGovernmentContract?: boolean;
  isDemo?: boolean;
  isComplimentary?: boolean;
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

  const isInternal = isRgsInternalProject(project);

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
  const [isGovernmentContract, setIsGovernmentContract] = useState(
    () => Boolean(project.isGovernmentContract)
  );
  const [isDemoChoice, setIsDemoChoice] = useState<YesNoChoice>(
    project.isDemo ? "Yes" : "No"
  );
  const [isComplimentaryChoice, setIsComplimentaryChoice] =
    useState<YesNoChoice>(project.isComplimentary ? "Yes" : "No");
  const isDemo = isDemoChoice === "Yes";
  const isComplimentary = isDemo && isComplimentaryChoice === "Yes";
  const generalFacadeBillingOptions = useMemo(
    () =>
      MILESTONE_ELIGIBLE_BILLING_MODES.filter(
        (value) => !isDemo || value !== "MULTI_VISIT"
      ).map((value) => ({
        value,
        label: localizeBillingMode(value, locale),
      })),
    [isDemo, locale]
  );
  const showBillingFields = !isComplimentary;
  const maintenanceCatalog = useMemo(
    () => findMaintenanceCatalogArea(catalog),
    [catalog]
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
  const isService = isServiceProjectSubCategory(subCategory);
  const isMonthTimeline = usesMonthDurationTimeline(subCategory);
  const isMilestoneEligible = isMilestoneSubCategory(subCategory);
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
        isDemo,
        isComplimentary,
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
      isDemo,
      isComplimentary,
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
    setIsDemoChoice(project.isDemo ? "Yes" : "No");
    setIsComplimentaryChoice(project.isComplimentary ? "Yes" : "No");
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
    if (isDemo) {
      if (next === "CLEANING") {
        setUiSubcategory("GENERAL_CLEANING");
        setOneTimeCleaningType("GENERAL_CLEANING");
        applyResolvedSubCategory("GENERAL_CLEANING");
        return;
      }
      if (next === "LANDSCAPING") {
        setUiSubcategory(ONE_TIME_FORM_VALUE);
        applyResolvedSubCategory("ONE_TIME_LANDSCAPING");
        return;
      }
      const nextArea = catalog.find((area) => area.id === catalogId);
      const oneTimeSub = nextArea?.subcategories.find(
        (sub) => sub.billingKind === "ONE_TIME"
      );
      if (oneTimeSub && nextArea) {
        setSubcategoryCatalogId(oneTimeSub.id);
        setUiSubcategory(oneTimeSub.id);
        applyResolvedSubCategory(
          billingSubCategoryForCatalog({
            systemArea: nextArea.systemArea,
            billingKind: oneTimeSub.billingKind,
            systemSubCategory: oneTimeSub.systemSubCategory,
          })
        );
        return;
      }
      setUiSubcategory("GENERAL_CLEANING");
      applyResolvedSubCategory("GENERAL_CLEANING");
      return;
    }
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
      const resolvedTaxKind = isCommercialTaxKind(chargedTaxKind)
        ? chargedTaxKind
        : null;
      if (!isComplimentary && !resolvedTaxKind) {
        showRejection({ reasons: t("pages.projects.chargedTaxKindRequired") });
        return;
      }
      if (
        !isComplimentary &&
        resolvedTaxKind === "OTHER" &&
        !otherTaxName.trim()
      ) {
        showRejection({ reasons: t("pages.billing.otherTaxNameRequired") });
        return;
      }
      if (
        !isComplimentary &&
        resolvedTaxKind &&
        commercialTaxRequiresRatePercent(resolvedTaxKind) &&
        !pphRatePercent.trim()
      ) {
        showRejection({
          reasons:
            resolvedTaxKind === "OTHER"
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
      if (isComplimentary) {
        formData.delete("chargedTaxKind");
        formData.delete("pphRatePercent");
        formData.delete("otherTaxName");
      } else if (resolvedTaxKind) {
        formData.set("chargedTaxKind", resolvedTaxKind);
      }
      formData.set(
        "isGovernmentContract",
        isGovernmentContract ? "true" : "false"
      );
      formData.set("isDemo", isDemo ? "true" : "false");
      formData.set("isComplimentary", isComplimentary ? "true" : "false");
      if (!isComplimentary && resolvedTaxKind) {
        if (commercialTaxRequiresRatePercent(resolvedTaxKind)) {
          formData.set("pphRatePercent", pphRatePercent);
        } else {
          formData.delete("pphRatePercent");
        }
        if (commercialTaxRequiresOtherName(resolvedTaxKind)) {
          formData.set("otherTaxName", otherTaxName.trim());
        } else {
          formData.delete("otherTaxName");
        }
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
            {!isInternal ? (
              <>
                <div className={employeeDialogFieldClass}>
                  <label
                    id={`edit-project-is-demo-${project.id}`}
                    className="text-sm font-medium text-text"
                  >
                    {t("pages.projects.isDemo")}
                  </label>
                  <YesNoChoiceCards
                    id={`edit-project-is-demo-${project.id}`}
                    labelledBy={`edit-project-is-demo-${project.id}`}
                    value={isDemoChoice}
                    onChange={(next) => {
                      setIsDemoChoice(next);
                      if (next === "No") {
                        setIsComplimentaryChoice("No");
                        return;
                      }
                      if (billingMode === "MULTI_VISIT") {
                        setBillingMode("ON_COMPLETION");
                      }
                      setServiceArea("CLEANING");
                      setAreaCatalogId(
                        catalog.find((area) => area.systemArea === "CLEANING")
                          ?.id ?? ""
                      );
                      setSubcategoryCatalogId("");
                      setUiSubcategory("GENERAL_CLEANING");
                      setOneTimeCleaningType("GENERAL_CLEANING");
                      applyResolvedSubCategory("GENERAL_CLEANING");
                    }}
                  />
                  <p className="text-xs text-subtle">
                    {t("pages.projects.isDemoHint")}
                  </p>
                </div>
                {isDemo ? (
                  <div className={employeeDialogFieldClass}>
                    <label
                      id={`edit-project-is-demo-free-${project.id}`}
                      className="text-sm font-medium text-text"
                    >
                      {t("pages.projects.isDemoFree")}
                    </label>
                    <YesNoChoiceCards
                      id={`edit-project-is-demo-free-${project.id}`}
                      labelledBy={`edit-project-is-demo-free-${project.id}`}
                      value={isComplimentaryChoice}
                      onChange={setIsComplimentaryChoice}
                    />
                    <p className="text-xs text-subtle">
                      {t("pages.projects.isDemoFreeHint")}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}

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
                value={
                  isDemo
                    ? serviceArea === "OTHER" ||
                      (maintenanceCatalog &&
                        areaCatalogId === maintenanceCatalog.id)
                      ? maintenanceCatalog?.id ?? "MAINTENANCE"
                      : areaCatalogId || serviceArea
                    : areaCatalogId || serviceArea
                }
                options={
                  isDemo
                    ? [
                        {
                          value:
                            catalog.find((area) => area.systemArea === "CLEANING")
                              ?.id ?? "CLEANING",
                          label: t("pages.projects.serviceAreaCleaning"),
                        },
                        {
                          value:
                            catalog.find(
                              (area) => area.systemArea === "LANDSCAPING"
                            )?.id ?? "LANDSCAPING",
                          label: t("pages.projects.serviceAreaLandscaping"),
                        },
                        {
                          value: maintenanceCatalog?.id ?? "MAINTENANCE",
                          label: t("pages.projects.serviceAreaMaintenance"),
                        },
                      ]
                    : catalog.length > 0
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
                  if (value === "MAINTENANCE" || value === maintenanceCatalog?.id) {
                    const nextArea =
                      !maintenanceCatalog ||
                      maintenanceCatalog.systemArea === "OTHER" ||
                      maintenanceCatalog.systemArea === "HEAD_OFFICE"
                        ? "OTHER"
                        : (maintenanceCatalog.systemArea as ProjectServiceAreaValue);
                    handleServiceAreaChange(nextArea, maintenanceCatalog?.id);
                    return;
                  }
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
                  options={
                    isDemo
                      ? [
                          {
                            value: "GENERAL_CLEANING",
                            label: localizeSubCategory(
                              "GENERAL_CLEANING",
                              locale
                            ),
                          },
                          {
                            value: "FACADE_CLEANING",
                            label: localizeSubCategory(
                              "FACADE_CLEANING",
                              locale
                            ),
                          },
                        ]
                      : [
                    {
                      value: "REGULAR_CLEANING",
                      label: localizeSubCategory("REGULAR_CLEANING", locale),
                    },
                    {
                      value: "GENERAL_CLEANING",
                      label: localizeSubCategory("GENERAL_CLEANING", locale),
                    },
                    {
                      value: "FACADE_CLEANING",
                      label: localizeSubCategory("FACADE_CLEANING", locale),
                    },
                    ...(uiSubcategory === "CONTRACT_GENERAL_CLEANING"
                      ? [
                          {
                            value: "CONTRACT_GENERAL_CLEANING",
                            label: localizeSubCategory(
                              "CONTRACT_GENERAL_CLEANING",
                              locale
                            ),
                          },
                        ]
                      : []),
                    ...(uiSubcategory === "CONTRACT_FACADE_CLEANING"
                      ? [
                          {
                            value: "CONTRACT_FACADE_CLEANING",
                            label: localizeSubCategory(
                              "CONTRACT_FACADE_CLEANING",
                              locale
                            ),
                          },
                        ]
                      : []),
                    ...(selectedCatalogArea?.subcategories
                      .filter((sub) => !sub.isSystem)
                      .map((sub) => ({
                        value: sub.id,
                        label: catalogDisplayName(sub, locale),
                      })) ?? []),
                  ]
                  }
                  onChange={(value) => {
                    if (isDemo && isCleaningOneTimeType(value)) {
                      setOneTimeCleaningType(value);
                      setUiSubcategory(value);
                      applyResolvedSubCategory(value);
                      return;
                    }
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
                  spanLastWhenOdd
                />
              </>
            ) : null}

            {!isInternal && serviceArea === "LANDSCAPING" && !isDemo ? (
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

            {!isInternal &&
            serviceArea === "OTHER" &&
            selectedCatalogArea &&
            !isDemo ? (
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

            {!isInternal && showBillingFields && isMilestoneEligible ? (
              <>
                <ProjectOptionPills
                  label={t("pages.projects.billingLabel")}
                  value={billingMode}
                  options={generalFacadeBillingOptions}
                  onChange={setBillingMode}
                />
                {billingMode === "MILESTONE" ? (
                  <p className="rounded-xl border border-border bg-elevated/60 px-4 py-3 text-xs text-subtle">
                    {t("pages.projects.paymentPlan.scheduleLockedNote")}
                  </p>
                ) : null}
              </>
            ) : null}

            {!isInternal &&
            showBillingFields &&
            isContractCycleSubCategory(subCategory) ? (
              <BillingPeriodBasisFields
                billingPeriodBasis={billingPeriodBasis}
                onBillingPeriodBasisChange={setBillingPeriodBasis}
                fromDay={billingCycleStartDay}
                toDay={billingCycleEndDay}
                onFromDayChange={setBillingCycleStartDay}
                onToDayChange={setBillingCycleEndDay}
              />
            ) : null}

            {!isInternal && showBillingFields && isService ? (
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

            {!isInternal && showBillingFields && subCategory !== "PARKING" ? (
              <PaymentTermsField
                defaultValue={project.paymentTermsDays ?? 14}
              />
            ) : null}

            {!isInternal && showBillingFields ? (
              <CompanyBankAccountField
                accounts={bankAccounts}
                defaultValue={project.bankAccountId ?? bankAccounts[0]?.id ?? ""}
              />
            ) : null}

            {!isInternal && showBillingFields ? (
              <ProjectChargedTaxFields
                id={`edit-project-charged-tax-${project.id}`}
                name="chargedTaxKind"
                value={chargedTaxKind}
                onChange={(next) => {
                  setChargedTaxKind(next);
                  if (next !== "OTHER") setOtherTaxName("");
                }}
                onRatePrefill={setPphRatePercent}
              />
            ) : null}

            {!isInternal && showBillingFields ? (
              <div className={employeeDialogFieldClass}>
                <label className="inline-flex items-start gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    name="isGovernmentContract"
                    value="true"
                    checked={isGovernmentContract}
                    onChange={(event) =>
                      setIsGovernmentContract(event.target.checked)
                    }
                    className="mt-0.5 size-4 rounded border-border"
                  />
                  <span>
                    {t("pages.projects.governmentContract")}
                    <span className="mt-1 block text-xs text-muted">
                      {t("pages.projects.governmentContractHint")}
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

            {!isInternal &&
            showBillingFields &&
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
            showBillingFields &&
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

            {!isInternal && showBillingFields && !isService ? (
              <ExclusiveContractPriceField
                id={`edit-project-contract-price-${project.id}`}
                defaultValue={project.contractPrice}
              />
            ) : null}

            {!isInternal && showBillingFields ? (
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

            {projectUsesNamedShifts(subCategory) ? (
              <ProjectShiftCountField
                value={shiftCount}
                onChange={setShiftCount}
                windows={project.shifts}
              />
            ) : (
              <input type="hidden" name="shiftCount" value="0" />
            )}

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
