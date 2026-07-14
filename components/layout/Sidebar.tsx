"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";

const menu = [
  {
    title: "MAIN",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/dashboard",
      },
    ],
  },
  {
    title: "PROJECTS",
    items: [
      {
        icon: FolderKanban,
        label: "Projects",
        href: "/projects",
      },
      {
        icon: CheckSquare,
        label: "Tasks",
        href: "/tasks",
      },
    ],
  },
  {
    title: "HR",
    items: [
      {
        icon: CalendarDays,
        label: "Attendance",
        href: "/attendance",
      },
      {
        icon: Users,
        label: "Employees",
        href: "/employees",
      },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      {
        icon: Package,
        label: "Inventory",
        href: "/inventory",
      },
      {
        icon: ShoppingCart,
        label: "Purchase Orders",
        href: "/purchase-orders",
      },
      {
        icon: ReceiptText,
        label: "Quotations",
        href: "/quotations",
      },
      {
        icon: BarChart3,
        label: "Reports",
        href: "/reports",
      },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      {
        icon: Settings,
        label: "Settings",
        href: "/settings",
      },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="hidden h-screen w-80 shrink-0 border-r border-white/5 bg-[#11151a] lg:flex lg:flex-col">
      <div className="flex min-h-60 items-center justify-center border-b border-white/5 px-6 py-7">
        <Image
          src="/rgs-one-logo.svg"
          alt="RGS ONE"
          width={800}
          height={800}
          priority
          className="h-auto w-full max-w-[255px] object-contain"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {menu.map((section) => (
          <div key={section.title} className="mb-8">
            <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {section.title}
            </p>

            <div className="space-y-1">
              {section.items.map((item, index) => {
                const Icon = item.icon;

                const active =
                  section.title === "MAIN" && index === 0;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`group flex items-center justify-between rounded-2xl px-3 py-3 transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-[#54bfb4]/15 to-[#586bb7]/15 ring-1 ring-[#54bfb4]/20"
                        : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                          active
                            ? "bg-gradient-to-br from-[#54bfb4] to-[#586bb7] text-white shadow-lg"
                            : "bg-white/[0.05] text-slate-400 group-hover:text-white"
                        }`}
                      >
                        <Icon size={19} />
                      </div>

                      <span
                        className={`text-sm font-medium ${
                          active
                            ? "text-white"
                            : "text-slate-400 group-hover:text-white"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>

                    {active && (
                      <ChevronRight
                        size={18}
                        className="text-[#54bfb4]"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 p-5">
        <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#54bfb4] to-[#586bb7] text-sm font-bold text-white">
              VL
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                Vicko Liem
              </p>

              <p className="truncate text-xs text-slate-500">
                System Administrator
              </p>
            </div>
          </div>

          <Link
            href="/api/auth/signout"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/10 bg-red-500/5 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
          >
            <LogOut size={18} />
            Sign out
          </Link>
        </div>
      </div>
    </aside>
  );
}