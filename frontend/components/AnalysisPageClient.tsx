"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BrandLogo } from "@/components/BrandLogo";
import { Loader } from "@/components/Loader";
import { ScoreCard } from "@/components/ScoreCard";
import { FileTree } from "@/components/FileTree";
import { CodeViewer } from "@/components/CodeViewer";
import { ChatBox } from "@/components/ChatBox";
import { getAnalysisById } from "@/lib/api";
import { buildFileTree, normalizeAnalysis } from "@/lib/analysis-utils";
import type { AnalysisModel, FileEntry } from "@/lib/types";

type AnalysisPageClientProps = {
  initialAnalysisId: string;
};

/* ─── Markdown component overrides ────────────────────────────────────────
  These make each Markdown element match the metallic teal/copper design system and
   ensure ASCII box diagrams render correctly (whitespace-pre is critical).
────────────────────────────────────────────────────────────────────────── */
const mdComponents = {
  h2({ children }: React.ComponentPropsWithoutRef<"h2">) {
    return (
      <h2 className="mt-8 mb-3 border-b border-amber-100/20 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/85">
        {children}
      </h2>
    );
  },
  h3({ children }: React.ComponentPropsWithoutRef<"h3">) {
    return (
      <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-100">
        {children}
      </h3>
    );
  },
  p({ children }: React.ComponentPropsWithoutRef<"p">) {
    return (
      <p className="mb-3 text-sm leading-7 text-slate-200/80">{children}</p>
    );
  },
  ul({ children }: React.ComponentPropsWithoutRef<"ul">) {
    return (
      <ul className="mb-3 ml-4 grid gap-1 list-disc text-sm text-slate-200/80">
        {children}
      </ul>
    );
  },
  ol({ children }: React.ComponentPropsWithoutRef<"ol">) {
    return (
      <ol className="mb-3 ml-4 grid gap-1.5 list-decimal text-sm text-slate-200/80">
        {children}
      </ol>
    );
  },
  li({ children }: React.ComponentPropsWithoutRef<"li">) {
    return <li className="leading-6">{children}</li>;
  },
  strong({ children }: React.ComponentPropsWithoutRef<"strong">) {
    return <strong className="font-semibold text-slate-100">{children}</strong>;
  },
  blockquote({ children }: React.ComponentPropsWithoutRef<"blockquote">) {
    return (
      <blockquote className="my-3 border-l-2 border-teal-400/55 pl-3 italic text-slate-300/60">
        {children}
      </blockquote>
    );
  },
  // ── Tables ──────────────────────────────────────────────────────────────
  table({ children }: React.ComponentPropsWithoutRef<"table">) {
    return (
      <div className="my-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }: React.ComponentPropsWithoutRef<"thead">) {
    return <thead className="bg-white/6 text-xs uppercase tracking-wider text-slate-300">{children}</thead>;
  },
  th({ children }: React.ComponentPropsWithoutRef<"th">) {
    return <th className="px-4 py-2 text-left font-semibold text-slate-200">{children}</th>;
  },
  td({ children }: React.ComponentPropsWithoutRef<"td">) {
    return <td className="border-t border-white/10 px-4 py-2 text-slate-200/80">{children}</td>;
  },
  // ── Code blocks — critical for ASCII diagrams ───────────────────────────
  // ASCII diagrams come through as plain ``` blocks (no language tag).
  // whitespace-pre + font-mono + leading-relaxed keeps box characters intact.
  pre({ children }: React.ComponentPropsWithoutRef<"pre">) {
    return (
      <pre className="my-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/80 p-4 font-mono text-xs text-slate-200/90 whitespace-pre leading-relaxed">
        {children}
      </pre>
    );
  },
  code({
    className,
    children,
  }: React.ComponentPropsWithoutRef<"code"> & { inline?: boolean }) {
    const isBlock = Boolean(className); // language-xxx = fenced block

    if (!isBlock) {
      // Inline code — e.g. `functionName()`
      return (
        <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs text-teal-200">
          {children}
        </code>
      );
    }

    // Fenced code block (non-ASCII, e.g. language-js)
    return (
      <code className="font-mono text-xs text-slate-200/90 whitespace-pre">
        {children}
      </code>
    );
  },
};

export function AnalysisPageClient({ initialAnalysisId }: AnalysisPageClientProps) {
  const analysisId = initialAnalysisId;

  const [data, setData] = useState<AnalysisModel | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!analysisId) {
        setError("Missing analysis id in URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      let hasCachedResult = false;

      if (typeof window !== "undefined") {
        const cached = window.sessionStorage.getItem(`analysis:${analysisId}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Record<string, unknown>;
            const normalized = normalizeAnalysis(parsed, analysisId);
            hasCachedResult = true;
            if (!cancelled) {
              setData(normalized);
              setSelectedFilePath((c) => c || normalized.files[0]?.path || "");
            }
          } catch {
            window.sessionStorage.removeItem(`analysis:${analysisId}`);
          }
        }
      }

      try {
        const response = await getAnalysisById(analysisId);
        const normalized = normalizeAnalysis(response, analysisId);
        if (!cancelled) {
          setData(normalized);
          setSelectedFilePath((c) => c || normalized.files[0]?.path || "");
        }
      } catch (err) {
        if (!hasCachedResult && !cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load analysis.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [analysisId]);

  const fileTree = useMemo(() => buildFileTree(data?.paths ?? []), [data?.paths]);

  const selectedFile: FileEntry | undefined = useMemo(
    () => data?.files.find((f) => f.path === selectedFilePath),
    [data?.files, selectedFilePath],
  );

  /* ── Loading state ── */
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <BrandLogo size="md" className="w-full max-w-56" priority />
          <Loader label="Loading analysis dashboard..." size="lg" />
        </div>
      </main>
    );
  }

  /* ── Error state ── */
  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <BrandLogo size="md" className="w-full max-w-56" priority />
          <div className="w-full rounded-2xl border border-amber-300/35 bg-amber-400/10 p-4 text-amber-100">
          {error || "No analysis data available."}
          </div>
        </div>
      </main>
    );
  }

  const reportMarkdown = data.reportMarkdown || data.insights?.summary || "";

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-slate-50 sm:px-8">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-20%] h-96 w-96 rounded-full bg-teal-300/20 blur-[130px]" />
        <div className="absolute right-[-14%] top-[8%] h-104 w-104 rounded-full bg-amber-300/20 blur-[145px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-6">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-amber-100/20 bg-white/4 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl"
        >
          <BrandLogo size="md" className="w-full max-w-56" priority />
          <p className="text-xs uppercase tracking-[0.2em] text-amber-100/85">Analysis Workspace</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold text-white sm:text-3xl">
            Codebase Report Overview
          </h1>
          <p className="mt-2 text-sm text-slate-200/80">Analysis ID: {analysisId}</p>
        </motion.header>

        {/* ── Quality score + AI Insights summary ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="grid gap-6 lg:grid-cols-[1fr_2fr]"
        >
          <ScoreCard
            score={data.quality.score}
            outOf={data.quality.outOf}
            categories={data.quality.categories}
          />

          <div className="rounded-3xl border border-amber-100/20 bg-white/4 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">AI Insights</h2>
            <p className="mt-3 text-sm leading-7 text-slate-200/85">
              {data.insights.summary || "No summary provided."}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-teal-200/25 bg-teal-300/10 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-teal-100/90">Strengths</p>
                <ul className="mt-2 grid gap-2 text-sm text-slate-100/90">
                  {(data.insights.strengths.length
                    ? data.insights.strengths
                    : ["No strengths available."]
                  ).map((item) => (
                    <li key={item} className="rounded-lg bg-white/3 px-2 py-1.5">{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-200/30 bg-amber-300/10 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-amber-100/90">Weaknesses</p>
                <ul className="mt-2 grid gap-2 text-sm text-slate-100/90">
                  {(data.insights.weaknesses.length
                    ? data.insights.weaknesses
                    : ["No weaknesses available."]
                  ).map((item) => (
                    <li key={item} className="rounded-lg bg-white/3 px-2 py-1.5">{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-teal-200/25 bg-teal-300/10 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-teal-100/90">Suggestions</p>
                <ul className="mt-2 grid gap-2 text-sm text-slate-100/90">
                  {(data.insights.suggestions.length
                    ? data.insights.suggestions
                    : ["No suggestions available."]
                  ).map((item) => (
                    <li key={item} className="rounded-lg bg-white/3 px-2 py-1.5">{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Architecture Report (reportMarkdown) ── */}
        {reportMarkdown && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.09 }}
            className="rounded-3xl border border-amber-100/20 bg-white/4 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl"
          >
            <p className="mb-4 text-xs uppercase tracking-[0.18em] text-amber-200/80">
              Architecture Report
            </p>
            {/* ReactMarkdown with custom components renders each ## heading
                as a distinct visual section, tables as styled tables, and
                ``` blocks (ASCII diagrams) as monospaced pre elements.     */}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={mdComponents as never}
            >
              {reportMarkdown}
            </ReactMarkdown>
          </motion.section>
        )}

        {/* ── File explorer + Code viewer ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <FileTree
            nodes={fileTree}
            selectedPath={selectedFilePath}
            onSelectFile={setSelectedFilePath}
            className="h-128"
          />
          <CodeViewer
            filePath={selectedFilePath}
            content={
              selectedFile?.content ||
              "Select a file from the explorer to inspect source code."
            }
            className="h-128"
          />
        </motion.section>

        {/* ── Chat ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16 }}
        >
          <ChatBox analysisId={analysisId} />
        </motion.section>

      </div>
    </main>
  );
}