"use server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import {
  sanitizeSidebarOrder,
  type SidebarOrder,
} from "@/lib/sidebar-order";

export async function updateMySidebarOrder(order: SidebarOrder) {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    throw new Error("You must be signed in to rearrange the sidebar.");
  }

  if (session.user.mustSetPassword || session.user.mustSetRecoveryEmail) {
    throw new Error("Finish account setup before rearranging the sidebar.");
  }

  const sanitized = sanitizeSidebarOrder(order);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      sidebarOrder: sanitized ?? Prisma.DbNull,
    },
  });

  return sanitized;
}
