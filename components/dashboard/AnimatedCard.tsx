"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type AnimatedCardProps = {
  title: string;
  value: string;
  growth: string;
  positive?: boolean;
  delay?: number;
};

export default function AnimatedCard({
  title,
  value,
  growth,
  positive = true,
  delay = 0,
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 40,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.45,
        delay,
      }}
      whileHover={{
        y: -8,
        scale: 1.02,
      }}
      className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#181E25] p-7 shadow-xl transition-all"
    >
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#54BFB4]/10 blur-3xl transition group-hover:bg-[#54BFB4]/20" />

      <div className="relative z-10">
        <p className="text-sm font-medium text-slate-500">{title}</p>

        <h2 className="mt-5 text-4xl font-bold tracking-tight text-white">
          {value}
        </h2>

        <div className="mt-6 flex items-center justify-between">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
              positive
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {positive ? (
              <ArrowUpRight size={16} />
            ) : (
              <ArrowDownRight size={16} />
            )}

            {growth}
          </div>

          <span className="text-xs uppercase tracking-[0.18em] text-slate-600">
            Monthly
          </span>
        </div>
      </div>
    </motion.div>
  );
}