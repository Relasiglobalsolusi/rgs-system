"use server";

import { revalidatePath } from "next/cache";
import type { OperationsTeamKind } from "@prisma/client";

import {
  eligibleTeamMemberWhere,
  isOperationsTeamKind,
  releaseTeamMemberFromOpenJobs,
  syncTeamMemberOntoOpenJobs,
} from "@/lib/operations-teams";
import { prisma } from "@/lib/prisma";
import { canManageTeams } from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

const OPEN_TEAM_PROJECT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "WAITING_FOR_APPROVAL",
] as const;

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

function readKind(formData: FormData): OperationsTeamKind {
  const kind = String(formData.get("kind") ?? "").trim();
  if (!isOperationsTeamKind(kind)) {
    throw new Error("Choose General Cleaning or Facade Cleaning.");
  }
  return kind;
}

export async function createOperationsTeam(formData: FormData) {
  const { companyId } = await requireTeamManager();
  const name = readName(formData);
  if (!name) {
    throw new Error("Enter a team name.");
  }
  const kind = readKind(formData);
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
  const kind = readKind(formData);

  const team = await prisma.operationsTeam.findFirst({
    where: { id: teamId, companyId },
    select: { id: true },
  });
  if (!team) throw new Error("Team not found.");

  await prisma.operationsTeam.update({
    where: { id: teamId },
    data: { name, kind },
  });
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}

export async function deleteOperationsTeam(formData: FormData) {
  const { companyId } = await requireTeamManager();
  const teamId = String(formData.get("teamId") ?? "").trim();
  if (!teamId) throw new Error("Team not found.");

  const openLinks = await prisma.operationsTeamProject.count({
    where: {
      teamId,
      team: { companyId },
      project: { status: { in: [...OPEN_TEAM_PROJECT_STATUSES] } },
    },
  });
  if (openLinks > 0) {
    throw new Error("Remove this team from open jobs before deleting it.");
  }

  await prisma.operationsTeam.deleteMany({
    where: { id: teamId, companyId },
  });
  revalidatePath("/teams");
  revalidatePath("/teams/availability");
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
    await tx.operationsTeamMember.delete({ where: { id: membership.id } });
  });

  revalidatePath("/teams");
  revalidatePath("/teams/availability");
}
