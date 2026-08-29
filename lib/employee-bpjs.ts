/**
 * Official BPJS rates used by RGS ONE (owner-confirmed).
 * Kesehatan and JP use wage-base caps; JKK is a manual company % (0.10–1.60).
 */

export const BPJS_KESEHATAN_COMPANY_RATE = 0.04;
export const BPJS_KESEHATAN_EMPLOYEE_RATE = 0.01;
/** Contribution base max for BPJS Kesehatan (IDR). */
export const BPJS_KESEHATAN_WAGE_CAP = 12_000_000;

export const BPJS_JHT_COMPANY_RATE = 0.037;
export const BPJS_JHT_EMPLOYEE_RATE = 0.02;

export const BPJS_JP_COMPANY_RATE = 0.02;
export const BPJS_JP_EMPLOYEE_RATE = 0.01;
/** Contribution base max for JP (IDR). */
export const BPJS_JP_WAGE_CAP = 10_547_400;

export const BPJS_JKM_COMPANY_RATE = 0.003;

export const BPJS_JKK_PERCENT_MIN = 0.1;
export const BPJS_JKK_PERCENT_MAX = 1.6;

export type EmployeeBpjsInput = {
  basePay: number;
  bpjsKesehatanEnabled: boolean;
  bpjsKetenagakerjaanEnabled: boolean;
  jhtEnabled: boolean;
  jpEnabled: boolean;
  jkkEnabled: boolean;
  jkmEnabled: boolean;
  /** Percent points, e.g. 0.24 for 0.24% — only used when JKK enabled. */
  jkkPercent: number | null;
};

export type BpjsLine = {
  key: "kesehatan" | "jht" | "jp" | "jkk" | "jkm";
  wageBase: number;
  companyAmount: number;
  employeeAmount: number;
};

type BpjsBreakdown = {
  lines: BpjsLine[];
  employeeDeduction: number;
  companyContribution: number;
  /** basePay − employee deductions */
  takeHomeFromBase: number;
  /** basePay + company contributions */
  totalEmployerCost: number;
};

function roundIdr(value: number): number {
  return Math.round(value);
}

export function isValidJkkPercent(value: number | null | undefined): boolean {
  if (value == null || !Number.isFinite(value)) return false;
  return value >= BPJS_JKK_PERCENT_MIN && value <= BPJS_JKK_PERCENT_MAX;
}

export function calculateBpjsBreakdown(input: EmployeeBpjsInput): BpjsBreakdown {
  const basePay = Math.max(0, Number.isFinite(input.basePay) ? input.basePay : 0);
  const lines: BpjsLine[] = [];

  if (input.bpjsKesehatanEnabled) {
    const wageBase = Math.min(basePay, BPJS_KESEHATAN_WAGE_CAP);
    lines.push({
      key: "kesehatan",
      wageBase,
      companyAmount: roundIdr(wageBase * BPJS_KESEHATAN_COMPANY_RATE),
      employeeAmount: roundIdr(wageBase * BPJS_KESEHATAN_EMPLOYEE_RATE),
    });
  }

  if (input.bpjsKetenagakerjaanEnabled) {
    if (input.jhtEnabled) {
      lines.push({
        key: "jht",
        wageBase: basePay,
        companyAmount: roundIdr(basePay * BPJS_JHT_COMPANY_RATE),
        employeeAmount: roundIdr(basePay * BPJS_JHT_EMPLOYEE_RATE),
      });
    }
    if (input.jpEnabled) {
      const wageBase = Math.min(basePay, BPJS_JP_WAGE_CAP);
      lines.push({
        key: "jp",
        wageBase,
        companyAmount: roundIdr(wageBase * BPJS_JP_COMPANY_RATE),
        employeeAmount: roundIdr(wageBase * BPJS_JP_EMPLOYEE_RATE),
      });
    }
    if (input.jkkEnabled && isValidJkkPercent(input.jkkPercent)) {
      const rate = (input.jkkPercent as number) / 100;
      lines.push({
        key: "jkk",
        wageBase: basePay,
        companyAmount: roundIdr(basePay * rate),
        employeeAmount: 0,
      });
    }
    if (input.jkmEnabled) {
      lines.push({
        key: "jkm",
        wageBase: basePay,
        companyAmount: roundIdr(basePay * BPJS_JKM_COMPANY_RATE),
        employeeAmount: 0,
      });
    }
  }

  const employeeDeduction = lines.reduce((sum, line) => sum + line.employeeAmount, 0);
  const companyContribution = lines.reduce((sum, line) => sum + line.companyAmount, 0);

  return {
    lines,
    employeeDeduction,
    companyContribution,
    takeHomeFromBase: roundIdr(basePay - employeeDeduction),
    totalEmployerCost: roundIdr(basePay + companyContribution),
  };
}

