"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assertRecoveryEmailAvailable,
  isValidRecoveryEmail,
  needsRecoveryEmail,
  normalizeRecoveryEmail,
} from "@/lib/user-account";

type SetPasswordResult =
  | { status: "success" }
  | { status: "unauthorized" }
  | { status: "not_required" }
  | { status: "weak_password" }
  | { status: "mismatch" }
  | { status: "invalid_email" }
  | { status: "email_taken" };

export async function setPassword(formData: FormData): Promise<SetPasswordResult> {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return { status: "unauthorized" };
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const recoveryEmail = normalizeRecoveryEmail(
    String(formData.get("recoveryEmail") ?? "")
  );

  if (!password || password.length < 6) {
    return { status: "weak_password" };
  }

  if (password !== confirmPassword) {
    return { status: "mismatch" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustSetPassword: true, email: true },
  });

  if (!user) {
    return { status: "unauthorized" };
  }

  if (!user.mustSetPassword) {
    return { status: "not_required" };
  }

  const requiresEmail = needsRecoveryEmail(user.email);
  if (requiresEmail) {
    if (!recoveryEmail || !isValidRecoveryEmail(recoveryEmail)) {
      return { status: "invalid_email" };
    }

    try {
      await assertRecoveryEmailAvailable(recoveryEmail, session.user.id);
    } catch {
      return { status: "email_taken" };
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash,
      passwordDisplay: password,
      mustSetPassword: false,
      ...(requiresEmail ? { email: recoveryEmail } : {}),
    },
  });

  revalidatePath("/set-password");
  revalidatePath("/login");
  revalidatePath("/employees");
  revalidatePath("/users");

  return { status: "success" };
}
