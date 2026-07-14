"use client";

import {
  Bell,
  CalendarDays,
 ChevronDown,
  Command,
  Moon,
  Search,
} from "lucide-react";

type HeaderProps = {
  title: string;
  description?: string;
};

export default function Header({
  title,
  description,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#11151A]/90 backdrop-blur-xl">
      <div className="flex h-24 items-center justify-between px-10">
        {/* Left */}

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {title}
          </h1>

          {description && (
            <p className="mt-2 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>

        {/* Right */}

        <div className="flex items-center gap-4">
          {/* Search */}

          <div className="hidden xl:flex">
            <div className="flex h-14 w-[360px] items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-5 transition hover:border-[#54BFB4]/30">
              <Search
                size={18}
                className="text-slate-500"
              />

              <input
                type="text"
                placeholder="Search anything..."
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              />

              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-500">
                <Command size={12} />
                K
              </div>
            </div>
          </div>

          {/* Calendar */}

          <button className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] text-slate-400 transition hover:border-[#54BFB4]/20 hover:text-white">
            <CalendarDays size={20} />
          </button>

          {/* Dark Mode */}

          <button className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] text-slate-400 transition hover:border-[#54BFB4]/20 hover:text-white">
            <Moon size={20} />
          </button>

          {/* Notification */}

          <button className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] text-slate-400 transition hover:border-[#54BFB4]/20 hover:text-white">
            <Bell size={20} />

            <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-[#54BFB4]" />
          </button>

          {/* User */}

          <button className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 transition hover:border-[#54BFB4]/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#54BFB4] to-[#586BB7] text-sm font-bold text-white">
              VL
            </div>

            <div className="text-left">
              <p className="text-sm font-semibold text-white">
                Vicko Liem
              </p>

              <p className="text-xs text-slate-500">
                Administrator
              </p>
            </div>

            <ChevronDown
              size={18}
              className="text-slate-500"
            />
          </button>
        </div>
      </div>
    </header>
  );
}