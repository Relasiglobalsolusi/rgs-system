import Link from "next/link";
import { redirect } from "next/navigation";

import ProjectCatchUpPeriodForm from "@/components/projects/ProjectCatchUpPeriodForm";
import AppShell from "@/components/layout/AppShell";
import BackLink from "@/components/ui/BackLink";
import SectionCard from "@/components/ui/SectionCard";
import { catchUpAsOfDate, loadBooksOpenDate } from "@/lib/books-open";
import { intakeKindOf } from "@/lib/catch-up-intake";
import { listCompanyBankAccountOptions } from "@/lib/company-bank-accounts";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatContractPrice } from "@/lib/project-billing";
import {
  canManageProjects,
  getProjectWhereForUser,
} from "@/lib/project-access";
import {
  catchUpPageByOrdinal,
  catchUpPeriodKey,
  listCatchUpIntakePages,
} from "@/lib/project-catch-up-periods";
import { projectDetailHref } from "@/lib/project-directory-rows";
import { PROJECT_LIST_VIEW_PATHS } from "@/lib/project-status";
import { requireSession, toPermissionUser } from "@/lib/session";
import { firstStoredPath, parseStoredPaths } from "@/lib/stored-paths";
import { parseDateInput } from "@/lib/invoice-period";

export default async function ProjectCatchUpPeriodPage({
  params,
}: {
  params: Promise<{ id: string; ordinal: string }>;
}) {
  const session = await requireSession();
  const { id, ordinal: ordinalRaw } = await params;
  const ordinal = Number(ordinalRaw);
  const permissionUser = toPermissionUser(session);
  const projectWhere = await getProjectWhereForUser({
    companyId: session.user.companyId,
    clientId: session.user.clientId,
    userId: session.user.id,
    username: session.user.username,
  });
  const project = await prisma.project.findFirst({
    where: { id, ...projectWhere },
    include: {
      catchUpIntake: { select: { kind: true } },
      invoicePeriods: {
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          isCatchUp: true,
          invoicePdfPath: true,
          taxInvoiceDocumentPath: true,
          paymentProofPath: true,
          amount: true,
          paidAt: true,
          bankAccount: {
            select: {
              bankName: true,
              accountNumber: true,
              accountHolder: true,
              label: true,
            },
          },
        },
      },
    },
  });
  if (!project) redirect(PROJECT_LIST_VIEW_PATHS.all);

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const canManage = canManageProjects(permissionUser);
  if (!canManage || session.user.clientId || !Number.isInteger(ordinal)) {
    redirect(projectDetailHref(project.id));
  }

  const catchUpKind = intakeKindOf(project);
  const pages = catchUpKind
    ? listCatchUpIntakePages({
        catchUpKind,
        status: project.status,
        isComplimentary: project.isComplimentary,
        isDemo: project.isDemo,
        subCategory: project.subCategory,
        billingMode: project.billingMode,
        startDate: project.startDate,
        endDate: project.endDate,
        basis: project.billingPeriodBasis,
        fromDay: project.billingCycleStartDay,
        toDay: project.billingCycleEndDay,
        asOf: catchUpAsOfDate(
          await loadBooksOpenDate(project.companyId),
          jakartaTodayAsUtcDateOnly()
        ),
        existingPeriods: project.invoicePeriods,
      })
    : [];
  const page = catchUpPageByOrdinal(pages, ordinal);
  if (!page) {
    redirect(`/projects/${project.id}/catch-up`);
  }

  const recordedPeriod = project.invoicePeriods.find(
    (period) =>
      period.isCatchUp &&
      catchUpPeriodKey(period.periodStart, period.periodEnd) ===
        catchUpPeriodKey(page.periodStart, page.periodEnd) &&
      period.invoicePdfPath
  );

  const expenses = recordedPeriod
    ? await prisma.projectExpense.findMany({
        where: {
          projectId: project.id,
          isCatchUp: true,
          incurredAt: parseDateInput(page.periodEnd),
        },
        select: {
          id: true,
          category: true,
          amount: true,
          reason: true,
          proofPath: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const bankAccounts = await listCompanyBankAccountOptions(project.companyId);
  const title =
    page.kind === "job"
      ? t("pages.projects.catchUp.dialogTitleJob")
      : t("pages.projects.catchUp.dialogTitlePeriod", { label: page.label });

  return (
    <AppShell title={title}>
      <BackLink href={`/projects/${project.id}/catch-up`}>
        {t("pages.projects.catchUp.backToHub")}
      </BackLink>
      <SectionCard className="mt-4">
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        <p className="mt-1 text-sm text-subtle">
          {formatDisplayDate(page.periodStart, { timeZone: "UTC" })}
          {" – "}
          {formatDisplayDate(page.periodEnd, { timeZone: "UTC" })}
        </p>
        {recordedPeriod ? (
          <div className="mt-6 space-y-3 text-sm">
            <p className="rounded-xl border border-border bg-elevated px-4 py-3">
              {t("pages.projects.catchUp.readOnlyHint")}
            </p>
            <p>
              {t("pages.projects.catchUp.clientPays")}:{" "}
              {formatContractPrice(decimalToNumber(recordedPeriod.amount))}
            </p>
            {recordedPeriod.paidAt ? (
              <p>
                {t("pages.projects.catchUp.paidDate")}:{" "}
                {formatDisplayDate(recordedPeriod.paidAt, { timeZone: "UTC" })}
              </p>
            ) : null}
            {recordedPeriod.bankAccount ? (
              <p>
                {t("pages.projects.catchUp.receivingBank")}:{" "}
                {recordedPeriod.bankAccount.label ||
                  recordedPeriod.bankAccount.bankName}
              </p>
            ) : null}
            {expenses.map((expense) => (
              <p key={expense.id}>
                {expense.reason}: {formatContractPrice(decimalToNumber(expense.amount))}
              </p>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              {[
                firstStoredPath(recordedPeriod.invoicePdfPath)
                  ? {
                      href: firstStoredPath(recordedPeriod.invoicePdfPath)!,
                      label: t("pages.projects.catchUp.invoice"),
                    }
                  : null,
                firstStoredPath(recordedPeriod.taxInvoiceDocumentPath)
                  ? {
                      href: firstStoredPath(recordedPeriod.taxInvoiceDocumentPath)!,
                      label: t("pages.projects.catchUp.taxInvoice"),
                    }
                  : null,
                firstStoredPath(recordedPeriod.paymentProofPath)
                  ? {
                      href: firstStoredPath(recordedPeriod.paymentProofPath)!,
                      label: t("pages.projects.catchUp.paymentProof"),
                    }
                  : null,
                ...expenses.flatMap((expense) =>
                  parseStoredPaths(expense.proofPath).map((href, index) => ({
                    href,
                    label: `${expense.reason}${
                      parseStoredPaths(expense.proofPath).length > 1
                        ? ` ${index + 1}`
                        : ""
                    }`,
                  }))
                ),
              ]
                .filter((row): row is { href: string; label: string } =>
                  Boolean(row)
                )
                .map((row) => (
                  <Link
                    key={row.href}
                    href={row.href}
                    className="text-primary hover:underline"
                    target="_blank"
                  >
                    {row.label}
                  </Link>
                ))}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <p className="mb-4 text-sm text-subtle">
              {t("pages.projects.catchUp.pageHint")}
            </p>
            <ProjectCatchUpPeriodForm
              projectId={project.id}
              target={page}
              bankAccounts={bankAccounts}
            />
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
