"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import type { LocationValue } from "@/components/projects/LocationPicker";
import MilestonePaymentPlanFields from "@/components/projects/MilestonePaymentPlanFields";
import ProjectTeamPicker, {
  type ProjectTeamOption,
} from "@/components/projects/ProjectTeamPicker";
import VisitPlanFields, {
  type VisitWindowDraft,
} from "@/components/projects/VisitPlanFields";
import BillingPeriodBasisFields from "@/components/projects/BillingPeriodBasisFields";
import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import ProjectShiftCountField from "@/components/projects/ProjectShiftCountField";
import ProjectStaffPicker, {
  type ProjectStaffEmployee,
} from "@/components/projects/ProjectStaffPicker";
import ProjectTimelineFields from "@/components/projects/ProjectTimelineFields";
import PaymentTermsField from "@/components/billing/PaymentTermsField";
import CompanyBankAccountField from "@/components/company-details/CompanyBankAccountField";
import type { CompanyBankAccountOption } from "@/lib/company-bank-accounts";
import ExclusiveContractPriceField from "@/components/projects/ExclusiveContractPriceField";
import ServiceCommercialFields from "@/components/projects/ServiceCommercialFields";
import {
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
import { FileDropField } from "@/components/ui/FileDropField";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_LOCATION_RADIUS_METERS } from "@/lib/geo";
import { DEFAULT_NEW_PROJECT_SHIFTS } from "@/lib/project-shifts";
import {
  isLandscapingProjectSubCategory,
  isServiceProjectSubCategory,
  projectUsesNamedShifts,
  subCategoryForServiceArea,
} from "@/lib/project-subcategory";
import {
  ONE_TIME_FORM_VALUE,
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
import {
  DEFAULT_CONTRACT_DURATION_MONTHS,
  DEFAULT_PROJECT_DURATION_DAYS,
  isContractCycleSubCategory,
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
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import ProjectChargedTaxFields from "@/components/projects/ProjectChargedTaxFields";
import {
  commercialTaxRequiresOtherName,
  commercialTaxRequiresRatePercent,
  type CommercialTaxKind,
} from "@/lib/commercial-tax";
import { taxInvoiceDefaultsFromClient } from "@/lib/npwp";
import { HEAD_OFFICE_SITE } from "@/lib/company-identity";
import { localizeBillingMode, localizeSubCategory } from "@/lib/i18n/labels";
import {
  RGS_INTERNAL_CLIENT_FORM_VALUE,
  isRgsInternalClientFormValue,
} from "@/lib/attendance-internal-sites";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const LocationPicker = dynamic(
  () => import("@/components/projects/LocationPicker"),
  { ssr: false }
);

type FormServiceArea = ProjectServiceAreaValue | "OTHER";

export type ProjectFormClient = {
  id: string;
  name: string;
  npwp?: string | null;
  paymentTermsDays?: number | null;
};

export type ProjectFormInitialStatus = "PLANNED" | "IN_PROGRESS";

export type ProjectCatchUpIntake = YesNoChoice | "Completed";

export type ProjectFormFieldsState = {
  clientId: string;
  chargedTaxKind: CommercialTaxKind | "";
  otherTaxName: string;
  pphRatePercent: string;
  planSumOk: boolean;
  isService: boolean;
  isContract: boolean;
  isLandscaping: boolean;
  showPaymentPlan: boolean;
  initialStatus: ProjectFormInitialStatus;
  projectOngoing: ProjectCatchUpIntake;
  isDemo: boolean;
  isComplimentary: boolean;
  isInternal: boolean;
  controlledSignature: string;
};

type Props = {
  employees: ProjectStaffEmployee[];
  teams?: ProjectTeamOption[];
  clients: ProjectFormClient[];
  catalog?: ProjectCatalogAreaDTO[];
  bankAccounts?: CompanyBankAccountOption[];
  /** Prefix form field names (e.g. `line.0.`) for bulk create. */
  namePrefix?: string;
  /** Prefix element ids so multiple forms can sit on one page. */
  idPrefix?: string;
  /** First-month go-live intake. Hidden after books have been open ~31 days. */
  showCatchUpIntake?: boolean;
  onFormValuesChange?: () => void;
  onStateChange?: (state: ProjectFormFieldsState) => void;
};

export default function ProjectFormFields({
  employees,
  teams = [],
  clients,
  catalog = [],
  bankAccounts = [],
  namePrefix = "",
  idPrefix = "",
  showCatchUpIntake = true,
  onFormValuesChange,
  onStateChange,
}: Props) {
  const { t, locale } = useT();
  const nameOf = (field: string) =>
    namePrefix ? `${namePrefix}${field}` : field;
  const idOf = (id: string) => (idPrefix ? `${idPrefix}${id}` : id);

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

  const [serviceArea, setServiceArea] =
    useState<FormServiceArea>("CLEANING");
  const [areaCatalogId, setAreaCatalogId] = useState(
    () => catalog.find((area) => area.systemArea === "CLEANING")?.id ?? ""
  );
  const [uiSubcategory, setUiSubcategory] = useState("REGULAR_CLEANING");
  const [oneTimeCleaningType, setOneTimeCleaningType] =
    useState<CleaningOneTimeType>("GENERAL_CLEANING");
  const [subcategoryCatalogId, setSubcategoryCatalogId] = useState("");

  const [isDemoChoice, setIsDemoChoice] = useState<YesNoChoice>("No");
  const isDemoForBilling = isDemoChoice === "Yes";
  const generalFacadeBillingOptions = useMemo(
    () =>
      MILESTONE_ELIGIBLE_BILLING_MODES.filter(
        (value) => !isDemoForBilling || value !== "MULTI_VISIT"
      ).map((value) => ({
        value,
        label: localizeBillingMode(value, locale),
      })),
    [isDemoForBilling, locale]
  );

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [chargedTaxKind, setChargedTaxKind] = useState<
    CommercialTaxKind | ""
  >("");
  const [pphRatePercent, setPphRatePercent] = useState("");
  const [otherTaxName, setOtherTaxName] = useState("");
  const [npwp, setNpwp] = useState(
    () => taxInvoiceDefaultsFromClient(clients[0]).npwp
  );
  const [initialStatus, setInitialStatus] =
    useState<ProjectFormInitialStatus>("PLANNED");
  const [projectOngoing, setProjectOngoing] =
    useState<ProjectCatchUpIntake>("No");
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
  const subCategory: ProjectSubCategory = selectedCustomSub
    ? billingSubCategoryForCatalog({
        systemArea: selectedCatalogArea?.systemArea ?? serviceArea,
        billingKind: selectedCustomSub.billingKind,
        systemSubCategory: selectedCustomSub.systemSubCategory,
      })
    : storedSubCategoryFromForm({
        serviceArea,
        uiSubcategory,
        oneTimeCleaningType,
      }) ?? "REGULAR_CLEANING";
  const [billingMode, setBillingMode] = useState<BillingMode>(
    defaultBillingMode("REGULAR_CLEANING")
  );
  const [billingPeriodBasis, setBillingPeriodBasis] =
    useState<BillingPeriodBasis>("CONTRACT_CYCLE");
  const [billingCycleStartDay, setBillingCycleStartDay] = useState(() => {
    const day = Number(todayDateInput().slice(8, 10));
    return Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1;
  });
  const [billingCycleEndDay, setBillingCycleEndDay] = useState(() => {
    const day = Number(todayDateInput().slice(8, 10));
    return Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1;
  });
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
  const [visitWindows, setVisitWindows] = useState<VisitWindowDraft[]>([
    { startDate: "", endDate: "" },
    { startDate: "", endDate: "" },
  ]);
  const [shiftCount, setShiftCount] = useState(DEFAULT_NEW_PROJECT_SHIFTS);
  const [isGovernmentContract, setIsGovernmentContract] = useState(false);
  const [isComplimentaryChoice, setIsComplimentaryChoice] =
    useState<YesNoChoice>("No");
  const [internalMultipleVisit, setInternalMultipleVisit] =
    useState<YesNoChoice>("No");
  const isInternal = isRgsInternalClientFormValue(clientId);
  const isDemo = !isInternal && isDemoChoice === "Yes";
  const isComplimentary = isDemo && isComplimentaryChoice === "Yes";
  const maintenanceCatalog = useMemo(
    () => findMaintenanceCatalogArea(catalog),
    [catalog]
  );
  const showBillingFields = !isComplimentary && !isInternal;
  const catchUpStarted =
    showCatchUpIntake && !isInternal && !isDemo && projectOngoing === "Yes";
  const catchUpCompleted =
    showCatchUpIntake &&
    !isInternal &&
    !isDemo &&
    projectOngoing === "Completed";
  const catchUpHistorical = catchUpStarted || catchUpCompleted;
  const effectiveInitialStatus: ProjectFormInitialStatus = catchUpHistorical
    ? "IN_PROGRESS"
    : initialStatus;

  const isContract = isContractSubCategory(subCategory);
  const isLandscaping = isLandscapingProjectSubCategory(subCategory);
  const isService = isServiceProjectSubCategory(subCategory);
  const isMonthTimeline = usesMonthDurationTimeline(subCategory);
  const isMilestoneEligible = isMilestoneSubCategory(subCategory);
  useEffect(() => {
    if (projectOngoing === "Completed" && !isMilestoneEligible) {
      setProjectOngoing("No");
    }
  }, [isMilestoneEligible, projectOngoing]);
  const showPaymentPlan =
    isMilestoneEligible && billingMode === "MILESTONE" && !catchUpCompleted;
  const showVisitPlan =
    isMilestoneEligible && billingMode === "MULTI_VISIT" && !catchUpCompleted;
  const isMaintenanceArea = Boolean(
    maintenanceCatalog &&
      (areaCatalogId === maintenanceCatalog.id ||
        selectedCatalogArea?.id === maintenanceCatalog.id)
  );
  const selectedCatalogSub = selectedCatalogArea?.subcategories.find(
    (sub) => sub.id === uiSubcategory || sub.id === subcategoryCatalogId
  );
  const isInternalOneTimeSelection =
    uiSubcategory === ONE_TIME_FORM_VALUE ||
    selectedCatalogSub?.billingKind === "ONE_TIME";
  const showInternalMultipleVisitQuestion =
    isInternal &&
    isInternalOneTimeSelection &&
    (serviceArea === "LANDSCAPING" ||
      serviceArea === "SECURITY" ||
      isMaintenanceArea);
  const showInternalVisitPlan =
    showInternalMultipleVisitQuestion && internalMultipleVisit === "Yes";
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const planSumOk =
    !showPaymentPlan ||
    Math.abs(
      installmentPercents.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) -
        100
    ) <= 0.01;

  const controlledSignature = JSON.stringify({
    clientId,
    chargedTaxKind,
    pphRatePercent,
    otherTaxName,
    npwp,
    initialStatus,
    projectOngoing,
    subCategory,
    serviceArea,
    billingMode,
    billingPeriodBasis,
    billingCycleStartDay,
    billingCycleEndDay,
    paymentCount,
    installmentPercents,
    startDate,
    durationMonths,
    durationDays,
    locationValue,
    visitWindows,
    isDemo,
    isComplimentary,
  });

  useLayoutEffect(() => {
    onStateChangeRef.current?.({
      clientId,
      chargedTaxKind,
      otherTaxName,
      pphRatePercent,
      planSumOk,
      isService,
      isContract,
      isLandscaping,
      showPaymentPlan,
      initialStatus,
      projectOngoing,
      isDemo,
      isComplimentary,
      isInternal,
      controlledSignature,
    });
  }, [
    clientId,
    chargedTaxKind,
    otherTaxName,
    pphRatePercent,
    planSumOk,
    isService,
    isContract,
    isLandscaping,
    showPaymentPlan,
    initialStatus,
    projectOngoing,
    isDemo,
    isComplimentary,
    isInternal,
    controlledSignature,
  ]);

  function resetPaymentPlan() {
    setPaymentCount(DEFAULT_MILESTONE_PAYMENTS);
    setInstallmentPercents(splitEvenlyPercents(DEFAULT_MILESTONE_PAYMENTS));
  }

  function applyTaxDefaultsFromClient(client: ProjectFormClient | undefined) {
    setNpwp(taxInvoiceDefaultsFromClient(client).npwp);
  }

  function handleClientChange(value: string | null) {
    const nextId = value === "none" || value == null ? "" : value;
    setClientId(nextId);
    if (isRgsInternalClientFormValue(nextId)) {
      setIsDemoChoice("No");
      setIsComplimentaryChoice("No");
      setInitialStatus("IN_PROGRESS");
      setLocationValue({
        location: HEAD_OFFICE_SITE.address,
        latitude: HEAD_OFFICE_SITE.latitude,
        longitude: HEAD_OFFICE_SITE.longitude,
        locationRadiusMeters: DEFAULT_LOCATION_RADIUS_METERS,
      });
    }
    applyTaxDefaultsFromClient(clients.find((item) => item.id === nextId));
    onFormValuesChange?.();
  }

  function applyResolvedSubCategory(next: ProjectSubCategory) {
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
    onFormValuesChange?.();
  }

  function handleUiSubcategoryChange(next: string) {
    setUiSubcategory(next);
    setSubcategoryCatalogId("");
    if (next !== ONE_TIME_FORM_VALUE) {
      setInternalMultipleVisit("No");
    }
    if (next === ONE_TIME_FORM_VALUE && serviceArea === "CLEANING") {
      applyResolvedSubCategory(oneTimeCleaningType);
      return;
    }
    const resolved =
      storedSubCategoryFromForm({
        serviceArea,
        uiSubcategory: next,
        oneTimeCleaningType,
      }) ?? "REGULAR_CLEANING";
    applyResolvedSubCategory(resolved);
  }

  function handleCustomSubcategoryChange(subId: string) {
    const row = selectedCatalogArea?.subcategories.find((item) => item.id === subId);
    setSubcategoryCatalogId(subId);
    setUiSubcategory(subId);
    if (!row || !selectedCatalogArea) return;
    applyResolvedSubCategory(
      billingSubCategoryForCatalog({
        systemArea: selectedCatalogArea.systemArea,
        billingKind: row.billingKind,
        systemSubCategory: row.systemSubCategory,
      })
    );
  }

  function handleOneTimeCleaningTypeChange(next: CleaningOneTimeType) {
    setOneTimeCleaningType(next);
    applyResolvedSubCategory(next);
  }

  function applyDemoServiceArea(next: FormServiceArea, catalogId?: string) {
    setServiceArea(next);
    setAreaCatalogId(
      catalogId ?? catalog.find((area) => area.systemArea === next)?.id ?? ""
    );
    setSubcategoryCatalogId("");
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
  }

  function handleDemoChoiceChange(next: YesNoChoice) {
    setIsDemoChoice(next);
    if (next === "No") {
      setIsComplimentaryChoice("No");
      return;
    }
    if (billingMode === "MULTI_VISIT") {
      setBillingMode("ON_COMPLETION");
    }
    applyDemoServiceArea("CLEANING");
  }

  function handleServiceAreaChange(next: FormServiceArea, catalogId?: string) {
    if (isDemo) {
      applyDemoServiceArea(next, catalogId);
      return;
    }
    setServiceArea(next);
    setAreaCatalogId(
      catalogId ??
        catalog.find((area) => area.systemArea === next)?.id ??
        ""
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
    const firstCustom = nextArea
      ? catalogSubsForAddProject(nextArea)[0]
      : undefined;
    if (firstCustom && nextArea) {
      setSubcategoryCatalogId(firstCustom.id);
      setUiSubcategory(firstCustom.id);
      applyResolvedSubCategory(
        billingSubCategoryForCatalog({
          systemArea: nextArea.systemArea,
          billingKind: firstCustom.billingKind,
          systemSubCategory: firstCustom.systemSubCategory,
        })
      );
      return;
    }
    onFormValuesChange?.();
  }

  function handleBillingModeChange(next: BillingMode) {
    setBillingMode(next);
    if (next !== "MILESTONE") {
      resetPaymentPlan();
    }
    onFormValuesChange?.();
  }

  return (
    <div className={employeeDialogFormClass}>
      <input type="hidden" name={nameOf("clientId")} value={clientId} />
      <input
        type="hidden"
        name={nameOf("initialStatus")}
        value={isInternal ? "IN_PROGRESS" : effectiveInitialStatus}
      />
      <input type="hidden" name={nameOf("subCategory")} value={subCategory} />
      <input type="hidden" name={nameOf("serviceArea")} value={serviceArea} />
      <input type="hidden" name={nameOf("areaCatalogId")} value={areaCatalogId} />
      <input
        type="hidden"
        name={nameOf("subcategoryCatalogId")}
        value={subcategoryCatalogId}
      />
      <input type="hidden" name={nameOf("billingMode")} value={billingMode} />
      <input type="hidden" name={nameOf("isDemo")} value={isDemo ? "true" : "false"} />
      <input
        type="hidden"
        name={nameOf("isComplimentary")}
        value={isComplimentary ? "true" : "false"}
      />
      {isContractCycleSubCategory(subCategory) ? (
        <input
          type="hidden"
          name={nameOf("billingPeriodBasis")}
          value={billingPeriodBasis}
        />
      ) : null}

      <div className={employeeDialogFieldClass}>
        <label className="text-sm font-medium text-text" htmlFor={idOf("name")}>
          {t("pages.projects.projectName")}
        </label>
        <Input
          id={idOf("name")}
          name={nameOf("name")}
          placeholder={t("pages.projects.projectName")}
          required
          className={employeeInputClass}
        />
      </div>

      <div className={employeeDialogFieldClass}>
        <label className="text-sm font-medium text-text">
          {t("common.labels.client")}
        </label>
        <Select value={clientId || "none"} onValueChange={handleClientChange}>
          <SelectTrigger className={employeeSelectTriggerClass}>
            <SelectValue placeholder={t("pages.projects.selectClient")}>
              {(value) => {
                if (!value || value === "none") return null;
                if (isRgsInternalClientFormValue(value)) {
                  return t("pages.projects.rgsInternalClient");
                }
                const client = clients.find((item) => item.id === value);
                return client?.name ?? null;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-muted">
              {t("pages.projects.selectClient")}
            </SelectItem>
            <SelectItem value={RGS_INTERNAL_CLIENT_FORM_VALUE}>
              {t("pages.projects.rgsInternalClient")}
            </SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isInternal ? (
          <p className="text-xs text-subtle">
            {t("pages.projects.rgsInternalHint")}
          </p>
        ) : null}
      </div>

      {!isInternal ? (
        <div className={employeeDialogFieldClass}>
          <label id={idOf("is-demo")} className="text-sm font-medium text-text">
            {t("pages.projects.isDemo")}
          </label>
          <YesNoChoiceCards
            id={idOf("is-demo")}
            labelledBy={idOf("is-demo")}
            value={isDemoChoice}
            onChange={handleDemoChoiceChange}
          />
          <p className="text-xs text-subtle">{t("pages.projects.isDemoHint")}</p>
        </div>
      ) : null}

      {isDemo ? (
        <div className={employeeDialogFieldClass}>
          <label
            id={idOf("is-demo-free")}
            className="text-sm font-medium text-text"
          >
            {t("pages.projects.isDemoFree")}
          </label>
          <YesNoChoiceCards
            id={idOf("is-demo-free")}
            labelledBy={idOf("is-demo-free")}
            value={isComplimentaryChoice}
            onChange={setIsComplimentaryChoice}
          />
          <p className="text-xs text-subtle">
            {t("pages.projects.isDemoFreeHint")}
          </p>
        </div>
      ) : null}

      {!isInternal && !isDemo && showCatchUpIntake ? (
        <div className="space-y-2">
          <ProjectOptionPills
            label={t("pages.projects.catchUp.projectOngoing")}
            value={projectOngoing}
            options={[
              {
                value: "No",
                label: t("pages.projects.catchUp.newProject"),
              },
              {
                value: "Yes",
                label: t("pages.projects.catchUp.ongoing"),
              },
              ...(isMilestoneEligible
                ? [
                    {
                      value: "Completed",
                      label: t("pages.projects.catchUp.completed"),
                    },
                  ]
                : []),
            ]}
            onChange={(value) =>
              setProjectOngoing(value as ProjectCatchUpIntake)
            }
          />
          <input
            type="hidden"
            name={nameOf("projectOngoing")}
            value={projectOngoing}
          />
          <p className="text-xs text-subtle">
            {t("pages.projects.catchUp.projectOngoingHint")}
          </p>
        </div>
      ) : (
        <input type="hidden" name={nameOf("projectOngoing")} value="No" />
      )}

      {!isInternal && !catchUpHistorical ? (
        <ProjectOptionPills
          label={t("pages.projects.startingStage")}
          value={initialStatus}
          options={initialStatusOptions}
          onChange={setInitialStatus}
          columns={2}
        />
      ) : null}

      <ProjectOptionPills
        label={t("pages.projects.serviceArea")}
        value={
          isDemo
            ? serviceArea === "OTHER" ||
              (maintenanceCatalog && areaCatalogId === maintenanceCatalog.id)
              ? maintenanceCatalog?.id ?? "MAINTENANCE"
              : areaCatalogId || serviceArea
            : areaCatalogId || serviceArea
        }
        options={
          isDemo
            ? [
                {
                  value:
                    catalog.find((area) => area.systemArea === "CLEANING")?.id ??
                    "CLEANING",
                  label: t("pages.projects.serviceAreaCleaning"),
                },
                {
                  value:
                    catalog.find((area) => area.systemArea === "LANDSCAPING")
                      ?.id ?? "LANDSCAPING",
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
            const nextArea: FormServiceArea =
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
            const nextArea: FormServiceArea =
              area.systemArea === "OTHER" || area.systemArea === "HEAD_OFFICE"
                ? "OTHER"
                : (area.systemArea as ProjectServiceAreaValue);
            handleServiceAreaChange(nextArea, area.id);
            return;
          }
          handleServiceAreaChange(value as ProjectServiceAreaValue);
        }}
        columns={2}
        spanLastWhenOdd
      />

      {serviceArea === "CLEANING" ? (
        <>
          <ProjectOptionPills
            label={t("pages.projects.subcategory")}
            value={uiSubcategory}
            options={
              isDemo
                ? [
                    {
                      value: "GENERAL_CLEANING",
                      label: localizeSubCategory("GENERAL_CLEANING", locale),
                    },
                    {
                      value: "FACADE_CLEANING",
                      label: localizeSubCategory("FACADE_CLEANING", locale),
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
                handleOneTimeCleaningTypeChange(value);
                setUiSubcategory(value);
                return;
              }
              const custom = selectedCatalogArea?.subcategories.find(
                (sub) => sub.id === value && !sub.isSystem
              );
              if (custom) {
                handleCustomSubcategoryChange(value);
                return;
              }
              handleUiSubcategoryChange(value);
            }}
            columns={2}
            spanLastWhenOdd
          />
        </>
      ) : null}

      {serviceArea === "LANDSCAPING" && !isDemo ? (
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
              handleCustomSubcategoryChange(value);
              return;
            }
            handleUiSubcategoryChange(value);
          }}
          columns={2}
        />
      ) : null}

      {serviceArea === "SECURITY" ? (
        <ProjectOptionPills
          label={t("pages.projects.subcategory")}
          value={uiSubcategory}
          options={[
            { value: "SECURITY", label: t("pages.projects.formRegular") },
            ...(selectedCatalogArea?.allowsOneTime !== false
              ? [
                  {
                    value: ONE_TIME_FORM_VALUE,
                    label: t("pages.projects.oneTime"),
                  },
                ]
              : []),
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
              handleCustomSubcategoryChange(value);
              return;
            }
            handleUiSubcategoryChange(value);
          }}
          columns={2}
        />
      ) : null}

      {serviceArea === "OTHER" && selectedCatalogArea && !isDemo ? (
        <ProjectOptionPills
          label={t("pages.projects.subcategory")}
          value={uiSubcategory}
          options={catalogSubsForAddProject(selectedCatalogArea).map((sub) => ({
            value: sub.id,
            label: catalogDisplayName(sub, locale),
          }))}
          onChange={handleCustomSubcategoryChange}
          columns={2}
        />
      ) : null}

      {showBillingFields && isMilestoneEligible ? (
        <ProjectOptionPills
          label={t("pages.projects.billingLabel")}
          value={billingMode}
          options={generalFacadeBillingOptions}
          onChange={handleBillingModeChange}
        />
      ) : null}

      {showBillingFields && isContractCycleSubCategory(subCategory) ? (
        <BillingPeriodBasisFields
          billingPeriodBasis={billingPeriodBasis}
          onBillingPeriodBasisChange={setBillingPeriodBasis}
          fromDay={billingCycleStartDay}
          toDay={billingCycleEndDay}
          onFromDayChange={setBillingCycleStartDay}
          onToDayChange={setBillingCycleEndDay}
          namePrefix={namePrefix}
          idPrefix={idPrefix}
        />
      ) : null}

      {showBillingFields && showPaymentPlan ? (
        <MilestonePaymentPlanFields
          paymentCount={paymentCount}
          installmentPercents={installmentPercents}
          onPaymentCountChange={setPaymentCount}
          onInstallmentPercentsChange={setInstallmentPercents}
          namePrefix={namePrefix}
          idPrefix={idPrefix}
        />
      ) : null}

      {showBillingFields && showVisitPlan ? (
        <VisitPlanFields
          visits={visitWindows}
          onChange={setVisitWindows}
          namePrefix={namePrefix}
        />
      ) : null}

      {showInternalMultipleVisitQuestion ? (
        <div className={employeeDialogFieldClass}>
          <label
            id={idOf("internal-multiple-visit-label")}
            className={employeeDialogLabelClass}
          >
            {t("pages.projects.multipleVisitProject")}
          </label>
          <YesNoChoiceCards
            id={idOf("internal-multiple-visit")}
            labelledBy={idOf("internal-multiple-visit-label")}
            value={internalMultipleVisit}
            onChange={setInternalMultipleVisit}
          />
          <p className={employeeDialogHintClass}>
            {t("pages.projects.multipleVisitHint")}
          </p>
          <input
            type="hidden"
            name={nameOf("multipleVisit")}
            value={internalMultipleVisit}
          />
        </div>
      ) : null}

      {showInternalVisitPlan ? (
        <VisitPlanFields
          visits={visitWindows}
          onChange={setVisitWindows}
          namePrefix={namePrefix}
          hintKey="pages.projects.visitPlanHintInternal"
        />
      ) : null}

      {showBillingFields && isService ? (
        <ServiceCommercialFields
          key={`${subCategory}-${clientId}`}
          subCategory={subCategory}
          namePrefix={namePrefix}
        />
      ) : null}

      {showBillingFields && subCategory !== "PARKING" ? (
        <PaymentTermsField
          name={nameOf("paymentTermsDays")}
          id={idOf("payment-terms")}
          defaultValue={14}
        />
      ) : null}

      {showBillingFields ? (
      <CompanyBankAccountField
        name={nameOf("bankAccountId")}
        id={idOf("bank-account")}
        accounts={bankAccounts}
      />
      ) : null}

      {showBillingFields ? (
      <>
      <ProjectChargedTaxFields
        id={idOf("charged-tax-kind")}
        name={nameOf("chargedTaxKind")}
        value={chargedTaxKind}
        onChange={(next) => {
          setChargedTaxKind(next);
          if (next !== "OTHER") setOtherTaxName("");
          onFormValuesChange?.();
        }}
        onRatePrefill={setPphRatePercent}
      />

      <div className={employeeDialogFieldClass}>
        <label className="inline-flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            name={nameOf("isGovernmentContract")}
            value="true"
            checked={isGovernmentContract}
            onChange={(event) => setIsGovernmentContract(event.target.checked)}
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

      {chargedTaxKind && commercialTaxRequiresOtherName(chargedTaxKind) ? (
        <div className={employeeDialogFieldClass}>
          <label
            htmlFor={idOf("other-tax-name")}
            className="text-sm font-medium text-text"
          >
            {t("pages.billing.otherTaxName")}
            <span className="text-red-400"> *</span>
          </label>
          <Input
            id={idOf("other-tax-name")}
            name={nameOf("otherTaxName")}
            required
            value={otherTaxName}
            onChange={(event) => {
              setOtherTaxName(event.target.value);
              onFormValuesChange?.();
            }}
            placeholder={t("pages.billing.otherTaxNamePlaceholder")}
            className={employeeInputClass}
          />
          <p className="text-xs text-subtle">
            {t("pages.billing.otherTaxNameHint")}
          </p>
        </div>
      ) : null}

      {chargedTaxKind && commercialTaxRequiresRatePercent(chargedTaxKind) ? (
        <div className={employeeDialogFieldClass}>
          <label
            htmlFor={idOf("pph-rate")}
            className="text-sm font-medium text-text"
          >
            {chargedTaxKind === "OTHER"
              ? t("pages.billing.otherTaxRate")
              : t("pages.projects.pphRatePercent")}
            <span className="text-red-400"> *</span>
          </label>
          <Input
            id={idOf("pph-rate")}
            name={nameOf("pphRatePercent")}
            required
            inputMode="decimal"
            value={pphRatePercent}
            onChange={(event) => {
              setPphRatePercent(event.target.value);
              onFormValuesChange?.();
            }}
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

      {!isService ? (
        <ExclusiveContractPriceField
          id={idOf("contract-price")}
          name={nameOf("contractPrice")}
        />
      ) : null}

      <div className={employeeDialogFieldClass}>
        <label
          htmlFor={idOf("npwp")}
          className="text-sm font-medium text-text"
        >
          {t("pages.projects.companyNpwp")}
        </label>
        <Input
          id={idOf("npwp")}
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
      </>
      ) : null}

      {isInternal ? (
        <>
          <input type="hidden" name={nameOf("startDate")} value={startDate} />
          <p className="text-xs text-subtle">
            {t("pages.projects.rgsInternalLocationHint")}
          </p>
        </>
      ) : isMonthTimeline ? (
        <ProjectTimelineFields
          mode="contract"
          planning={effectiveInitialStatus === "PLANNED"}
          startDate={startDate}
          durationMonths={durationMonths}
          onStartDateChange={setStartDate}
          onDurationMonthsChange={setDurationMonths}
          namePrefix={namePrefix}
        />
      ) : isService ? (
        <div className={employeeDialogFieldClass}>
          <label className="text-sm font-medium text-text">
            {t("pages.projects.timelineFields.contractStart")}
          </label>
          <Input
            name={nameOf(
              effectiveInitialStatus === "PLANNED" ? "estimatedStartDate" : "startDate"
            )}
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
          planning={effectiveInitialStatus === "PLANNED"}
          startDate={startDate}
          durationDays={durationDays}
          onStartDateChange={setStartDate}
          onDurationDaysChange={setDurationDays}
          namePrefix={namePrefix}
        />
      )}

      <LocationPicker
        value={locationValue}
        onChange={setLocationValue}
        namePrefix={namePrefix}
      />

      {projectUsesNamedShifts(subCategory) ? (
        <ProjectShiftCountField
          name={nameOf("shiftCount")}
          namePrefix={namePrefix}
          value={shiftCount}
          onChange={setShiftCount}
        />
      ) : (
        <input type="hidden" name={nameOf("shiftCount")} value="0" />
      )}

      {effectiveInitialStatus === "IN_PROGRESS" || isInternal ? (
        <>
          {!isDemo && !isInternal && !catchUpCompleted ? (
          <div className={employeeDialogFieldClass}>
            <FileDropField
              id={idOf("contract-proof")}
              name={nameOf("contractProof")}
              label={t("pages.projects.contractProof")}
              required
              multiple
              accept="image/*,.pdf,application/pdf"
            />
            <p className="text-xs text-subtle">
              {t("pages.projects.contractProofHint")}
            </p>
          </div>
          ) : null}
          {catchUpCompleted ? null : !isInternal && billingMode === "MULTI_VISIT" ? (
            <p className="text-xs text-subtle">
              {t("pages.projects.moveDialogVisitCrewHelp")}
            </p>
          ) : (
            <>
              <ProjectTeamPicker
                teams={teamsForProjectServiceArea(teams, {
                  areaCatalogId,
                  serviceArea,
                  subCategory,
                })}
                namePrefix={namePrefix}
              />
              <ProjectStaffPicker
                employees={employees}
                namePrefix={namePrefix}
              />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
