import Link from "next/link";
import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import BackLink from "@/components/ui/BackLink";
import SectionCard from "@/components/ui/SectionCard";
import { buttonVariants } from "@/components/ui/button";
import { catchUpAsOfDate, loadBooksOpenDate } from "@/lib/books-open";
import { intakeKindOf } from "@/lib/catch-up-intake";
import { formatDisplayDate } from "@/lib/format-date";
import { getServerLocale } from "@/lib/i18n/locale";
import { createTranslator } from "@/lib/i18n/translate";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { prisma } from "@/lib/prisma";
import {
  canManageProjects,
  getProjectWhereForUser,
} from "@/lib/project-access";
import { listCatchUpIntakePages } from "@/lib/project-catch-up-periods";
import { projectDetailHref } from "@/lib/project-directory-rows";
import { PROJECT_LIST_VIEW_PATHS } from "@/lib/project-status";
import { requireSession, toPermissionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function ProjectCatchUpHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
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
          periodStart: true,
          periodEnd: true,
          isCatchUp: true,
          invoicePdfPath: true,
        },
      },
    },
  });
  if (!project) redirect(PROJECT_LIST_VIEW_PATHS.all);

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const canManage = canManageProjects(permissionUser);
  if (!canManage || session.user.clientId) {
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

  if (pages.length === 0) {
    redirect(projectDetailHref(project.id));
  }

  return (
    <AppShell title={t("pages.projects.catchUp.hubTitle")}>
      <BackLink href={projectDetailHref(project.id)}>
        {t("pages.projects.catchUp.backToProject")}
      </BackLink>
      <SectionCard className="mt-4">
        <h1 className="text-lg font-semibold text-text">
          {t("pages.projects.catchUp.hubTitle")}
        </h1>
        <p className="mt-1 text-sm text-subtle">
          {t("pages.projects.catchUp.hubHint")}
        </p>
        <ul className="mt-5 divide-y divide-border">
          {pages.map((page) => (
            <li
              key={`${page.periodStart}_${page.periodEnd}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-text">
                  {page.kind === "job"
                    ? t("pages.projects.catchUp.dialogTitleJob")
                    : page.label}
                </p>
                <p className="text-xs text-subtle">
                  {formatDisplayDate(page.periodStart, { timeZone: "UTC" })}
                  {" – "}
                  {formatDisplayDate(page.periodEnd, { timeZone: "UTC" })}
                  {page.recorded
                    ? ` · ${t("pages.projects.catchUp.recorded")}`
                    : ` · ${t("pages.projects.catchUp.needsCapture")}`}
                </p>
              </div>
              <Link
                href={`/projects/${project.id}/catch-up/${page.ordinal}`}
                className={cn(
                  buttonVariants({
                    variant: page.recorded ? "outline" : "successBadge",
                    size: "sm",
                  })
                )}
              >
                {page.recorded
                  ? t("pages.projects.catchUp.viewPeriod")
                  : t("pages.projects.catchUp.openPeriod")}
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </AppShell>
  );
}
