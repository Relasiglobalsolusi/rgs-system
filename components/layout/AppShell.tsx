import type { ReactNode } from "react";

import type { MessageKey } from "@/lib/i18n/messages";

import Header from "./Header";
import PageContent from "./PageContent";

type AppShellProps = {
  /** Dynamic title (e.g. client/project name). Prefer titleKey for static chrome. */
  title?: string;
  /** Message key — translated in Header so locale switches update without reload. */
  titleKey?: MessageKey | string;
  greetingName?: string;
  children: ReactNode;
};

export default function AppShell({
  title,
  titleKey,
  greetingName,
  children,
}: AppShellProps) {
  return (
    <>
      <Header
        title={title}
        titleKey={titleKey}
        greetingName={greetingName}
      />

      <div
        className="
          app-shell-surface
          w-full
          min-h-0
          min-w-0
          flex-1
          overflow-x-hidden
          overflow-y-auto
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
    </>
  );
}
