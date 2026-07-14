"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BarChart3,
  Building2,
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
    title: "Overview",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/dashboard",
      },
    ],
  },
  {
    title: "Projects",
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
    title: "Human Resources",
    items: [
      {
        icon: CalendarDays,
        label: "Attendance",
        href: "/attendance",
      },
      {
        icon: Building2,
        label: "Departments",
        href: "/departments",
      },
      {
        icon: Users,
        label: "Employees",
        href: "/employees",
      },
    ],
  },
  {
    title: "Business",
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
    title: "System",
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
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:w-[290px] xl:w-[300px] flex-col border-r border-white/5 bg-[#0F141A]">
      {/* Logo */}

      <div className="border-b border-white/5 px-8 py-10">
        <Image
          src="/rgs-one-logo.svg"
          alt="RGS ONE"
          width={280}
          height={80}
          priority
          className="mx-auto h-auto w-full max-w-[220px]"
        />
      </div>

      {/* Navigation */}

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {menu.map((section) => (
          <div key={section.title} className="mb-8">
            <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              {section.title}
            </p>

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`group flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-200 ${
                      active
                        ? "bg-cyan-500/10 border border-cyan-500/20"
                        : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                          active
                            ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                            : "bg-white/[0.04] text-slate-400 group-hover:text-white"
                        }`}
                      >
                        <Icon size={19} />
                      </div>

                      <span
                        className={`text-[14px] font-medium ${
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
                        className="text-cyan-400"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User */}

      <div className="border-t border-white/5 p-5">
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 font-bold text-white">
              VL
            </div>

            <div className="flex-1">
              <p className="text-sm font-semibold text-white">
                Vicko Liem
              </p>

              <p className="text-xs text-slate-500">
                System Administrator
              </p>
            </div>
          </div>

          <Link
            href="/api/auth/signout"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-red-500/10 bg-red-500/5 py-3 text-sm text-red-300 transition hover:bg-red-500/10"
          >
            <LogOut size={18} />
            Sign out
          </Link>
        </div>
      </div>
    </aside>
  );
}