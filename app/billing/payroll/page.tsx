import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import PayrollPanel from "@/components/billing/PayrollPanel";
import { listInternalPayrollChanges } from "@/lib/internal-payroll-audit";
import { getInternalPayrollLockState } from "@/lib/internal-payroll-lock";
import {
  loadInternalPayrollMonth,
  loadPayrollCatalog,
} from "@/lib/internal-payroll-month";
import {
  currentPayrollPeriod,
  isPayrollPeriodReconciled,
  parsePayrollRunKind,
  DEFAULT_PAYROLL_RUN,
} from "@/lib/internal-payroll-period";
import {
  isClientPortalUser,
  isVendorPortalUser,
} from "@/lib/project-access";
import { findPendingPayrollUnlockRequest } from "@/lib/payroll-unlock-request";
import { getServerLocale, localeToBcp47 } from "@/lib/i18n/locale";
import { requireFinanceChild, toPermissionUser } from "@/lib/session";

type SearchParams = Promise<{ year?: string; month?: string; run?: string }>;

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
  const run = parsePayrollRunKind(params.run) || DEFAULT_PAYROLL_RUN;
  const current = currentPayrollPeriod(undefined, run);
  const year = Math.max(
    2000,
    Math.min(2100, Number(params.year) || current.year)
  );
  const month = Math.max(
    1,
    Math.min(12, Number(params.month) || current.month)
  );
  const companyId = session.user.companyId;

  const [rows, catalog, lock, changes, unlockRequest] = await Promise.all([
    loadInternalPayrollMonth({ companyId, year, month, run }),
    loadPayrollCatalog(companyId),
    getInternalPayrollLockState(companyId, year, month, run),
    listInternalPayrollChanges({ companyId, year, month, run }),
    getServerLocale().then((locale) =>
      findPendingPayrollUnlockRequest({
        companyId,
        year,
        month,
        run,
        userId: session.user.id,
        bcp47: localeToBcp47(locale),
      })
    ),
  ]);

  return (
    <AppShell
      titleKey="pages.payroll.title"
    >
      <PageIntro
        titleKey="pages.payroll.directoryTitle"
        descriptionKey="pages.payroll.directoryDesc"
      />

      <PayrollPanel
        year={year}
        month={month}
        preview={!isPayrollPeriodReconciled(year, month, undefined, run)}
        rows={rows}
        items={catalog.items}
        projects={catalog.projects}
        lock={lock}
        unlockRequest={unlockRequest}
        run={run}
        changes={changes}
      />
    </AppShell>
  );
}
