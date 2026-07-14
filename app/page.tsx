import Image from "next/image";
import {
  Bell,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Users,
} from "lucide-react";

const menuItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    active: true,
  },
  {
    label: "Projects",
    icon: FolderKanban,
  },
  {
    label: "Tasks",
    icon: CheckSquare,
  },
  {
    label: "Attendance",
    icon: CalendarDays,
  },
  {
    label: "Employees",
    icon: Users,
  },
  {
    label: "Settings",
    icon: Settings,
  },
];

const stats = [
  {
    title: "Active Projects",
    value: "12",
    detail: "3 due this month",
  },
  {
    title: "Employees Present",
    value: "38",
    detail: "4 currently absent",
  },
  {
    title: "Tasks Completed",
    value: "86%",
    detail: "12 tasks remaining",
  },
  {
    title: "Pending Approvals",
    value: "7",
    detail: "Requires your attention",
  },
];

const projects = [
  {
    name: "Corporate Website",
    progress: 78,
  },
  {
    name: "Warehouse Management",
    progress: 52,
  },
  {
    name: "Attendance System",
    progress: 34,
  },
];

const activities = [
  {
    title: "New project was created",
    time: "1 hour ago",
  },
  {
    title: "Attendance record approved",
    time: "2 hours ago",
  },
  {
    title: "Project task completed",
    time: "3 hours ago",
  },
  {
    title: "New employee added",
    time: "4 hours ago",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#111315] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-white/10 bg-[#17191c] lg:flex">
          <div className="flex h-24 items-center border-b border-white/10 px-6">
            <Image
              src="/logo.png"
              alt="Relasi Global Solusi"
              width={220}
              height={80}
              priority
              className="h-auto w-full max-w-[210px] object-contain"
            />
          </div>

          <nav className="flex-1 space-y-2 px-4 py-6">
            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                    item.active
                      ? "bg-[#586bb7] text-white shadow-lg shadow-[#586bb7]/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={19} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white">
              <LogOut size={19} />
              Sign out
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 items-center justify-between border-b border-white/10 bg-[#17191c] px-6 lg:px-8">
            <div>
              <h1 className="text-xl font-semibold text-white">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-400">
                Welcome back to RGS System
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-[#202327] px-3 py-2 md:flex">
                <Search size={18} className="text-slate-500" />

                <input
                  type="text"
                  placeholder="Search..."
                  className="w-48 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>

              <button className="rounded-xl border border-white/10 bg-[#202327] p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white">
                <Bell size={19} />
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#54bfb4] text-sm font-bold text-[#111315]">
                VL
              </div>
            </div>
          </header>

          <div className="flex-1 bg-[#111315] p-6 lg:p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Overview
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Monitor your projects, employees, and attendance.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.title}
                  className="rounded-2xl border border-white/10 bg-[#1b1e21] p-6 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-white/20"
                >
                  <p className="text-sm font-medium text-slate-400">
                    {stat.title}
                  </p>

                  <p className="mt-4 text-3xl font-semibold text-white">
                    {stat.value}
                  </p>

                  <p className="mt-3 text-sm text-slate-500">{stat.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-3">
              <section className="rounded-2xl border border-white/10 bg-[#1b1e21] p-6 shadow-xl shadow-black/10 xl:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">
                      Project Progress
                    </h3>

                    <p className="mt-1 text-sm text-slate-400">
                      Current active project status
                    </p>
                  </div>

                  <button className="text-sm font-semibold text-[#54bfb4] transition hover:text-[#6fd1c7]">
                    View all
                  </button>
                </div>

                <div className="mt-8 space-y-7">
                  {projects.map((project) => (
                    <div key={project.name}>
                      <div className="mb-3 flex justify-between text-sm">
                        <span className="font-medium text-slate-200">
                          {project.name}
                        </span>

                        <span className="text-slate-400">
                          {project.progress}%
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#54bfb4] to-[#586bb7]"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#1b1e21] p-6 shadow-xl shadow-black/10">
                <h3 className="font-semibold text-white">Recent Activity</h3>

                <p className="mt-1 text-sm text-slate-400">
                  Latest team updates
                </p>

                <div className="mt-6 space-y-5">
                  {activities.map((activity) => (
                    <div key={activity.title} className="flex gap-3">
                      <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#54bfb4]" />

                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {activity.title}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}