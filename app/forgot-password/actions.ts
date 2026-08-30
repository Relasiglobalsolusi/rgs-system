"use server";

import { revalidatePath } from "next/cache";

import { appPublicBaseUrl, sendTransactionalEmail } from "@/lib/mail";
import { passwordResetEmail } from "@/lib/transactional-email";
import { prisma } from "@/lib/prisma";
import {
  createPasswordResetToken,
  getPasswordResetExpiry,
} from "@/lib/password-reset";
import { notifyLoginSessionClaimed } from "@/lib/session-watch";
import { resolvePasswordChange } from "@/lib/user-account";
import { normalizeUsername } from "@/lib/username";

type ForgotPasswordResult =
  | { status: "sent" }
  | { status: "no_email" }
  | { status: "not_found" }
  | { status: "send_failed" };

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
    // Avoid username enumeration: same UX as a successful request when possible.
    return { status: "sent" };
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

  const resetUrl = `${appPublicBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const mailBody = passwordResetEmail({ username, resetUrl });
  const mail = await sendTransactionalEmail({
    to: user.email,
    subject: mailBody.subject,
    text: mailBody.text,
    html: mailBody.html,
  });

  if (!mail.sent) {
    // Token remains valid so ops can still help; do not claim email was delivered.
    console.error(
      `[forgot-password] Token created for user ${user.id} but email not sent (${mail.reason}).`
    );
    return { status: "send_failed" };
  }

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

  if (!password || password.length < 8) {
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

  const credentials = await resolvePasswordChange(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        ...credentials,
        sessionToken: null,
        sessionIssuedAt: null,
      },
    }),
    prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    }),
  ]);
  notifyLoginSessionClaimed(resetToken.userId, "");

  revalidatePath("/login");
  revalidatePath("/employees");
  revalidatePath("/users");

  return { status: "success" };
}
