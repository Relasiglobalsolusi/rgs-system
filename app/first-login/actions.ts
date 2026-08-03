"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  assertRecoveryEmailAvailable,
  isLinkedPortalLogin,
  isValidRecoveryEmail,
  needsInitialPasswordSetup,
  normalizeRecoveryEmail,
} from "@/lib/user-account";
import { isPlaceholderPasswordHash } from "@/lib/unusable-password";
import { normalizeUsername } from "@/lib/username";

type FirstLoginResult =
  | { status: "success" }
  | { status: "not_found" }
  | { status: "not_required" }
  | { status: "inactive" }
  | { status: "weak_password" }
  | { status: "mismatch" }
  | { status: "invalid_email" }
  | { status: "email_taken" };

export async function setInitialPassword(
  formData: FormData
): Promise<FirstLoginResult> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const recoveryEmail = normalizeRecoveryEmail(
    String(formData.get("recoveryEmail") ?? "")
  );

  if (!username) {
    return { status: "not_found" };
  }

  if (!password || password.length < 8) {
    return { status: "weak_password" };
  }

  if (password !== confirmPassword) {
    return { status: "mismatch" };
  }

  if (!recoveryEmail || !isValidRecoveryEmail(recoveryEmail)) {
    return { status: "invalid_email" };
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      active: true,
      mustSetPassword: true,
      email: true,
      passwordDisplay: true,
      passwordHash: true,
      passwordSetupCompletedAt: true,
      clientId: true,
      vendorId: true,
      employee: { select: { id: true } },
    },
  });

  if (!user) {
    return { status: "not_found" };
  }

  if (!user.active) {
    return { status: "inactive" };
  }

  const linkedPortalLogin = isLinkedPortalLogin(user);
  const needsSetup =
    needsInitialPasswordSetup({
      mustSetPassword: user.mustSetPassword,
      email: user.email,
      passwordDisplay: user.passwordDisplay,
      passwordSetupCompletedAt: user.passwordSetupCompletedAt,
      isLinkedPortalLogin: linkedPortalLogin,
    }) || (await isPlaceholderPasswordHash(user.passwordHash));

  if (!needsSetup) {
    return { status: "not_required" };
  }

  try {
    await assertRecoveryEmailAvailable(recoveryEmail, user.id);
  } catch {
    return { status: "email_taken" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordDisplay: null,
      mustSetPassword: false,
      email: recoveryEmail,
      passwordSetupCompletedAt: new Date(),
    },
  });

  revalidatePath("/first-login");
  revalidatePath("/login");
  revalidatePath("/employees");
  revalidatePath("/users");

  return { status: "success" };
}
