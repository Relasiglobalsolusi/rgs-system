"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  createPasswordResetToken,
  getPasswordResetExpiry,
} from "@/lib/password-reset";
import { normalizeUsername } from "@/lib/username";

type ForgotPasswordResult =
  | { status: "sent" }
  | { status: "no_email" }
  | { status: "not_found" };

export async function requestPasswordReset(
  formData: FormData
): Promise<ForgotPasswordResult> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));

  if (!username) {
    return { status: "not_found" };
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, email: true, active: true },
  });

  if (!user || !user.active) {
    return { status: "not_found" };
  }

  if (!user.email) {
    return { status: "no_email" };
  }

  const token = createPasswordResetToken();
  const expiresAt = getPasswordResetExpiry();

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  return { status: "sent" };
}

type ResetPasswordResult =
  | { status: "success" }
  | { status: "invalid_token" }
  | { status: "weak_password" };

export async function resetPassword(
  formData: FormData
): Promise<ResetPasswordResult> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { status: "invalid_token" };
  }

  if (!password || password.length < 6) {
    return { status: "weak_password" };
  }

  if (password !== confirmPassword) {
    return { status: "weak_password" };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: {
      user: {
        select: { id: true, active: true },
      },
    },
  });

  if (
    !resetToken ||
    !resetToken.user.active ||
    resetToken.expiresAt < new Date()
  ) {
    return { status: "invalid_token" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        passwordDisplay: password,
        mustSetPassword: false,
      },
    }),
    prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    }),
  ]);

  revalidatePath("/login");
  revalidatePath("/employees");

  return { status: "success" };
}
