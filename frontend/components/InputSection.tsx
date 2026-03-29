"use client";

import { motion } from "framer-motion";

type InputSectionProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled: boolean;
};

export function InputSection({ value, onChange, onSubmit, loading, disabled }: InputSectionProps) {
  return (
    <div className="rounded-2xl border border-amber-100/20 bg-slate-900/65 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="repo-url">
          GitHub Repository URL
        </label>
        <input
          id="repo-url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste your GitHub repository URL..."
          className="h-12 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white placeholder:text-slate-300/65 shadow-sm outline-none transition focus:border-teal-200/70 focus:ring-4 focus:ring-teal-200/20"
        />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 360, damping: 24 }}
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="h-12 rounded-xl bg-linear-to-r from-teal-300 to-amber-300 px-6 text-sm font-semibold text-slate-950 shadow-[0_8px_24px_rgba(94,234,212,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </motion.button>
      </div>
    </div>
  );
}
