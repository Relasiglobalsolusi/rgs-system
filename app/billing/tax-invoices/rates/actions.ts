"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseDateInput } from "@/lib/invoice-period";
import { canAccess } from "@/lib/permissions";
import {
  requireFinanceChild,
  requireSession,
  toPermissionUser,
} from "@/lib/session";
import {
  addTaxRateVersion,
  createTaxRateType,
  listCompanyTaxRateTypes,
  listTaxRatesForPicker,
  parseTaxRatePercentInput,
} from "@/lib/tax-rates";
import type {
  TaxRatePickerRow,
  TaxRateTypeView,
} from "@/lib/tax-rate-codes";

async function requireTaxRatesAccess() {
  const session = await requireFinanceChild("taxInvoices");
  const user = toPermissionUser(session);
  if (!canAccess(user, "taxInvoices")) {
    redirect("/dashboard");
  }
  if (session.user.clientId || session.user.vendorId) {
    redirect("/dashboard");
  }
  return session;
}

export async function getTaxRateTypes(): Promise<TaxRateTypeView[]> {
  const session = await requireTaxRatesAccess();
  return listCompanyTaxRateTypes(session.user.companyId);
}

export async function getTaxRatesForPicker(
  asOfIso?: string
): Promise<TaxRatePickerRow[]> {
  const session = await requireSession();
  const user = toPermissionUser(session);
  const allowed =
    canAccess(user, "taxInvoices") ||
    canAccess(user, "purchaseInvoices") ||
    canAccess(user, "projects") ||
    canAccess(user, "financialReport") ||
    canAccess(user, "inventory") ||
    canAccess(user, "sales");
  if (!allowed) {
    redirect("/dashboard");
  }
  const asOf = asOfIso ? parseDateInput(asOfIso) : new Date();
  return listTaxRatesForPicker(session.user.companyId, asOf ?? new Date());
}

export async function addCompanyTaxType(formData: FormData): Promise<void> {
  const session = await requireTaxRatesAccess();
  const name = String(formData.get("name") ?? "").trim();
  const appliesToRaw = String(formData.get("appliesTo") ?? "CLIENT_CHARGE");
  const appliesTo =
    appliesToRaw === "CORPORATE" ? "CORPORATE" : "CLIENT_CHARGE";
  const ratePercent = parseTaxRatePercentInput(
    String(formData.get("ratePercent") ?? "")
  );
  const effectiveFrom = parseDateInput(
    String(formData.get("effectiveFrom") ?? "")
  );
  if (!effectiveFrom) {
    throw new Error("Enter the date this rate starts.");
  }
  await createTaxRateType({
    companyId: session.user.companyId,
    name,
    appliesTo,
    ratePercent,
    effectiveFrom,
    note: String(formData.get("note") ?? "").trim() || null,
    createdById: session.user.id,
  });
  revalidatePath("/billing/tax-invoices");
  revalidatePath("/billing/tax-invoices/rates");
}

export async function addCompanyTaxRate(formData: FormData): Promise<void> {
  const session = await requireTaxRatesAccess();
  const typeId = String(formData.get("typeId") ?? "").trim();
  if (!typeId) throw new Error("Select a tax type.");
  const ratePercent = parseTaxRatePercentInput(
    String(formData.get("ratePercent") ?? "")
  );
  const effectiveFrom = parseDateInput(
    String(formData.get("effectiveFrom") ?? "")
  );
  if (!effectiveFrom) {
    throw new Error("Enter the date this rate starts.");
  }
  await addTaxRateVersion({
    companyId: session.user.companyId,
    typeId,
    ratePercent,
    effectiveFrom,
    note: String(formData.get("note") ?? "").trim() || null,
    createdById: session.user.id,
  });
  revalidatePath("/billing/tax-invoices");
  revalidatePath("/billing/tax-invoices/rates");
  revalidatePath("/billing/financial-report");
}
