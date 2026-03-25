import { getFileFilterConfig } from "../fileFilter.js";

const MAX_FILES = 20;
const MIN_FILES = 8;
const OVERVIEW_MAX_SIZE_BYTES = 50 * 1024;
const OVERVIEW_MAX_DEPTH = 3;

function isOverviewFile(path) {
  const p = path.toLowerCase();

  const overviewPatterns = [
    "readme",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "pnpm-workspace.yaml",
    "lerna.json",
    "nx.json",
    "turbo.json",
    "tsconfig",
    ".npmrc",
    ".nvmrc",
    ".node-version",
    ".env",
    ".env.example",
    ".env.local",
    ".gitignore",
    ".dockerignore",
    ".editorconfig",
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.js",
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.js",
    "jest.config",
    "vitest.config",
    "webpack.config",
    "vite.config",
    "rollup.config",
    "tsconfig.json",
    "jsconfig.json",
    ".devcontainer",
    "docker-compose",
    "Makefile",
    "CMakeLists.txt",
    "go.mod",
    "go.sum",
    "Cargo.toml",
    "requirements.txt",
    "Pipfile",
    "pyproject.toml",
    "setup.py",
    "Gemfile",
    "composer.json",
    "pom.xml",
    "build.gradle",
    "gradle.properties",
  ];

  if (overviewPatterns.some((pattern) => p.endsWith(pattern) || p.includes(`/${pattern}`))) {
    return true;
  }

  if (p.includes(".github/")) return true;
  if (p.includes(".devcontainer/")) return true;

  return false;
}

function isShallow(path) {
  const depth = path.split("/").length;
  if (path.includes(".github") || path.includes(".devcontainer")) {
    return depth <= 5;
  }
  return depth <= OVERVIEW_MAX_DEPTH;
}


const GARBAGE_SEGMENTS = new Set([
  "node_modules",
  "test",
  "tests",
  "__tests__",
  "spec",
  "__mocks__",
  "example",
  "examples",
  "docs",
  "dist",
  "build",
  "coverage",
  ".cache",
  "out",
  "tmp",
  "temp",
]);

function isGarbagePath(path) {
  const segments = path.toLowerCase().split("/");
  return segments.some((seg) => GARBAGE_SEGMENTS.has(seg));
}

/**
 * Tokenize query (lightweight)
 */
function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter(Boolean);
}

/**
 * Helper: normalize extension to ".ts", ".js", etc.
 */
function getExtension(path) {
  if (!path || !path.includes(".")) return "";
  return `.${path.split(".").pop().toLowerCase()}`;
}

/**
 * EXECUTION SIGNAL (PRIMARY)
 * Scores a file based on how likely it is to be a core architectural file,
 * independent of the user's query.
 */
function getExecutionScore(path) {
  const p = path.toLowerCase();
  let score = 0;

  if (p.includes("server")) score += 15;
  if (p.includes("router")) score += 15;
  if (p.includes("render")) score += 15;

  if (p.includes("app")) score += 10;
  if (p.includes("handler")) score += 10;
  if (p.includes("core")) score += 10;

  if (p.includes("controller")) score += 8;
  if (p.includes("service")) score += 8;
  if (p.includes("route")) score += 8;

  if (p.includes("src/")) score += 5;

  const fileName = p.split("/").pop();
  if (
    [
      "index.js",
      "index.ts",
      "index.jsx",
      "index.tsx",
      "main.js",
      "main.ts",
      "server.js",
      "server.ts",
      "app.js",
      "app.ts",
    ].includes(fileName)
  ) {
    score += 10;
  }

  return score;
}

function getQueryScore(path, queryTerms) {
  if (!queryTerms.length) return 0;

  const p = path.toLowerCase();
  const segments = p.split("/");
  let score = 0;

  for (const term of queryTerms) {
    if (p.includes(term)) {
      const isExactSegmentMatch = segments.some((seg) => seg === term || seg.startsWith(term));
      score += isExactSegmentMatch ? 9 : 6;
    }
  }

  return score;
}

/**
 * Top-level grouping (for diversity)
 */
function getTopLevel(path) {
  return path.split("/")[0] || "(root)";
}

/**
 * MAIN SELECTOR
 */
