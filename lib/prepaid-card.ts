import type {
  PrepaidCardKind,
  PrepaidCardLossRecoveryKind,
  PrepaidCardSpendKind,
  PrepaidCardStatus,
} from "@prisma/client";

import type { AppLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";

export const PREPAID_CARD_LIVE_STATUSES: PrepaidCardStatus[] = [
  "ACTIVE",
  "DAMAGED",
];

export const PREPAID_CARD_TOP_UP_STATUSES: PrepaidCardStatus[] = [
  "STANDBY",
  "ACTIVE",
];

export const PREPAID_VEHICLE_SPEND_KINDS: PrepaidCardSpendKind[] = [
  "FUEL",
  "TOLL",
  "PARKING",
  "OTHER",
];

export function normalizePrepaidCardNumber(raw: string) {
  return raw.replace(/\s+/g, "").trim();
}

export function formatPrepaidCardNumber(raw: string) {
  const digits = normalizePrepaidCardNumber(raw);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function canSpendOnPrepaidCard(status: PrepaidCardStatus) {
  return status === "ACTIVE";
}

export function canTopUpPrepaidCard(status: PrepaidCardStatus) {
  return PREPAID_CARD_TOP_UP_STATUSES.includes(status);
}

export function canAssignPrepaidCard(status: PrepaidCardStatus) {
  return status === "STANDBY";
}

export function canReturnPrepaidCard(status: PrepaidCardStatus) {
  return status === "ACTIVE" || status === "DAMAGED";
}

export function canMarkPrepaidCardDamaged(status: PrepaidCardStatus) {
  return status === "ACTIVE";
}

export function canReplacePrepaidCard(status: PrepaidCardStatus) {
  return status === "DAMAGED";
}

export function canReportPrepaidCardLost(status: PrepaidCardStatus) {
  return status === "ACTIVE" || status === "DAMAGED";
}

export function allowedSpendKinds(
  kind: PrepaidCardKind
): PrepaidCardSpendKind[] {
  return kind === "OPEN" ? ["OTHER"] : PREPAID_VEHICLE_SPEND_KINDS;
}

export function parsePrepaidCardKind(raw: string): PrepaidCardKind | null {
  return raw === "VEHICLE" || raw === "OPEN" ? raw : null;
}

export function parsePrepaidCardSpendKind(
  raw: string
): PrepaidCardSpendKind | null {
  return raw === "FUEL" ||
    raw === "TOLL" ||
    raw === "PARKING" ||
    raw === "OTHER"
    ? raw
    : null;
}

export function parsePrepaidLossRecoveryKind(
  raw: string
): PrepaidCardLossRecoveryKind | null {
  return raw === "COMPANY" ||
    raw === "NEXT_PAY" ||
    raw === "INSTALLMENTS" ||
    raw === "PAY_NOW"
    ? raw
    : null;
}

export function splitPrepaidLossIntoTen(leftover: number): number[] {
  const cents = Math.round(Math.max(0, leftover) * 100);
  const base = Math.floor(cents / 10);
  const amounts = Array.from({ length: 10 }, () => base);
  amounts[9] = cents - base * 9;
  return amounts.map((value) => value / 100);
}

export function prepaidTopUpLabel(
  kind: PrepaidCardKind,
  cardNumber: string,
  locale: AppLocale = "en"
) {
  const number = formatPrepaidCardNumber(cardNumber);
  return translate(
    locale,
    kind === "OPEN"
      ? "pages.pettyCash.topUpOpenLabel"
      : "pages.pettyCash.topUpVehicleLabel",
    { number }
  );
}

export function prepaidReplacementFeeLabel(
  cardNumber: string,
  locale: AppLocale = "en"
) {
  return translate(locale, "pages.pettyCash.replacementFeeLabel", {
    number: formatPrepaidCardNumber(cardNumber),
  });
}

export function prepaidLostReturnLabel(
  cardNumber: string,
  locale: AppLocale = "en"
) {
  return translate(locale, "pages.pettyCash.lostReturnLabel", {
    number: formatPrepaidCardNumber(cardNumber),
  });
}

export type PrepaidLossTotals = {
  leftoverAmount: number;
  amountRecovered: number;
  amountLeft: number;
  hoAbsorbed: number;
  employeeLeft: number;
  footedBy: "company" | "employee";
};

export function computePrepaidLossTotals(options: {
  leftoverAmount: number;
  recoveryKind: PrepaidCardLossRecoveryKind;
  payNowRecovered: number;
  payrollRecovered: number;
}): PrepaidLossTotals {
  const leftover = Math.max(0, options.leftoverAmount);
  if (options.recoveryKind === "COMPANY") {
    return {
      leftoverAmount: leftover,
      amountRecovered: 0,
      amountLeft: leftover,
      hoAbsorbed: leftover,
      employeeLeft: 0,
      footedBy: "company",
    };
  }
  const recovered = Math.min(
    leftover,
    Math.max(0, options.payNowRecovered + options.payrollRecovered)
  );
  const left = Math.max(0, Math.round((leftover - recovered) * 100) / 100);
  return {
    leftoverAmount: leftover,
    amountRecovered: recovered,
    amountLeft: left,
    hoAbsorbed: 0,
    employeeLeft: left,
    footedBy: "employee",
  };
}
