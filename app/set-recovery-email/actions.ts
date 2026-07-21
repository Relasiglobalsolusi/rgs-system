"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assertRecoveryEmailAvailable,
  isValidRecoveryEmail,
  needsRecoveryEmail,
  normalizeRecoveryEmail,
} from "@/lib/user-account";

type SetRecoveryEmailResult =
  | { status: "success" }
  | { status: "unauthorized" }
  | { status: "not_required" }
  | { status: "invalid_email" }
  | { status: "email_taken" };

export async function setRecoveryEmail(
  formData: FormData
): Promise<SetRecoveryEmailResult> {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return { status: "unauthorized" };
  }

  const recoveryEmail = normalizeRecoveryEmail(
    String(formData.get("recoveryEmail") ?? "")
  );

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, mustSetPassword: true },
  });

  if (!user) {
    return { status: "unauthorized" };
  }

  if (user.mustSetPassword) {
    return { status: "unauthorized" };
  }

  if (!needsRecoveryEmail(user.email)) {
    return { status: "not_required" };
  }

  if (!recoveryEmail || !isValidRecoveryEmail(recoveryEmail)) {
    return { status: "invalid_email" };
  }

  try {
    await assertRecoveryEmailAvailable(recoveryEmail, session.user.id);
  } catch {
    return { status: "email_taken" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { email: recoveryEmail },
  });

  revalidatePath("/set-recovery-email");
  revalidatePath("/users");

  return { status: "success" };
}
