import AppShell from "@/components/layout/AppShell";
import AnimatedCard from "@/components/dashboard/AnimatedCard";
import RevenueGraph from "@/components/dashboard/RevenueGraph";
import QuickActions from "@/components/dashboard/QuickActions";
import TeamStatus from "@/components/dashboard/TeamStatus";
import ProjectTable from "@/components/dashboard/ProjectTable";
import RecentActivity from "@/components/dashboard/RecentActivity";

import {
  ArrowUpRight,
  CalendarDays,
  Plus,
} from "lucide-react";

const stats = [
  {
    title: "Monthly Revenue",
    value: "Rp 1.24B",
    growth: "+12.8%",
    positive: true,
  },
  {
    title: "Active Projects",
    value: "12",
    growth: "+2 Projects",
    positive: true,
  },
  {
    title: "Employees Present",
    value: "38 / 42",
    growth: "90%",
    positive: true,
  },
  {
    title: "Pending Approvals",
    value: "7",
    growth: "-3 Today",
    positive: false,
  },
];

export default function DashboardPage() {
  return (
    <AppShell
      title="Dashboard"
      description="Welcome back, Vicko."
    >
      {/* Greeting */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm text-[#54BFB4]">
            <CalendarDays size={16} />
            Tuesday, 14 July 2026
          </p>

          <h2 className="mt-3 text-5xl font-bold tracking-tight text-white">
            Good Evening 👋
          </h2>

          <p className="mt-3 max-w-2xl text-slate-500">
            Here's what's happening across Relasi Global Solusi today.
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#54BFB4] to-[#586BB7] px-7 py-4 font-semibold text-white shadow-2xl transition hover:scale-[1.03]">
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 xl:grid-cols-4">
        {stats.map((item, index) => (
          <AnimatedCard
            key={item.title}
            title={item.title}
            value={item.value}
            growth={item.growth}
            positive={item.positive}
            delay={index * 0.08}
          />
        ))}
      </div>

      {/* Revenue + Quick Actions */}
      <div className="mt-8 grid gap-8 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-white/5 bg-[#181E25] p-8 shadow-xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-white">
                Revenue Overview
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Company revenue growth this year
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
              <div className="flex items-center gap-2">
                <ArrowUpRight size={16} />
                +18.2%
              </div>
            </div>
          </div>

          <RevenueGraph />
        </div>

        <QuickActions />
      </div>

      {/* Team + Activity */}
      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_2fr]">
        <TeamStatus />
        <RecentActivity />
      </div>

      {/* Projects */}
      <div className="mt-8">
        <ProjectTable />
      </div>
    </AppShell>
  );
}