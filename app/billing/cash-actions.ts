"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  companyCashBalance,
  recordCashDeposit,
  recordCashWithdraw,
} from "@/lib/company-cash";
import {
  listCompanyBankAccountOptions,
  parseFormCompanyBankAccountId,
} from "@/lib/company-bank-accounts";
import { getServerLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { taxInvoiceDateToUtcDate } from "@/lib/payment-document-verify";
import { canAccess, isOwnerAccount } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseContractPrice } from "@/lib/project-billing";
import { requireSession, toPermissionUser } from "@/lib/session";

async function requireExpenseManageAccess() {
  const session = await requireSession();
  if (session.user.clientId) {
    redirect("/dashboard");
  }
  const user = toPermissionUser(session);
  if (!canAccess(user, "projects") && !canAccess(user, "purchaseInvoices")) {
    redirect("/dashboard");
  }
  return session;
}

export async function getCompanyCashAtHand() {
  const session = await requireExpenseManageAccess();
  return companyCashBalance(prisma, session.user.companyId);
}

export async function listTakeCashBankAccounts() {
  const session = await requireExpenseManageAccess();
  return listCompanyBankAccountOptions(session.user.companyId);
}

export async function takeCompanyCash(formData: FormData) {
  const session = await requireExpenseManageAccess();
  const locale = await getServerLocale();
  if (!isOwnerAccount({ username: session.user.username })) {
    throw new Error(translate(locale, "pages.projects.permissionDenied"));
  }

  const amount = parseContractPrice(String(formData.get("amount") ?? ""));
  if (amount == null || amount <= 0) {
    throw new Error(translate(locale, "pages.billing.takeCashAmountRequired"));
  }

  const occurredRaw = String(formData.get("occurredAt") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredRaw)) {
    throw new Error(translate(locale, "pages.billing.takeCashDateRequired"));
  }

  const bankAccountId = await parseFormCompanyBankAccountId(
    formData,
    session.user.companyId,
    {
      requiredWhenAccountsExist: true,
      requiredMessage: translate(
        locale,
        "pages.billing.purchaseBankAccountRequired"
      ),
    }
  );
  if (!bankAccountId) {
    throw new Error(
      translate(locale, "pages.billing.purchaseBankAccountRequired")
    );
  }

  const note = String(formData.get("note") ?? "").trim();

  await prisma.$transaction(async (tx) => {
    await recordCashWithdraw(tx, {
      companyId: session.user.companyId,
      amount,
      occurredAt: taxInvoiceDateToUtcDate(occurredRaw),
      bankAccountId,
      note: note || null,
      userId: session.user.id,
    });
  });

  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/financial-report");
  revalidatePath("/billing/financial-report/detail");
}

export async function canTakeCompanyCash() {
  const session = await requireSession();
  return isOwnerAccount({ username: session.user.username });
}

export async function returnCompanyCash(formData: FormData) {
  const session = await requireExpenseManageAccess();
  const locale = await getServerLocale();

  const amount = parseContractPrice(String(formData.get("amount") ?? ""));
  if (amount == null || amount <= 0) {
    throw new Error(translate(locale, "pages.billing.returnCashAmountRequired"));
  }

  const occurredRaw = String(formData.get("occurredAt") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredRaw)) {
    throw new Error(translate(locale, "pages.billing.returnCashDateRequired"));
  }

  const bankAccountId = await parseFormCompanyBankAccountId(
    formData,
    session.user.companyId,
    {
      requiredWhenAccountsExist: true,
      requiredMessage: translate(
        locale,
        "pages.billing.purchaseBankAccountRequired"
      ),
    }
  );
  if (!bankAccountId) {
    throw new Error(
      translate(locale, "pages.billing.purchaseBankAccountRequired")
    );
  }

  const note = String(formData.get("note") ?? "").trim();

  try {
    await prisma.$transaction(async (tx) => {
      await recordCashDeposit(tx, {
        companyId: session.user.companyId,
        amount,
        occurredAt: taxInvoiceDateToUtcDate(occurredRaw),
        bankAccountId,
        note: note || null,
        userId: session.user.id,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CASH") {
      throw new Error(translate(locale, "pages.billing.returnCashInsufficient"));
    }
    throw error;
  }

  revalidatePath("/billing/purchase-invoices");
  revalidatePath("/billing/financial-report");
  revalidatePath("/billing/financial-report/detail");
}
