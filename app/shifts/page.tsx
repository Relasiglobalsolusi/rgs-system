import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import ShiftsDirectory from "@/components/shifts/ShiftsDirectory";
import ShiftsProjectPicker from "@/components/shifts/ShiftsProjectPicker";
import { buttonVariants } from "@/components/ui/button";
import { createTranslator } from "@/lib/i18n/translate";
import { getServerLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await requireModule("shifts");
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const companyId = session.user.companyId;
  const { projectId: projectIdRaw } = await searchParams;
  const projectId = projectIdRaw?.trim() || null;

  if (!companyId) {
    return (
      <AppShell
        title={t("pages.shifts.title")}
        description={t("pages.shifts.description")}
      >
        <ShiftsProjectPicker projects={[]} />
      </AppShell>
    );
  }

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        companyId,
        status: "IN_PROGRESS",
      },
      select: {
        id: true,
        name: true,
        location: true,
        client: { select: { name: true } },
      },
    });

    if (!project) {
      return (
        <AppShell
          title={t("pages.shifts.title")}
          description={t("pages.shifts.description")}
        >
          <div className="mb-4">
            <Link
              href="/shifts"
              className={cn(
                buttonVariants({ variant: "infoBadge", size: "badge" }),
                "inline-flex gap-1.5"
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("pages.shifts.backToProjects")}
            </Link>
          </div>
          <ShiftsDirectory project={null} assignments={[]} projectMissing />
        </AppShell>
      );
    }

    const assignments = await prisma.projectAssignment.findMany({
      where: {
        projectId: project.id,
        employee: {
          status: { in: ["ACTIVE", "ON_LEAVE"] },
        },
      },
      select: {
        id: true,
        shiftStart: true,
        shiftEnd: true,
        employee: {
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
            employmentType: true,
          },
        },
      },
      orderBy: [
        { employee: { firstName: "asc" } },
        { employee: { lastName: "asc" } },
      ],
    });

    return (
      <AppShell
        title={t("pages.shifts.title")}
        description={t("pages.shifts.description")}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href="/shifts"
            className={cn(
              buttonVariants({ variant: "infoBadge", size: "badge" }),
              "inline-flex gap-1.5"
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("pages.shifts.backToProjects")}
          </Link>
          <div className="flex min-w-0 items-start gap-2">
            <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="font-semibold text-text">{project.name}</div>
              <div className="text-sm text-muted">
                {[project.client?.name, project.location]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </div>
            </div>
          </div>
        </div>
        <ShiftsDirectory
          project={{
            id: project.id,
            name: project.name,
            clientName: project.client?.name ?? null,
          }}
          assignments={assignments}
        />
      </AppShell>
    );
  }

  const projects = await prisma.project.findMany({
    where: {
      companyId,
      status: "IN_PROGRESS",
    },
    select: {
      id: true,
      name: true,
      location: true,
      client: { select: { name: true } },
      assignments: {
        where: {
          employee: { status: { in: ["ACTIVE", "ON_LEAVE"] } },
        },
        select: { id: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell
      title={t("pages.shifts.title")}
      description={t("pages.shifts.description")}
    >
      <ShiftsProjectPicker
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          location: project.location,
          clientName: project.client?.name ?? null,
          staffCount: project.assignments.length,
        }))}
      />
    </AppShell>
  );
}
