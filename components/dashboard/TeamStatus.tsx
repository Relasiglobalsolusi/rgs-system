"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Coffee, XCircle } from "lucide-react";

const team = [
  {
    name: "John Doe",
    department: "Sales",
    status: "Working",
    color: "bg-emerald-500",
    icon: CheckCircle2,
  },
  {
    name: "Jane Smith",
    department: "HR",
    status: "Meeting",
    color: "bg-sky-500",
    icon: Clock3,
  },
  {
    name: "Michael Tan",
    department: "Warehouse",
    status: "Break",
    color: "bg-orange-500",
    icon: Coffee,
  },
  {
    name: "Sarah Lim",
    department: "Finance",
    status: "Offline",
    color: "bg-red-500",
    icon: XCircle,
  },
];

export default function TeamStatus() {
  return (
    <div className="rounded-3xl border border-white/5 bg-[#181E25] p-8 shadow-xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">
            Team Status
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Live employee availability
          </p>
        </div>

        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          38 Online
        </span>
      </div>

      <div className="space-y-4">
        {team.map((member, index) => {
          const Icon = member.icon;

          return (
            <motion.div
              key={member.name}
              initial={{
                opacity: 0,
                x: 20,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay: index * 0.08,
              }}
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#202631] p-4"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#54BFB4] to-[#586BB7] text-sm font-bold text-white">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>

                  <span
                    className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#202631] ${member.color}`}
                  />
                </div>

                <div>
                  <p className="font-medium text-white">
                    {member.name}
                  </p>

                  <p className="text-sm text-slate-500">
                    {member.department}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1">
                <Icon
                  size={15}
                  className="text-[#54BFB4]"
                />

                <span className="text-xs text-slate-300">
                  {member.status}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}