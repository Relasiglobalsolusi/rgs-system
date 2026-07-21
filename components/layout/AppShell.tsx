import type { ReactNode } from "react";

import MultiProjectUnlockActivity from "@/components/clients/MultiProjectUnlockActivity";
import { getCurrentSession } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n/messages";
import { resolveMultiProjectAccessActive } from "@/lib/multi-project-access";

import Header from "./Header";
import PageContent from "./PageContent";
import Sidebar from "./Sidebar";

type AppShellProps = {
  /** Dynamic title (e.g. client/project name). Prefer titleKey for static chrome. */
  title?: string;
  /** Message key — translated in Header so locale switches update without reload. */
  titleKey?: MessageKey | string;
  description?: string;
  descriptionKey?: MessageKey | string;
  greetingName?: string;
  children: ReactNode;
};

export default async function AppShell({
  title,
  titleKey,
  description,
  descriptionKey,
  greetingName,
  children,
}: AppShellProps) {
  const session = await getCurrentSession();
  const showChangeSecurityCode = await resolveMultiProjectAccessActive(
    session?.user?.clientId
  );

  return (
    <main className="min-h-screen w-full bg-background text-text lg:h-screen lg:overflow-hidden">
      <MultiProjectUnlockActivity enabled={showChangeSecurityCode} />
      <div className="flex min-h-screen w-full lg:h-full">
        <Sidebar showChangeSecurityCode={showChangeSecurityCode} />

        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
          <Header
            title={title}
            titleKey={titleKey}
            description={description}
            descriptionKey={descriptionKey}
            greetingName={greetingName}
          />

          <div
            className="
              app-shell-surface
              w-full
              min-h-0
              flex-1
              overflow-auto
              px-4
              pt-7
              pb-4
              sm:px-7
              sm:pt-8
              sm:pb-6
              md:px-9
              md:pt-8
              md:pb-7
              lg:px-10
              xl:px-12
            "
          >
            <PageContent>{children}</PageContent>
          </div>
        </div>
      </div>
    </main>
  );
}
