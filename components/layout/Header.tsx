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
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#11151A]/95 backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between px-8">
        {/* Left */}

        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {title}
            </h1>
          </div>

          <div className="hidden xl:flex">
            <div className="flex h-12 w-[340px] items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 transition hover:border-cyan-400/20">
              <Search
                size={18}
                className="text-slate-500"
              />

              <input
                placeholder="Search..."
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              />

              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-500">
                <Command size={12} />
                K
              </div>
            </div>
          </div>
        </div>

        {/* Right */}

        <div className="flex items-center gap-3">
          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-slate-400 transition hover:border-cyan-400/20 hover:text-white">
            <CalendarDays size={18} />
          </button>

          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-slate-400 transition hover:border-cyan-400/20 hover:text-white">
            <Moon size={18} />
          </button>

          <button className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-slate-400 transition hover:border-cyan-400/20 hover:text-white">
            <Bell size={18} />

            <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-cyan-400" />
          </button>

          <button className="ml-2 flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2 transition hover:border-cyan-400/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 text-sm font-bold text-white">
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
              size={16}
              className="text-slate-500"
            />
          </button>
        </div>
      </div>
    </header>
  );
}