"use server";

import { revalidatePath } from "next/cache";
import type { OperationsTeamKind } from "@prisma/client";

import {
  eligibleTeamMemberWhere,
  legacyKindForCatalogArea,
  OPEN_TEAM_PROJECT_STATUSES,
  releaseTeamMemberFromOpenJobs,
  syncTeamMemberOntoOpenJobs,
} from "@/lib/operations-teams";
import { releaseIdleEmployeesToUnassignedPool } from "@/lib/workforce-crew";
import { prisma } from "@/lib/prisma";
import { canManageTeams } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

async function requireTeamManager() {
  const session = await requireModule("teams");
  const user = toPermissionUser(session);
  if (!canManageTeams(user)) {
    throw new Error("You do not have permission to manage teams.");
  }
  const companyId = session.user.companyId;
  if (!companyId) {
    throw new Error("Company not found.");
  }
  return { companyId };
}

function readName(formData: FormData) {
  return String(formData.get("name") ?? "").trim();
}

async function readServiceAreaCatalog(
  formData: FormData,
  companyId: string
): Promise<{
  serviceAreaCatalogId: string;
  kind: OperationsTeamKind | null;
}> {
  const catalogId = String(
    formData.get("serviceAreaCatalogId") ?? formData.get("kind") ?? ""
  ).trim();
  if (!catalogId) {
    throw new Error("Choose a team type.");
  }
  const area = await prisma.projectServiceAreaCatalog.findFirst({
    where: { id: catalogId, companyId },
    select: { id: true, slug: true, systemArea: true },
  });
  if (!area) {
    throw new Error("Choose a team type.");
  }
  return {
    serviceAreaCatalogId: area.id,
    kind: legacyKindForCatalogArea(area),
  };
}

export async function createOperationsTeam(formData: FormData) {
  const { companyId } = await requireTeamManager();
  const name = readName(formData);
  if (!name) {
    throw new Error("Enter a team name.");
  }
  const { serviceAreaCatalogId, kind } = await readServiceAreaCatalog(
    formData,
    companyId
  );
  const last = await prisma.operationsTeam.findFirst({
    where: { companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.operationsTeam.create({
    data: {
      companyId,
      name,
      kind,
      serviceAreaCatalogId,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

export async function updateOperationsTeam(formData: FormData) {
  const { companyId } = await requireTeamManager();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const name = readName(formData);
  if (!teamId) throw new Error("Team not found.");
  if (!name) throw new Error("Enter a team name.");
  const { serviceAreaCatalogId, kind } = await readServiceAreaCatalog(
    formData,
    companyId
  );

  const team = await prisma.operationsTeam.findFirst({
    where: { id: teamId, companyId },
    select: { id: true },
  });
  if (!team) throw new Error("Team not found.");

  await prisma.operationsTeam.update({
    where: { id: teamId },
    data: { name, kind, serviceAreaCatalogId },
  });
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

export async function deleteOperationsTeam(formData: FormData) {
  const { companyId } = await requireTeamManager();
  const teamId = String(formData.get("teamId") ?? "").trim();
  if (!teamId) throw new Error("Team not found.");

  const team = await prisma.operationsTeam.findFirst({
    where: { id: teamId, companyId },
    select: { id: true },
  });
  if (!team) throw new Error("Team not found.");

  const openJobs = await prisma.operationsTeamProject.count({
    where: {
      teamId,
      team: { companyId },
      project: { status: { in: [...OPEN_TEAM_PROJECT_STATUSES] } },
    },
  });
  const openVisitJobs = await prisma.projectVisitAssignment.count({
    where: {
      teamId,
      visit: {
        project: {
          companyId,
          status: { in: [...OPEN_TEAM_PROJECT_STATUSES] },
        },
      },
    },
  });
  if (openJobs > 0 || openVisitJobs > 0) {
    throw new Error(
      "This team is on a job. Take it off the job before deleting it."
    );
  }

  await prisma.$transaction(async (tx) => {
    const members = await tx.operationsTeamMember.findMany({
      where: { teamId },
      select: { employeeId: true },
    });
    await tx.operationsTeam.delete({ where: { id: teamId } });
    await releaseIdleEmployeesToUnassignedPool(
      tx,
      members.map((member) => member.employeeId)
    );
  });
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
  revalidatePath("/employees");
  revalidatePath("/projects");
}

export async function addOperationsTeamMember(formData: FormData) {
  const { companyId } = await requireTeamManager();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  if (!teamId || !employeeId) {
    throw new Error("Select an employee.");
  }

  const team = await prisma.operationsTeam.findFirst({
    where: { id: teamId, companyId },
    select: { id: true },
  });
  if (!team) throw new Error("Team not found.");

  const existing = await prisma.operationsTeamMember.findUnique({
    where: { employeeId },
    include: {
      team: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
  });
  if (existing) {
    const name = `${existing.employee.firstName} ${existing.employee.lastName}`.trim();
    throw new Error(`${name} is already on ${existing.team.name}.`);
  }

  const eligible = await prisma.employee.findFirst({
    where: { id: employeeId, ...eligibleTeamMemberWhere(companyId) },
    select: { id: true },
  });
  if (!eligible) {
    throw new Error(
      "Select an available full-time Operations cleaning employee who is not already on a team."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.operationsTeamMember.create({
      data: { teamId, employeeId },
    });
    await syncTeamMemberOntoOpenJobs(tx, companyId, teamId, employeeId);
  });

  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

export async function removeOperationsTeamMember(formData: FormData) {
  const { companyId } = await requireTeamManager();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  if (!teamId || !employeeId) {
    throw new Error("Employee not found.");
  }

  const membership = await prisma.operationsTeamMember.findFirst({
    where: { teamId, employeeId, team: { companyId } },
    select: { id: true },
  });
  if (!membership) throw new Error("This employee is not on that team.");

  await prisma.$transaction(async (tx) => {
    await releaseTeamMemberFromOpenJobs(tx, teamId, employeeId);
    await releaseIdleEmployeesToUnassignedPool(tx, [employeeId]);
    await tx.operationsTeamMember.delete({ where: { id: membership.id } });
  });

  revalidatePath("/teams");
  revalidatePath("/teams/availability");
  revalidatePath("/employees");
  revalidatePath("/projects");
}