/** Parse IDR amount from form (digits / optional separators). */
export function parseBasePayInput(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const cleaned = text.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

export function parseJkkPercentInput(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!text) return null;
  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  return num;
}

export function parseCheckboxFlag(raw: FormDataEntryValue | null): boolean {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

type ParsedEmployeeFinance = {
  basePay: number;
  bpjsKesehatanEnabled: boolean;
  bpjsKetenagakerjaanEnabled: boolean;
  jhtEnabled: boolean;
  jpEnabled: boolean;
  jkkEnabled: boolean;
  jkmEnabled: boolean;
  jkkPercent: number | null;
  securityDepositRequired: boolean;
  cicoExempt: boolean;
  progressExempt: boolean;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
};

/** Part Time staff are paid per day: no security deposit, no BPJS enrollment. */
export function isDailyPaidPartTime(
  employmentType: FormDataEntryValue | string | null | undefined
): boolean {
  const raw = String(employmentType ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return raw === "PART_TIME" || raw === "PT";
}

export function parseEmployeeFinanceFromForm(
  formData: FormData,
  employmentType?: FormDataEntryValue | string | null
): ParsedEmployeeFinance {
  const basePay = parseBasePayInput(formData.get("basePay"));
  if (basePay == null || basePay <= 0) {
    throw new Error("Base pay is required and must be greater than zero.");
  }

  const bankName = String(formData.get("bankName") ?? "").trim() || null;
  const bankAccountNumber =
    String(formData.get("bankAccountNumber") ?? "").trim() || null;
  const bankAccountName =
    String(formData.get("bankAccountName") ?? "").trim() || null;
  if (!bankName || !bankAccountNumber || !bankAccountName) {
    throw new Error(
      "Bank name, account holder name, and account number are required."
    );
  }

  const partTime = isDailyPaidPartTime(
    employmentType ?? formData.get("employmentType")
  );
  if (partTime) {
    return {
      basePay,
      bpjsKesehatanEnabled: false,
      bpjsKetenagakerjaanEnabled: false,
      jhtEnabled: false,
      jpEnabled: false,
      jkkEnabled: false,
      jkmEnabled: false,
      jkkPercent: null,
      securityDepositRequired: false,
      cicoExempt: parseCheckboxFlag(formData.get("cicoExempt")),
      progressExempt: parseCheckboxFlag(formData.get("progressExempt")),
      bankName,
      bankAccountNumber,
      bankAccountName,
    };
  }

  const bpjsKesehatanEnabled = parseCheckboxFlag(formData.get("bpjsKesehatanEnabled"));
  const bpjsKetenagakerjaanEnabled = parseCheckboxFlag(
    formData.get("bpjsKetenagakerjaanEnabled")
  );

  const jhtEnabled =
    bpjsKetenagakerjaanEnabled && parseCheckboxFlag(formData.get("jhtEnabled"));
  const jpEnabled =
    bpjsKetenagakerjaanEnabled && parseCheckboxFlag(formData.get("jpEnabled"));
  const jkkEnabled =
    bpjsKetenagakerjaanEnabled && parseCheckboxFlag(formData.get("jkkEnabled"));
  const jkmEnabled =
    bpjsKetenagakerjaanEnabled && parseCheckboxFlag(formData.get("jkmEnabled"));

  let jkkPercent: number | null = null;
  if (jkkEnabled) {
    jkkPercent = parseJkkPercentInput(formData.get("jkkPercent"));
    if (!isValidJkkPercent(jkkPercent)) {
      throw new Error("JKK percent must be between 0.10 and 1.60.");
    }
  }

  return {
    basePay,
    bpjsKesehatanEnabled,
    bpjsKetenagakerjaanEnabled,
    jhtEnabled,
    jpEnabled,
    jkkEnabled,
    jkmEnabled,
    jkkPercent,
    securityDepositRequired: parseCheckboxFlag(
      formData.get("securityDepositRequired")
    ),
    cicoExempt: parseCheckboxFlag(formData.get("cicoExempt")),
    progressExempt: parseCheckboxFlag(formData.get("progressExempt")),
    bankName,
    bankAccountNumber,
    bankAccountName,
  };
}
