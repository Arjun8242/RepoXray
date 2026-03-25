"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type KeyFile = {
  path: string;
  role: string;
};

type AnalysisResponse = {
  analysisMode?: "initial" | "full";
  overview: string;
  techStack: string[];
  keyFiles: KeyFile[];
  explanation: string;
  detailedSummary?: string;
  queryAnswer?: string;
  repositoryStructure?: {
    paths: string[];
    truncated: boolean;
    totalFiles: number;
  };
  quality?: {
    score: number;
    outOf: number;
    categories: Array<{ name: string; score: number }>;
  };
  sampleQuestions?: string[];
  reportMarkdown?: string;
  stages?: string[];
  notes: string[];
  debug?: {
    selectedFiles?: Array<{ path: string; reason: string; size: number }>;
    repository?: { repoName: string; branch: string; totalFiles: number };
    usedLlm?: boolean;
    llmInfo?: { provider?: string; model?: string; error?: string };
  };
};

type TreeNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  children: TreeNode[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

const ANALYSIS_STAGES = [
  "Fetching repository info...",
  "Reading file structure...",
  "Loading README...",
  "Detecting tech stack...",
  "AI is analyzing the codebase...",
  "Generating explanation...",
];

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = {
    name: "root",
    path: "",
    type: "folder",
    children: [],
  };

  for (const fullPath of paths) {
    const segments = fullPath.split("/").filter(Boolean);
    let cursor = root;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const isFile = index === segments.length - 1;
      const nodePath = segments.slice(0, index + 1).join("/");
      let next = cursor.children.find((child) => child.name === segment);

      if (!next) {
        next = {
          name: segment,
          path: nodePath,
          type: isFile ? "file" : "folder",
          children: [],
        };
        cursor.children.push(next);
      }

      cursor = next;
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const node of nodes) {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(root.children);
  return root.children;
}

function collectTopLevelFolderPaths(nodes: TreeNode[]) {
  return nodes.filter((node) => node.type === "folder").map((node) => node.path);
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("https://github.com/vercel/next.js");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isAnalyzed, setIsAnalyzed] = useState(false);

  const projectTree = useMemo(
    () => buildTree(result?.repositoryStructure?.paths || []),
    [result?.repositoryStructure?.paths],
  );

  const isInitialResultView = result?.analysisMode === "initial";

  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    for (const path of collectTopLevelFolderPaths(projectTree)) {
      defaults[path] = true;
    }
    setExpandedFolders(defaults);
  }, [projectTree]);

  const canSubmit = useMemo(() => {
    return repoUrl.trim().length > 0 && !loading;
  }, [repoUrl, loading]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    setLoadingStageIndex(0);
    const timer = setInterval(() => {
      setLoadingStageIndex((value) => {
        if (value >= ANALYSIS_STAGES.length - 1) {
          return value;
        }
        return value + 1;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [loading]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          question: question.trim(),
          maxFiles: 20,
          debug: true,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Analysis request failed");
      }

      setLoadingStageIndex(ANALYSIS_STAGES.length - 1);
      setResult(body as AnalysisResponse);
      setIsAnalyzed(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unknown error";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleFolder(path: string) {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  }

  function renderTree(nodes: TreeNode[], depth = 0) {
    return (
      <ul className="grid gap-1">
        {nodes.map((node) => {
          const isFolder = node.type === "folder";
          const isExpanded = !!expandedFolders[node.path];

          return (
            <li key={node.path}>
              {isFolder ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleFolder(node.path)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-orange-100/80 transition hover:bg-orange-500/10"
                    style={{ paddingLeft: `${8 + depth * 14}px` }}
                  >
                    <span className="w-4 text-center text-orange-300">{isExpanded ? "v" : ">"}</span>
                    <span className="text-orange-200">{node.name}</span>
                  </button>
                  {isExpanded && node.children.length > 0 ? renderTree(node.children, depth + 1) : null}
                </>
              ) : (
                <p
                  className="truncate rounded-md px-2 py-1 text-xs text-orange-100/60"
                  style={{ paddingLeft: `${26 + depth * 14}px` }}
                  title={node.path}
                >
                  {node.name}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_16%_18%,rgba(255,140,50,0.15),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(255,100,150,0.14),transparent_30%),linear-gradient(180deg,#1a0f05_0%,#251510_55%,#1a0c08_100%)] px-4 py-7 text-orange-50 md:px-8 md:py-10">
      <main className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-orange-300/15 bg-[#1f120dcc] shadow-[0_35px_120px_rgba(30,15,5,0.7)] backdrop-blur">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-300/10 px-5 py-4 md:px-8">
          <p className="text-xl font-semibold text-orange-300">RepoXray</p>
          <nav className="flex items-center gap-2 text-xs text-orange-100/80">
            <span className="rounded-lg border border-orange-300/15 px-2 py-1">GitHub</span>
            <span className="rounded-lg border border-orange-300/15 px-2 py-1">History</span>
            <span className="rounded-lg border border-orange-300/15 px-2 py-1">Docs</span>
          </nav>
        </header>

        <section className="grid gap-6 px-5 py-7 md:px-8 md:py-10">
          <div className="grid gap-4 md:gap-5">
            <p className="inline-flex w-fit items-center rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-orange-300 uppercase">
              RepoXray
            </p>
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.03] text-orange-50 md:text-6xl">
              RepoXray <span className="text-orange-300">Repository Analyzer</span>
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-orange-100/80 md:text-lg">
              Instantly understand repository architecture, tech stack, and codebase structure using smart file selection and structured AI explanations.
            </p>
          </div>

          <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-orange-300/20 bg-[#1a0f08cc] p-4 md:p-5">
            <label className="grid gap-2 text-xs font-semibold tracking-[0.14em] text-orange-200 uppercase">
              GitHub URL
              <input
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/owner/repository"
                disabled={loading}
                className="rounded-xl border border-orange-300/15 bg-[#150a05] px-4 py-3 font-mono text-sm text-orange-50 outline-none transition focus:border-orange-300/55 focus:ring-2 focus:ring-orange-300/20 disabled:opacity-50"
              />
            </label>

            {isAnalyzed && (
              <label className="grid gap-2 text-xs font-semibold tracking-[0.14em] text-orange-200 uppercase">
                Ask a Question
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={3}
                  className="rounded-xl border border-orange-300/15 bg-[#150a05] px-4 py-3 text-sm text-orange-50 outline-none transition focus:border-orange-300/55 focus:ring-2 focus:ring-orange-300/20"
                  placeholder="How is authentication handled in this repository?"
                />
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                disabled={!canSubmit}
                className="rounded-xl bg-orange-400 px-5 py-2.5 text-sm font-semibold text-orange-950 transition enabled:hover:-translate-y-0.5 enabled:hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analyzing..." : isAnalyzed ? "Ask" : "Analyze Repo"}
              </button>
              {isAnalyzed && (result?.sampleQuestions || []).slice(0, 3).map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setQuestion(sample)}
                  className="rounded-xl border border-orange-300/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-100 transition hover:border-orange-300/50"
                >
                  {sample}
                </button>
              ))}
            </div>
          </form>

          {error ? (
            <div className="rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
          ) : null}

          {loading ? (
            <section className="grid gap-4 rounded-2xl border border-orange-300/15 bg-[#150a05] p-5 md:p-7">
              <div className="mx-auto h-20 w-20 rounded-full border-4 border-orange-800/60 border-b-orange-300 animate-spin" />
              <ul className="mx-auto grid w-full max-w-lg gap-2 text-sm text-orange-100/90">
                {ANALYSIS_STAGES.map((stage, index) => {
                  const isDone = index < loadingStageIndex;
                  const isActive = index === loadingStageIndex;

                  return (
                    <li
                      key={stage}
                      className={`rounded-lg border px-3 py-2 transition ${
                        isDone
                          ? "border-orange-300/30 bg-orange-500/10 text-orange-200"
                          : isActive
                          ? "border-orange-300/40 bg-orange-500/15 text-orange-100"
                          : "border-orange-800/60 bg-orange-950/55 text-orange-600"
                      }`}
                    >
                      {isDone ? "[x]" : isActive ? "[ ]" : "[-]"} {stage}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {result ? (
            <section className="grid gap-5 xl:grid-cols-[300px,1fr]">
              <aside className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-[0.15em] text-orange-200 uppercase">Explorer</h2>
                  <span className="text-[11px] text-orange-400/70">
                    {result.repositoryStructure?.totalFiles || 0} files
                  </span>
                </div>
                <div className="max-h-140 overflow-auto rounded-lg border border-orange-300/10 bg-[#0d0704] py-2">
                  {projectTree.length > 0 ? (
                    renderTree(projectTree)
                  ) : (
                    <p className="px-3 py-2 text-xs text-orange-400/70">Not found in provided files.</p>
                  )}
                </div>
                {result.repositoryStructure?.truncated ? (
                  <p className="mt-2 text-xs text-amber-200/90">
                    Showing first 500 files for performance.
                  </p>
                ) : null}
              </aside>

              {isInitialResultView ? (
                <article className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-4">
                  <h2 className="mb-3 text-sm font-semibold tracking-[0.15em] text-orange-200 uppercase">Code Quality</h2>
                  <p className="mb-3 text-2xl font-semibold text-orange-100">
                    {result.quality?.score ?? 0}
                    <span className="text-sm text-orange-400/70">/{result.quality?.outOf ?? 100}</span>
                  </p>
                  <div className="grid gap-2.5">
                    {(result.quality?.categories || []).map((category, idx) => (
                      <div key={category.name || idx} className="grid gap-1">
                        <div className="flex items-center justify-between text-xs text-orange-100/80">
                          <span>{category.name}</span>
                          <span>{category.score}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-orange-900/50">
                          <div
                            className="h-1.5 rounded-full bg-linear-to-r from-orange-300 via-orange-400 to-rose-300"
                            style={{ width: `${Math.max(5, Math.min(100, category.score))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              {/* Dependency Graph Section */}
              {!isInitialResultView ? (
              <aside className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-[0.15em] text-orange-200 uppercase">Execution Flow</h2>
                  <span className="text-[11px] text-orange-400/70">
                    {result.keyFiles?.length || 0} nodes
                  </span>
                </div>
                <div className="max-h-80 overflow-auto rounded-lg border border-orange-300/10 bg-[#0d0704] p-3">
                  {result.keyFiles && result.keyFiles.length > 0 ? (
                    <div className="relative">
                      {/* Flow diagram */}
                      <div className="flex flex-col gap-2">
                        {result.keyFiles.slice(0, 8).map((file, index) => {
                          const roleColors: Record<string, string> = {
                            "ENTRY_POINT": "bg-orange-500/30 border-orange-400",
                            "ROUTER": "bg-rose-500/30 border-rose-400",
                            "HANDLER": "bg-amber-500/30 border-amber-400",
                            "SERVICE": "bg-yellow-500/30 border-yellow-400",
                            "CONFIG": "bg-stone-500/30 border-stone-400",
                            "Implementation file": "bg-orange-800/30 border-orange-700",
                          };
                          const colorClass = roleColors[file.role] || "bg-orange-800/30 border-orange-700";
                          
                          return (
                            <div key={`${file.path}-${index}`} className="relative">
                              {/* Connection line */}
                              {index > 0 && (
                                <div className="absolute -top-2 left-4 h-2 w-0.5 bg-orange-500/40" />
                              )}
                              <div className={`rounded-lg border px-3 py-2 ${colorClass}`}>
                                <p className="font-mono text-[10px] text-orange-100 truncate" title={file.path}>
                                  {file.path.split("/").pop()}
                                </p>
                                <p className="text-[9px] text-orange-300/70">{file.role}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {result.keyFiles.length > 8 && (
                        <p className="mt-2 text-center text-[10px] text-orange-400/70">
                          +{result.keyFiles.length - 8} more files
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-orange-400/70">No execution flow data available.</p>
                  )}
                </div>
              </aside>
              ) : null}

              {!isInitialResultView ? (
              <div className="grid gap-5 lg:grid-cols-[280px,1fr]">
                <aside className="grid gap-4">
                <article className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-4">
                  <h2 className="mb-3 text-sm font-semibold tracking-[0.15em] text-orange-200 uppercase">Tech Stack</h2>
                  <div className="flex flex-wrap gap-2">
                    {(result.techStack.length ? result.techStack : ["Not found in provided files"]).map((item) => (
                      <span key={item} className="rounded-full border border-orange-300/25 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-100">
                        {item}
                      </span>
                    ))}
                  </div>
                </article>

                <article className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-4">
                  <h2 className="mb-3 text-sm font-semibold tracking-[0.15em] text-orange-200 uppercase">Code Quality</h2>
                  <p className="mb-3 text-2xl font-semibold text-orange-100">
                    {result.quality?.score ?? 0}
                    <span className="text-sm text-orange-400/70">/{result.quality?.outOf ?? 100}</span>
                  </p>
                  <div className="grid gap-2.5">
                    {(result.quality?.categories || []).map((category, idx) => (
                      <div key={category.name || idx} className="grid gap-1">
                        <div className="flex items-center justify-between text-xs text-orange-100/80">
                          <span>{category.name}</span>
                          <span>{category.score}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-orange-900/50">
                          <div
                            className="h-1.5 rounded-full bg-linear-to-r from-orange-300 via-orange-400 to-rose-300"
                            style={{ width: `${Math.max(5, Math.min(100, category.score))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-4">
                  <h2 className="mb-3 text-sm font-semibold tracking-[0.15em] text-orange-200 uppercase">Sample Questions</h2>
                  <ul className="grid gap-2">
                    {(result.sampleQuestions || []).map((sample, index) => (
                      <li key={sample}>
                        <button
                          type="button"
                          onClick={() => setQuestion(sample)}
                          className="w-full rounded-lg border border-orange-300/15 bg-orange-500/5 px-3 py-2 text-left text-xs text-orange-100/80 transition hover:border-orange-300/35"
                        >
                          {String(index + 1).padStart(2, "0")} {sample}
                        </button>
                      </li>
                    ))}
                  </ul>
                </article>
                </aside>

                <div className="grid gap-4">
                <article className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-5">
                  <h2 className="mb-2 text-xl font-semibold text-orange-200">Repository Assistant</h2>
                  <p className="text-sm text-orange-100/80">{result.overview}</p>
                </article>

                {result.queryAnswer ? (
                  <article className="rounded-2xl border border-rose-300/20 bg-rose-500/5 p-5">
                    <h2 className="mb-2 text-sm font-semibold tracking-[0.15em] text-rose-200 uppercase">Answer To Your Query</h2>
                    <p className="whitespace-pre-line text-sm text-rose-100/90">{result.queryAnswer}</p>
                  </article>
                ) : null}

                {result.detailedSummary ? (
                  <article className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-5">
                    <h2 className="mb-2 text-sm font-semibold tracking-[0.15em] text-orange-200 uppercase">Detailed Summary</h2>
                    <p className="whitespace-pre-line text-sm text-orange-100/80">{result.detailedSummary}</p>
                  </article>
                ) : null}

                <article className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-5">
                  <div className="markdown-report prose prose-invert max-w-none text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.reportMarkdown || result.explanation}</ReactMarkdown>
                  </div>
                </article>

                <article className="rounded-2xl border border-orange-300/15 bg-[#150a05] p-5">
                  <h2 className="mb-3 text-sm font-semibold tracking-[0.15em] text-orange-200 uppercase">Selected Key Files</h2>
                  <ul className="grid gap-2">
                    {(result.keyFiles.length ? result.keyFiles : [{ path: "Not found in provided files", role: "Not found in provided files" }]).map((item) => (
                      <li key={`${item.path}-${item.role}`} className="rounded-lg border border-orange-300/15 bg-[#0d0704] px-3 py-2">
                        <p className="font-mono text-xs text-orange-200">{item.path}</p>
                        <p className="text-xs text-orange-100/60">{item.role}</p>
                      </li>
                    ))}
                  </ul>
                </article>

                {(result.notes || []).length > 0 ? (
                  <article className="rounded-2xl border border-amber-300/20 bg-amber-500/5 p-5">
                    <h2 className="mb-2 text-sm font-semibold tracking-[0.15em] text-amber-200 uppercase">Limitations / Notes</h2>
                    <ul className="grid gap-1 text-sm text-amber-100/90">
                      {result.notes.map((note) => (
                        <li key={note}>- {note}</li>
                      ))}
                    </ul>
                  </article>
                ) : null}

                {result.debug ? (
                  <article className="rounded-2xl border border-orange-300/20 bg-orange-500/5 p-5">
                    <h2 className="mb-2 text-sm font-semibold tracking-[0.15em] text-orange-200 uppercase">Debug</h2>
                    <p className="mb-3 text-xs text-orange-100/90">
                      Repo: {result.debug.repository?.repoName} ({result.debug.repository?.branch}) | Total files: {result.debug.repository?.totalFiles} | LLM used: {String(result.debug.usedLlm)}
                    </p>
                    {result.debug.llmInfo ? (
                      <p className="mb-3 text-xs text-orange-100/90">
                        Provider: {result.debug.llmInfo.provider || "unknown"} | Model: {result.debug.llmInfo.model || "unknown"} | Error: {result.debug.llmInfo.error || "none"}
                      </p>
                    ) : null}
                    <ul className="grid gap-1 text-xs text-orange-100/90">
                      {(result.debug.selectedFiles || []).map((file) => (
                        <li key={file.path}>
                          {file.path} ({file.reason})
                        </li>
                      ))}
                    </ul>
                  </article>
                ) : null}
                </div>
              </div>
              ) : null}
            </section>
          ) : null}
        </section>
      </main>
    </div>
  );
}
