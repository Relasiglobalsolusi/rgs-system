import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requirePasswordChangeSession } from "@/lib/session";
import { needsRecoveryEmail } from "@/lib/user-account";

import SetPasswordForm from "@/components/auth/SetPasswordForm";

export default async function SetPasswordPage() {
  const session = await requirePasswordChangeSession();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, mustSetPassword: true, email: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (!user.mustSetPassword) {
    if (needsRecoveryEmail(user.email)) {
      redirect("/set-recovery-email");
    }
    redirect("/dashboard");
  }

  return (
    <SetPasswordForm
      username={user.username}
      displayName={session.user.name ?? user.username}
      requireRecoveryEmail={needsRecoveryEmail(user.email)}
    />
  );
}
