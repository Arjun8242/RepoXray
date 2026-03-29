import type { AnalysisModel, FileEntry, QualityCategory, TreeNode } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeCategories(value: unknown): QualityCategory[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = asRecord(item);
      const name = typeof record.name === "string" ? record.name : "Unnamed";
      const score = typeof record.score === "number" ? record.score : 0;
      return { name, score };
    })
    .slice(0, 8);
}

function normalizeFiles(value: unknown): FileEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = asRecord(item);
      const path = typeof record.path === "string" ? record.path : "";
      const content = typeof record.content === "string" ? record.content : "";
      return { path, content };
    })
    .filter((file) => file.path.length > 0);
}

export function normalizeAnalysis(payload: Record<string, unknown>, analysisId: string): AnalysisModel {
  const quality = asRecord(payload.quality);
  const insights = asRecord(payload.insights);
  const repositoryStructure = asRecord(payload.repositoryStructure);

  const qualityScore = typeof quality.score === "number" ? quality.score : 0;
  const qualityOutOf = typeof quality.outOf === "number" ? quality.outOf : 100;
  const qualityCategories = normalizeCategories(quality.categories);

  const files = normalizeFiles(payload.files);
  const paths = asStringArray(repositoryStructure.paths);
  const fallbackPaths = files.map((file) => file.path);

  const summary =
    (typeof insights.summary === "string" && insights.summary) ||
    (typeof payload.overview === "string" ? payload.overview : "") ||
    "No summary available.";

  const strengths = asStringArray(insights.strengths);
  const weaknesses = asStringArray(insights.weaknesses);
  const suggestions = asStringArray(insights.suggestions);

  // ── reportMarkdown ────────────────────────────────────────────────────────
  // Primary field for the full AI architecture report.
  // Falls back through explanation → detailedSummary → queryAnswer → "".
  // This is what AnalysisPageClient renders through ReactMarkdown.
  const reportMarkdown =
    (typeof payload.reportMarkdown === "string" && payload.reportMarkdown) ||
    (typeof payload.explanation === "string" && payload.explanation) ||
    (typeof payload.detailedSummary === "string" && payload.detailedSummary) ||
    (typeof payload.queryAnswer === "string" && payload.queryAnswer) ||
    "";

  return {
    analysisId,
    quality: {
      score: qualityScore,
      outOf: qualityOutOf,
      categories: qualityCategories,
    },
    paths: paths.length ? paths : fallbackPaths,
    files,
    insights: {
      summary,
      strengths,
      weaknesses,
      suggestions,
    },
    reportMarkdown, 
  };
}

export function buildFileTree(paths: string[]): TreeNode[] {
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
      const nodePath = segments.slice(0, index + 1).join("/");
      const isFile = index === segments.length - 1;

      let node = cursor.children.find((item) => item.name === segment && item.path === nodePath);

      if (!node) {
        node = {
          name: segment,
          path: nodePath,
          type: isFile ? "file" : "folder",
          children: [],
        };
        cursor.children.push(node);
      }

      cursor = node;
    }
  }

  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children.length) sortNodes(node.children);
    }
  }

  sortNodes(root.children);
  return root.children;
}