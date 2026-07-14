import AppShell from "@/components/layout/AppShell";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Bell,
  Bot,
  Building2,
  ChevronRight,
  Database,
  Palette,
  Plug,
  ShieldCheck,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";

const settingsSections = [
  {
    title: "Company",
    description:
      "Manage your company identity, contact details, address, and business settings.",
    icon: Building2,
    href: "/settings/company",
    status: "Available",
  },
  {
    title: "Users",
    description:
      "Manage internal users, client users, access status, and account details.",
    icon: Users,
    href: "/users",
    status: "In progress",
  },
  {
    title: "Roles & Permissions",
    description:
      "Control access to modules, actions, approvals, and administrative functions.",
    icon: ShieldCheck,
    href: "/settings/roles",
    status: "Planned",
  },
  {
    title: "Branding",
    description:
      "Configure company logos, application identity, colors, and document branding.",
    icon: Palette,
    href: "/settings/branding",
    status: "Planned",
  },
  {
    title: "Notifications",
    description:
      "Manage email notifications, alerts, reminders, and approval updates.",
    icon: Bell,
    href: "/settings/notifications",
    status: "Planned",
  },
  {
    title: "Integrations",
    description:
      "Connect RGS ONE with external applications, services, and business tools.",
    icon: Plug,
    href: "/settings/integrations",
    status: "Planned",
  },
  {
    title: "AI Assistant",
    description:
      "Configure future AI features, company knowledge, automation, and permissions.",
    icon: Bot,
    href: "/settings/ai",
    status: "Planned",
  },
  {
    title: "System",
    description:
      "View system information, database status, application version, and maintenance tools.",
    icon: Database,
    href: "/settings/system",
    status: "Planned",
  },
];

function getStatusClass(status: string) {
  if (status === "Available") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "In progress") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  }

  return "border-white/10 bg-white/[0.04] text-slate-500";
}

export default async function SettingsPage() {
  const session = await getCurrentSession();

  if (!session?.user?.companyId) {
    redirect("/login");
  }

  const company = await prisma.company.findUnique({
    where: {
      id: session.user.companyId,
    },
    select: {
      name: true,
      email: true,
      phone: true,
      address: true,
      _count: {
        select: {
          users: true,
          employees: true,
          departments: true,
          projects: true,
        },
      },
    },
  });

  if (!company) {
    redirect("/login");
  }

  return (
    <AppShell
      title="Settings"
      description="Manage your RGS ONE workspace, users, security, and system configuration."
    >
      <section className="rounded-3xl border border-white/5 bg-[#151b22] p-8 shadow-xl">
        <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#54bfb4] to-[#586bb7] text-white shadow-lg">
                <Building2 size={25} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#54bfb4]">
                  Active Workspace
                </p>

                <h2 className="mt-1 text-2xl font-semibold text-white">
                  {company.name}
                </h2>
              </div>
            </div>

            <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-400">
              This workspace contains the users, employees, departments,
              projects, permissions, and operational data belonging to{" "}
              {company.name}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="min-w-28 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4 text-center">
              <p className="text-2xl font-semibold text-white">
                {company._count.users}
              </p>
              <p className="mt-1 text-xs text-slate-500">Users</p>
            </div>

            <div className="min-w-28 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4 text-center">
              <p className="text-2xl font-semibold text-white">
                {company._count.employees}
              </p>
              <p className="mt-1 text-xs text-slate-500">Employees</p>
            </div>

            <div className="min-w-28 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4 text-center">
              <p className="text-2xl font-semibold text-white">
                {company._count.departments}
              </p>
              <p className="mt-1 text-xs text-slate-500">Departments</p>
            </div>

            <div className="min-w-28 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4 text-center">
              <p className="text-2xl font-semibold text-white">
                {company._count.projects}
              </p>
              <p className="mt-1 text-xs text-slate-500">Projects</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-white">
            Administration
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Configure the core services and controls used across RGS ONE.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const isAvailable =
              section.status === "Available" ||
              section.status === "In progress";

            const content = (
              <>
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.04] text-slate-300 transition group-hover:border-[#54bfb4]/20 group-hover:bg-[#54bfb4]/10 group-hover:text-[#54bfb4]">
                    <Icon size={24} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-base font-semibold text-white">
                        {section.title}
                      </h3>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getStatusClass(
                          section.status
                        )}`}
                      >
                        {section.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      {section.description}
                    </p>
                  </div>

                  <ChevronRight
                    size={20}
                    className="mt-1 shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-[#54bfb4]"
                  />
                </div>
              </>
            );

            if (!isAvailable) {
              return (
                <div
                  key={section.title}
                  className="group rounded-3xl border border-white/5 bg-[#151b22] p-6 opacity-70"
                >
                  {content}
                </div>
              );
            }

            return (
              <a
                key={section.title}
                href={section.href}
                className="group rounded-3xl border border-white/5 bg-[#151b22] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-[#54bfb4]/20 hover:bg-[#18212a]"
              >
                {content}
              </a>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/5 bg-[#151b22] p-7">
        <h2 className="text-lg font-semibold text-white">
          Company information
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
              Company
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {company.name}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
              Email
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {company.email || "Not configured"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
              Phone
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {company.phone || "Not configured"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
              Address
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {company.address || "Not configured"}
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}