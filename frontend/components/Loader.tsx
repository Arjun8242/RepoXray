"use client";

import { motion } from "framer-motion";

type LoaderProps = {
  label: string;
  size?: "md" | "lg";
};

export function Loader({ label, size = "md" }: LoaderProps) {
  const spinnerSize = size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-100/20 bg-white/4 px-4 py-3 text-slate-100/90">
      <motion.span
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1, ease: "linear" }}
        className={`${spinnerSize} rounded-full border-2 border-teal-100/35 border-t-amber-200`}
      />
      <p className="text-sm leading-6">{label}</p>
    </div>
  );
}
