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
import ServiceCommercialFields from "@/components/projects/ServiceCommercialFields";
import {
  employeeDialogFieldClass,
  employeeDialogFormClass,
  employeeInputClass,
  employeeSelectTriggerClass,
} from "@/components/employees/employee-dialog-ui";
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

const LocationPicker = dynamic(
  () => import("@/components/projects/LocationPicker"),
  { ssr: false }
);

export type ProjectFormClient = {
  id: string;
  name: string;
  npwp?: string | null;
  paymentTermsDays?: number | null;
};

export type ProjectFormInitialStatus = "PLANNED" | "IN_PROGRESS";

export type ProjectFormFieldsState = {
  clientId: string;
  planSumOk: boolean;
  isService: boolean;
  isContract: boolean;
  showPaymentPlan: boolean;
  initialStatus: ProjectFormInitialStatus;
  controlledSignature: string;
};

type Props = {
  employees: ProjectStaffEmployee[];
  teams?: ProjectTeamOption[];
  clients: ProjectFormClient[];
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
  const [npwp, setNpwp] = useState(
    () => taxInvoiceDefaultsFromClient(clients[0]).npwp
  );
  const [initialStatus, setInitialStatus] =
    useState<ProjectFormInitialStatus>("PLANNED");
  const [subCategory, setSubCategory] =
    useState<ProjectSubCategory>("REGULAR_CLEANING");
  const [serviceArea, setServiceArea] =
    useState<ProjectServiceAreaValue>("CLEANING");
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
      planSumOk,
      isService,
      isContract,
      showPaymentPlan,
      initialStatus,
      controlledSignature,
    });
  }, [
    clientId,
    planSumOk,
    isService,
    isContract,
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

  function handleSubCategoryChange(next: ProjectSubCategory) {
    setSubCategory(next);
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

  function handleServiceAreaChange(next: ProjectServiceAreaValue) {
    setServiceArea(next);
    const locked = subCategoryForServiceArea(next);
    if (locked) {
      handleSubCategoryChange(locked);
      return;
    }
    if (
      !COMMERCIAL_PROJECT_SUB_CATEGORIES.includes(
        subCategory as (typeof COMMERCIAL_PROJECT_SUB_CATEGORIES)[number]
      )
    ) {
      handleSubCategoryChange("REGULAR_CLEANING");
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
          clientPaymentTermsDays={selectedClient?.paymentTermsDays}
          namePrefix={namePrefix}
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
            <label
              htmlFor={idOf("contract-proof")}
              className="text-sm font-medium text-text"
            >
              {t("pages.projects.contractProof")}
            </label>
            <Input
              id={idOf("contract-proof")}
              type="file"
              name={nameOf("contractProof")}
              accept="image/*,.pdf,application/pdf"
              required
              className={employeeInputClass}
            />
            <p className="text-xs text-subtle">
              {t("pages.projects.contractProofHint")}
            </p>
          </div>
          {isMilestoneEligible ? (
            <ProjectTeamPicker
              teams={teams.filter((team) => team.kind === subCategory)}
              namePrefix={namePrefix}
            />
          ) : null}
          <ProjectStaffPicker
            employees={employees}
            namePrefix={namePrefix}
          />
        </>
      ) : null}
    </div>
  );
}
