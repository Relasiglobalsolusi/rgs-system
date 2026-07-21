import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requirePasswordChangeSession } from "@/lib/session";
import { needsRecoveryEmail } from "@/lib/user-account";

import SetRecoveryEmailForm from "@/components/auth/SetRecoveryEmailForm";

export default async function SetRecoveryEmailPage() {
  const session = await requirePasswordChangeSession();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, email: true, mustSetPassword: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.mustSetPassword) {
    redirect("/set-password");
  }

  if (!needsRecoveryEmail(user.email)) {
    redirect("/dashboard");
  }

  return (
    <SetRecoveryEmailForm
      username={user.username}
      displayName={session.user.name ?? user.username}
    />
  );
}
