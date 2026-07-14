"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  FolderKanban,
  ReceiptText,
  UserPlus,
} from "lucide-react";

const activities = [
  {
    title: "New project created",
    description: "Warehouse Management System",
    time: "10 min ago",
    icon: FolderKanban,
    color: "bg-cyan-500",
  },
  {
    title: "Quotation Approved",
    description: "PT Nusantara Abadi",
    time: "35 min ago",
    icon: ReceiptText,
    color: "bg-orange-500",
  },
  {
    title: "Employee Added",
    description: "Michael Tan joined Operations",
    time: "1 hour ago",
    icon: UserPlus,
    color: "bg-emerald-500",
  },
  {
    title: "Task Completed",
    description: "Corporate Website Homepage",
    time: "2 hours ago",
    icon: CheckCircle2,
    color: "bg-violet-500",
  },
];

export default function RecentActivity() {
  return (
    <div className="rounded-3xl border border-white/5 bg-[#181E25] p-8 shadow-xl">
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white">
          Recent Activity
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Latest updates across the company
        </p>
      </div>

      <div className="space-y-5">
        {activities.map((activity, index) => {
          const Icon = activity.icon;

          return (
            <motion.div
              key={activity.title}
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="flex gap-4 rounded-2xl border border-white/5 bg-[#202631] p-4 transition hover:border-[#54BFB4]/20"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${activity.color}`}
              >
                <Icon size={22} className="text-white" />
              </div>

              <div className="flex-1">
                <p className="font-medium text-white">
                  {activity.title}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  {activity.description}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  {activity.time}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}