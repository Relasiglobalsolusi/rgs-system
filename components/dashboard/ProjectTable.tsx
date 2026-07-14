"use client";

import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";

const projects = [
  {
    project: "Corporate Website",
    client: "Internal",
    progress: 78,
    status: "In Progress",
    priority: "High",
    due: "28 Jul",
    team: ["VL", "AR", "DS"],
  },
  {
    project: "Attendance System",
    client: "HR",
    progress: 45,
    status: "Planning",
    priority: "Medium",
    due: "12 Aug",
    team: ["HR", "IT"],
  },
  {
    project: "Warehouse Management",
    client: "Operations",
    progress: 62,
    status: "Testing",
    priority: "High",
    due: "18 Aug",
    team: ["OP", "IT", "QA"],
  },
  {
    project: "Inventory Mobile",
    client: "Warehouse",
    progress: 24,
    status: "Development",
    priority: "Low",
    due: "3 Sep",
    team: ["MB", "UI"],
  },
];

function statusColor(status: string) {
  switch (status) {
    case "In Progress":
      return "bg-cyan-500/15 text-cyan-400";
    case "Planning":
      return "bg-amber-500/15 text-amber-400";
    case "Testing":
      return "bg-violet-500/15 text-violet-400";
    default:
      return "bg-emerald-500/15 text-emerald-400";
  }
}

function priorityColor(priority: string) {
  switch (priority) {
    case "High":
      return "text-red-400";
    case "Medium":
      return "text-amber-400";
    default:
      return "text-emerald-400";
  }
}

export default function ProjectTable() {
  return (
    <div className="rounded-3xl border border-white/5 bg-[#181E25] shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 p-8">
        <div>
          <h3 className="text-xl font-semibold text-white">
            Active Projects
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Current project overview
          </p>
        </div>

        <button className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-[#54BFB4]/20">
          View All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-8 py-4">Project</th>
              <th>Client</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Due</th>
              <th>Team</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {projects.map((project, index) => (
              <motion.tr
                key={project.project}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="border-b border-white/5 transition hover:bg-white/[0.02]"
              >
                <td className="px-8 py-6">
                  <div>
                    <p className="font-medium text-white">
                      {project.project}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Enterprise Project
                    </p>
                  </div>
                </td>

                <td className="text-slate-400">
                  {project.client}
                </td>

                <td className="w-60">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 rounded-full bg-white/5">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#54BFB4] to-[#586BB7]"
                        style={{
                          width: `${project.progress}%`,
                        }}
                      />
                    </div>

                    <span className="text-sm text-slate-300">
                      {project.progress}%
                    </span>
                  </div>
                </td>

                <td>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor(
                      project.status
                    )}`}
                  >
                    {project.status}
                  </span>
                </td>

                <td>
                  <span
                    className={`text-sm font-medium ${priorityColor(
                      project.priority
                    )}`}
                  >
                    {project.priority}
                  </span>
                </td>

                <td className="text-slate-400">
                  {project.due}
                </td>

                <td>
                  <div className="flex -space-x-2">
                    {project.team.map((member) => (
                      <div
                        key={member}
                        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#181E25] bg-gradient-to-br from-[#54BFB4] to-[#586BB7] text-xs font-semibold text-white"
                      >
                        {member}
                      </div>
                    ))}
                  </div>
                </td>

                <td>
                  <button className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white">
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}