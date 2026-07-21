import { prisma } from "@/lib/prisma";

export function parseModuleOverrides(
  value: unknown
): Record<string, boolean> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, boolean>;
  }
  return null;
}

/** Load current moduleOverrides from DB (JWT can be stale after Permissions save). */
export async function fetchUserModuleOverrides(
  userId: string
): Promise<Record<string, boolean> | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { moduleOverrides: true },
  });

  if (!user) return null;
  return parseModuleOverrides(user.moduleOverrides);
}
