"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

const PROJECT_GROUP_FIELD_PREFIX = "mpProjectGroup.";

/** Persist project → group mapping from Edit Client save (hidden fields). */
export async function persistClientProjectGroupMembership(
  clientId: string,
  formData: FormData
) {
  const assignments = new Map<string, string | null>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(PROJECT_GROUP_FIELD_PREFIX)) continue;
    if (typeof value !== "string") continue;
    const projectId = key.slice(PROJECT_GROUP_FIELD_PREFIX.length).trim();
    if (!projectId) continue;
    assignments.set(projectId, value.trim() || null);
  }
  if (assignments.size === 0) return;

  const ids = [...assignments.keys()];
  const owned = await prisma.project.findMany({
    where: { id: { in: ids }, clientId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((row) => row.id));

  const groupIds = [
    ...new Set(
      [...assignments.values()].filter((groupId): groupId is string =>
        Boolean(groupId)
      )
    ),
  ];
  const validGroups =
    groupIds.length === 0
      ? []
      : await prisma.clientProjectGroup.findMany({
          where: { id: { in: groupIds }, clientId },
          select: { id: true },
        });
  const validGroupIds = new Set(validGroups.map((row) => row.id));

  for (const [projectId, groupId] of assignments) {
    if (!ownedIds.has(projectId) || !groupId) continue;
    if (!validGroupIds.has(groupId)) continue;
    await prisma.project.update({
      where: { id: projectId },
      data: { groupId },
    });
  }

  revalidatePath("/clients");
  revalidatePath("/projects");
}
