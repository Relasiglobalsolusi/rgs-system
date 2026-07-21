import { redirect } from "next/navigation";

import MultiProjectUnlockForm from "@/components/clients/MultiProjectUnlockForm";
import { formatContactPersonName } from "@/lib/contact-person";
import { isMultiProjectAccessActive } from "@/lib/multi-project-access";
import { readMultiProjectUnlock } from "@/lib/multi-project-unlock";
import { prisma } from "@/lib/prisma";
import { requireMultiProjectUnlockSession } from "@/lib/session";

export default async function MultiProjectUnlockPage() {
  const session = await requireMultiProjectUnlockSession();
  const clientId = session.user.clientId!;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      name: true,
      multiProjectAccess: true,
      contactPersonFirstName: true,
      contactPersonLastName: true,
    },
  });

  if (!client) {
    redirect("/login");
  }

  const active = await isMultiProjectAccessActive({
    multiProjectAccess: client.multiProjectAccess,
    clientId,
  });

  if (!active) {
    redirect("/dashboard");
  }

  const unlock = await readMultiProjectUnlock(clientId);
  if (unlock) {
    redirect("/dashboard");
  }

  const picHint =
    formatContactPersonName(
      client.contactPersonFirstName,
      client.contactPersonLastName
    ) ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <MultiProjectUnlockForm clientName={client.name} picHint={picHint} />
    </main>
  );
}
