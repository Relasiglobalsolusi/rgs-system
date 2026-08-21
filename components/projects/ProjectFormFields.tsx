"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
import ServiceCommercialFields from "@/components/projects/ServiceCommercialFields";
import {
  employeeDialogFieldClass,
  employeeDialogFormClass,
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
  subCategoryForServiceArea,
} from "@/lib/project-subcategory";
import {
  ONE_TIME_FORM_VALUE,
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
import CommercialTaxKindField from "@/components/billing/CommercialTaxKindField";
import {
  commercialTaxRequiresOtherName,
  commercialTaxRequiresRatePercent,
  defaultCommercialNonVatRatePercent,
  type CommercialTaxKind,
} from "@/lib/commercial-tax";
import { taxInvoiceDefaultsFromClient } from "@/lib/npwp";
import { localizeBillingMode, localizeSubCategory } from "@/lib/i18n/labels";
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

  const generalFacadeBillingOptions = useMemo(
    () =>
      MILESTONE_ELIGIBLE_BILLING_MODES.map((value) => ({
        value,
        label: localizeBillingMode(value, locale),
      })),
    [locale]
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

  const isContract = isContractSubCategory(subCategory);
  const isLandscaping = isLandscapingProjectSubCategory(subCategory);
  const isService = isServiceProjectSubCategory(subCategory);
  const isMonthTimeline = usesMonthDurationTimeline(subCategory);
  const isMilestoneEligible = isMilestoneSubCategory(subCategory);
  const showPaymentPlan = isMilestoneEligible && billingMode === "MILESTONE";
  const showVisitPlan = isMilestoneEligible && billingMode === "MULTI_VISIT";
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const selectedClient = clients.find((item) => item.id === clientId);
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

  function handleServiceAreaChange(next: FormServiceArea, catalogId?: string) {
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
        value={initialStatus}
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
      {isContract || subCategory === "SECURITY" ? (
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
      />

      {serviceArea === "CLEANING" ? (
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
                label: localizeSubCategory("CONTRACT_GENERAL_CLEANING", locale),
              },
              {
                value: "CONTRACT_FACADE_CLEANING",
                label: localizeSubCategory("CONTRACT_FACADE_CLEANING", locale),
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
                handleCustomSubcategoryChange(value);
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
              onChange={(value) =>
                handleOneTimeCleaningTypeChange(value as CleaningOneTimeType)
              }
              columns={2}
            />
          ) : null}
        </>
      ) : null}

      {serviceArea === "LANDSCAPING" ? (
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

      {serviceArea === "OTHER" && selectedCatalogArea ? (
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

      {isMilestoneEligible ? (
        <ProjectOptionPills
          label={t("pages.projects.billingLabel")}
          value={billingMode}
          options={generalFacadeBillingOptions}
          onChange={handleBillingModeChange}
          columns={3}
        />
      ) : null}

      {isContract || subCategory === "SECURITY" ? (
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

      {showPaymentPlan ? (
        <MilestonePaymentPlanFields
          paymentCount={paymentCount}
          installmentPercents={installmentPercents}
          onPaymentCountChange={setPaymentCount}
          onInstallmentPercentsChange={setInstallmentPercents}
          namePrefix={namePrefix}
          idPrefix={idPrefix}
        />
      ) : null}

      {showVisitPlan ? (
        <VisitPlanFields
          visits={visitWindows}
          onChange={setVisitWindows}
          namePrefix={namePrefix}
        />
      ) : null}

      {isService ? (
        <ServiceCommercialFields
          key={`${subCategory}-${clientId}`}
          subCategory={subCategory}
          namePrefix={namePrefix}
        />
      ) : null}

      <PaymentTermsField
        name={nameOf("paymentTermsDays")}
        id={idOf("payment-terms")}
        defaultValue={14}
      />

      <CompanyBankAccountField
        name={nameOf("bankAccountId")}
        id={idOf("bank-account")}
        accounts={bankAccounts}
      />

      <CommercialTaxKindField
        id={idOf("charged-tax-kind")}
        name={nameOf("chargedTaxKind")}
        value={chargedTaxKind}
        onChange={(next) => {
          setChargedTaxKind(next);
          const nextRate = defaultCommercialNonVatRatePercent(next);
          setPphRatePercent(nextRate != null ? String(nextRate) : "");
          if (next !== "OTHER") setOtherTaxName("");
          onFormValuesChange?.();
        }}
        label={t("pages.projects.chargedTaxKind")}
        hint={t("pages.projects.chargedTaxKindHint")}
        placeholder={t("pages.projects.chargedTaxKindPlaceholder")}
      />

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

      {isMonthTimeline ? (
        <ProjectTimelineFields
          mode="contract"
          planning={initialStatus === "PLANNED"}
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
              initialStatus === "PLANNED" ? "estimatedStartDate" : "startDate"
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
          planning={initialStatus === "PLANNED"}
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

      <ProjectShiftCountField
        name={nameOf("shiftCount")}
        namePrefix={namePrefix}
        value={shiftCount}
        onChange={setShiftCount}
      />

      {initialStatus === "IN_PROGRESS" ? (
        <>
          <div className={employeeDialogFieldClass}>
            <FileDropField
              id={idOf("contract-proof")}
              name={nameOf("contractProof")}
              label={t("pages.projects.contractProof")}
              required
              accept="image/*,.pdf,application/pdf"
            />
            <p className="text-xs text-subtle">
              {t("pages.projects.contractProofHint")}
            </p>
          </div>
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
      ) : null}
    </div>
  );
}
