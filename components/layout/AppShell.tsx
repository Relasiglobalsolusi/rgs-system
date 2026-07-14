import type { ReactNode } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

type AppShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export default function AppShell({
  title,
  description,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex min-h-screen">
        {/* Sidebar */}

        <Sidebar />

        {/* Main */}

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            title={title}
            description={description}
          />

          <div
            className="
              flex-1
              overflow-auto
              bg-[radial-gradient(circle_at_top_left,rgba(84,191,180,0.05),transparent_35%),radial-gradient(circle_at_top_right,rgba(88,107,183,0.06),transparent_40%),linear-gradient(#0B0F14,#11161C)]
              px-10
              py-8
            "
          >
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}