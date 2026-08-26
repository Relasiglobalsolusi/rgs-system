import Link from "next/link";
import { redirect } from "next/navigation";

import { financeToolbarActionClass } from "@/components/billing/finance-toolbar";
import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import EmptyState from "@/components/ui/EmptyState";
import SectionCard from "@/components/ui/SectionCard";
import { getEmployeeCompanyBalances } from "@/lib/employee-company-balance";
import { formatEmployeeName } from "@/lib/employee-user-link";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { requirePayslipAccess } from "@/lib/payslip-access";
import { prisma } from "@/lib/prisma";
import { formatContractPrice } from "@/lib/project-billing";

export default async function PayslipsPage() {
  const access = await requirePayslipAccess();
  if (!access.canManageAll && access.ownEmployeeId) {
    redirect(`/payslips/${access.ownEmployeeId}`);
  }

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const employees = await prisma.employee.findMany({
    where: {
      companyId: access.session.user.companyId,
      archivedFromDirectory: false,
      status: { in: ["ACTIVE", "ON_LEAVE", "LEAVE_PENDING"] },
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
    },
    orderBy: [{ employeeNo: "asc" }],
  });
  const balances = await getEmployeeCompanyBalances(
    prisma,
    employees.map((row) => row.id)
  );
  const rows = employees.map((employee) => {
    const balance = balances.get(employee.id);
    return {
      ...employee,
      amountOwed: balance?.amountOwed ?? 0,
      depositHeld: balance?.depositHeld ?? 0,
      heldBpjsShare: balance?.heldBpjsShare ?? 0,
    };
  });

  return (
    <AppShell titleKey="pages.payslips.title">
      <PageIntro
        titleKey="pages.payslips.directoryTitle"
        descriptionKey="pages.payslips.directoryDesc"
      />
      <div className="mb-4 flex justify-end">
        <Link href="/billing/payroll" className={financeToolbarActionClass}>
          {t("pages.payslips.openPayroll")}
        </Link>
      </div>
      <SectionCard>
        <h2 className="mb-4 text-lg font-semibold text-text">
          {t("pages.payslips.balanceDueTitle")}
        </h2>
        {rows.length === 0 ? (
          <EmptyState
            title={t("pages.payslips.emptyBalance")}
            description={t("pages.payslips.directoryDesc")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead className="border-b border-border text-xs font-medium text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("pages.payslips.columns.employee")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("pages.payslips.columns.amountOwed")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("pages.payslips.columns.deposit")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("pages.payslips.columns.bpjsHeld")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = `/payslips/${row.id}`;
                  const label = `${formatEmployeeName(row)} — ${t("pages.payslips.clickEmployee")}`;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/70 hover:bg-elevated/50"
                    >
                      <td className="p-0 text-left">
                        <Link
                          href={href}
                          aria-label={label}
                          className="block px-3 py-3"
                        >
                          <span className="block font-semibold text-primary">
                            {formatEmployeeName(row)}
                          </span>
                          <span className="block font-mono text-xs text-muted">
                            {row.employeeNo}
                          </span>
                        </Link>
                      </td>
                      <td
                        className={
                          row.amountOwed > 0
                            ? "p-0 text-left font-semibold text-danger"
                            : "p-0 text-left text-muted"
                        }
                      >
                        <Link href={href} tabIndex={-1} className="block px-3 py-3">
                          {formatContractPrice(row.amountOwed)}
                        </Link>
                      </td>
                      <td className="p-0 text-left text-muted">
                        <Link href={href} tabIndex={-1} className="block px-3 py-3">
                          {formatContractPrice(row.depositHeld)}
                        </Link>
                      </td>
                      <td className="p-0 text-left text-muted">
                        <Link href={href} tabIndex={-1} className="block px-3 py-3">
                          {formatContractPrice(row.heldBpjsShare)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
