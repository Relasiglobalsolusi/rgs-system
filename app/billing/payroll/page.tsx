import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import PayrollPanel from "@/components/billing/PayrollPanel";
import {
  canUnlockInternalPayroll,
  getInternalPayrollLockState,
} from "@/lib/internal-payroll-lock";
import {
  loadInternalPayrollMonth,
  loadPayrollCatalog,
} from "@/lib/internal-payroll-month";
import {
  currentPayrollPeriod,
  isPayrollPeriodReconciled,
} from "@/lib/internal-payroll-period";
import {
  isClientPortalUser,
  isVendorPortalUser,
} from "@/lib/project-access";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";

type SearchParams = Promise<{ year?: string; month?: string }>;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireFinanceChild("payroll");
  const user = toPermissionUser(session);
  if (isClientPortalUser(user) || isVendorPortalUser(user)) {
    redirect("/billing");
  }

  const params = await searchParams;
  const current = currentPayrollPeriod();
  const year = Math.max(
    2000,
    Math.min(2100, Number(params.year) || current.year)
  );
  const month = Math.max(
    1,
    Math.min(12, Number(params.month) || current.month)
  );
  const companyId = session.user.companyId;

  const [rows, catalog, lock] = await Promise.all([
    loadInternalPayrollMonth({ companyId, year, month }),
    loadPayrollCatalog(companyId),
    getInternalPayrollLockState(companyId, year, month),
  ]);

  return (
    <AppShell
      titleKey="pages.payroll.title"
      descriptionKey="pages.payroll.description"
    >
      <PageIntro
        titleKey="pages.payroll.directoryTitle"
        descriptionKey="pages.payroll.directoryDesc"
      />

      <PayrollPanel
        year={year}
        month={month}
        preview={!isPayrollPeriodReconciled(year, month)}
        rows={rows}
        items={catalog.items}
        projects={catalog.projects}
        lock={lock}
        canUnlock={canUnlockInternalPayroll(user)}
      />
    </AppShell>
  );
}
