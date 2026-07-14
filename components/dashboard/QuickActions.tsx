"use client";

import { motion } from "framer-motion";
import {
  CalendarPlus,
  ClipboardList,
  FolderPlus,
  ReceiptText,
  UserPlus,
  Warehouse,
} from "lucide-react";

const actions = [
  {
    title: "New Project",
    icon: FolderPlus,
    color: "from-cyan-500 to-blue-500",
  },
  {
    title: "Add Employee",
    icon: UserPlus,
    color: "from-emerald-500 to-teal-500",
  },
  {
    title: "Attendance",
    icon: CalendarPlus,
    color: "from-violet-500 to-indigo-500",
  },
  {
    title: "Quotation",
    icon: ReceiptText,
    color: "from-orange-500 to-amber-500",
  },
  {
    title: "Inventory",
    icon: Warehouse,
    color: "from-pink-500 to-rose-500",
  },
  {
    title: "Tasks",
    icon: ClipboardList,
    color: "from-sky-500 to-cyan-500",
  },
];

export default function QuickActions() {
  return (
    <div className="rounded-3xl border border-white/5 bg-[#181E25] p-8 shadow-xl">
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white">
          Quick Actions
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Frequently used shortcuts
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon;

          return (
            <motion.button
              key={action.title}
              initial={{
                opacity: 0,
                scale: 0.9,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                delay: index * 0.05,
              }}
              whileHover={{
                scale: 1.05,
                y: -4,
              }}
              whileTap={{
                scale: 0.96,
              }}
              className="group rounded-2xl border border-white/5 bg-[#202631] p-5 transition hover:border-[#54BFB4]/20"
            >
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${action.color} shadow-lg`}
              >
                <Icon size={24} className="text-white" />
              </div>

              <p className="mt-4 text-sm font-medium text-slate-300 group-hover:text-white">
                {action.title}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}