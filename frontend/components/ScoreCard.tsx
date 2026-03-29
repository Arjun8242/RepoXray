"use client";

import { motion } from "framer-motion";
import type { QualityCategory } from "@/lib/types";

type ScoreCardProps = {
  score: number;
  outOf: number;
  categories: QualityCategory[];
};

export function ScoreCard({ score, outOf, categories }: ScoreCardProps) {
  const safeOutOf = outOf > 0 ? outOf : 100;
  const percentage = Math.max(0, Math.min(100, Math.round((score / safeOutOf) * 100)));

  return (
    <div className="rounded-3xl border border-amber-100/20 bg-white/4 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-white">Quality Score</h2>

      <div className="mt-5 flex items-center gap-4">
        <motion.div
          initial={{ scale: 0.92, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="relative grid h-28 w-28 place-items-center rounded-full"
          style={{
            background: `conic-gradient(rgb(94 234 212) ${percentage * 3.6}deg, rgba(252,211,153,0.3) 0deg)`,
          }}
        >
          <div className="grid h-[5.8rem] w-[5.8rem] place-items-center rounded-full bg-slate-950 text-center">
            <p className="text-2xl font-semibold text-white">{Math.round(score)}</p>
            <p className="text-xs text-slate-300">/ {safeOutOf}</p>
          </div>
        </motion.div>

        <div className="space-y-1">
          <p className="text-sm text-slate-100/85">Repository quality confidence</p>
          <p className="text-xs uppercase tracking-[0.15em] text-amber-100/85">{percentage}% overall</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {categories.map((category) => {
          const categoryPercent = Math.max(0, Math.min(100, category.score));
          return (
            <div key={category.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-200/85">
                <span>{category.name}</span>
                <span>{Math.round(category.score)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/12">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${categoryPercent}%` }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  className="h-full rounded-full bg-linear-to-r from-teal-300 to-amber-300"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
