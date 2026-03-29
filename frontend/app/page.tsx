"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { InputSection } from "@/components/InputSection";
import { BrandLogo } from "@/components/BrandLogo";
import { Loader } from "@/components/Loader";
import { analyzeRepository } from "@/lib/api";
import type { AnalyzeRequest } from "@/lib/types";

const STAGES = [
  "Validating repository URL...",
  "Scanning repository metadata...",
  "Computing code quality signal...",
  "Preparing analysis workspace...",
];

export default function HomePage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stageIndex, setStageIndex] = useState(0);

  const isValidInput = useMemo(() => repoUrl.trim().length > 0, [repoUrl]);

  async function handleAnalyze() {
    if (!isValidInput || loading) return;

    setLoading(true);
    setError("");
    setStageIndex(0);

    const timer = setInterval(() => {
      setStageIndex((current) => (current < STAGES.length - 1 ? current + 1 : current));
    }, 950);

    try {
      const payload: AnalyzeRequest = {
        repoUrl: repoUrl.trim(),
      };

      const result = await analyzeRepository(payload);
      const analysisId = result.analysisId || result.id || `local-${Date.now()}`;

      if (!result.analysisId && typeof window !== "undefined") {
        window.sessionStorage.setItem(`analysis:${analysisId}`, JSON.stringify(result));
      }

      router.push(`/analysis?id=${encodeURIComponent(analysisId)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze repository.";
      setError(message);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-14 text-slate-50 sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-20%] h-80 w-80 rounded-full bg-teal-300/20 blur-[120px]" />
        <div className="absolute right-[-12%] top-[12%] h-96 w-96 rounded-full bg-amber-300/20 blur-[140px]" />
        <div className="absolute bottom-[-22%] left-[26%] h-80 w-80 rounded-full bg-cyan-300/15 blur-[130px]" />
      </div>

      <section className="mx-auto flex min-h-[80vh] w-full max-w-4xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="w-full rounded-3xl border border-white/15 bg-white/3 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-10"
        >
          <div className="space-y-3 text-center">
            <BrandLogo size="lg" priority className="mx-auto w-full max-w-64" />
            <h1 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-5xl">
              Understand Any Repository in Minutes
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-200/80 sm:text-base">
              Paste a GitHub URL and receive a structured quality report, file explorer, and interactive Q&A powered by RepoXray.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: "easeOut" }}
            className="mt-8"
          >
            <InputSection
              value={repoUrl}
              onChange={setRepoUrl}
              onSubmit={handleAnalyze}
              loading={loading}
              disabled={!isValidInput || loading}
            />
          </motion.div>

          {loading ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-5"
            >
              <Loader label={STAGES[stageIndex]} />
            </motion.div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl border border-amber-300/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </p>
          ) : null}
        </motion.div>
      </section>
    </main>
  );
}