export function selectRelevantFilePaths({
  files,
  question,
  maxFiles = MAX_FILES,
}) {
  const safeMax = Math.min(
    Math.max(Number(maxFiles) || MAX_FILES, MIN_FILES),
    MAX_FILES
  );
  const config = getFileFilterConfig();

  const isOverviewMode =
    !question ||
    (typeof question === "string" && question.trim().length === 0) ||
    question === "__INIT__";

  if (isOverviewMode) {
    const overviewCandidates = [];

    for (const file of files) {
      const path = file.path;

      if (!isOverviewFile(path)) continue;
      if (!isShallow(path)) continue;
      if (typeof file.size === "number" && file.size > OVERVIEW_MAX_SIZE_BYTES) continue;

      overviewCandidates.push({ path, reason: "overview_file" });
    }

    if (overviewCandidates.length > 0) {
      overviewCandidates.sort((a, b) => {
        const depthA = a.path.split("/").length;
        const depthB = b.path.split("/").length;
        if (depthA !== depthB) return depthA - depthB;
        return a.path.localeCompare(b.path);
      });

      const selected = overviewCandidates.slice(0, safeMax);

      return {
        selected,
        metadata: {
          totalCandidates: overviewCandidates.length,
          queryTerms: [],
          requestedMaxFiles: safeMax,
          mode: "overview",
        },
      };
    }
  }

  // EXECUTION MODE
  const queryTerms = tokenize(question);
  const candidates = [];

  for (const file of files) {
    const path = file.path;

    if (isGarbagePath(path)) continue;

    const ext = getExtension(path);
    if (!config.supportedCodeExtensions.has(ext)) continue;

    if (
      typeof file.size === "number" &&
      file.size > config.maxFileSizeBytes
    ) {
      continue;
    }

    const executionScore = getExecutionScore(path);
    const queryScore = getQueryScore(path, queryTerms);
    const totalScore = executionScore + queryScore;

    candidates.push({
      path,
      score: totalScore,
      executionScore,
      queryScore,
    });
  }

  // Fallback: if all files were filtered out, return best-effort selection.
  // a clean, explicit condition that correctly checks all three criteria.
  if (candidates.length === 0) {
    const fallback = files
      .filter((file) => {
        const path = file.path;
        const ext = getExtension(path);
        const withinSizeLimit =
          typeof file.size !== "number" || file.size <= config.maxFileSizeBytes;

        return (
          !isGarbagePath(path) &&
          config.supportedCodeExtensions.has(ext) &&
          withinSizeLimit
        );
      })
      .slice(0, safeMax)
      .map((file) => ({ path: file.path, reason: "fallback_selection" }));

    return {
      selected: fallback,
      metadata: {
        totalCandidates: 0,
        queryTerms,
        requestedMaxFiles: safeMax,
        fallbackUsed: true,
      },
    };
  }

  // Sort: primary by total score, tiebreak by execution score, then alphabetically
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      b.executionScore - a.executionScore ||
      a.path.localeCompare(b.path)
  );

  // Diversity control: avoid returning too many files from the same top-level folder
  const selected = [];
  const folderCount = new Map();
  const maxPerFolder = Math.max(2, Math.floor(safeMax / 3));

  for (const file of candidates) {
    if (selected.length >= safeMax) break;

    const top = getTopLevel(file.path);
    const used = folderCount.get(top) || 0;

    if (used >= maxPerFolder && selected.length < safeMax - 2) continue;

    selected.push({
      path: file.path,
      reason:
        file.queryScore > file.executionScore
          ? "query_support"
          : "execution_priority",
    });

    folderCount.set(top, used + 1);
  }

  // Top up if diversity pruning removed too many results
  if (selected.length < MIN_FILES) {
    const already = new Set(selected.map((f) => f.path));
    for (const file of candidates) {
      if (selected.length >= safeMax) break;
      if (already.has(file.path)) continue;

      selected.push({
        path: file.path,
        reason:
          file.queryScore > file.executionScore
            ? "query_support"
            : "execution_priority",
      });
      already.add(file.path);
    }
  }

  return {
    selected,
    metadata: {
      totalCandidates: candidates.length,
      queryTerms,
      requestedMaxFiles: safeMax,
    },
  };
}