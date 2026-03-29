import { fetchManyFileContents, fetchRepositorySnapshot } from "./github.service.js";
import { selectRelevantFilePaths } from "./selector.service.js";
import { buildStructuredContext } from "./contextBuilder.service.js";
import { runStructuredAnalysisWithLLM } from "./llm.service.js";

const STAGES = {
  FETCH_REPO:    { index: 0, label: "Fetching repository info..."    },
  READ_TREE:     { index: 1, label: "Reading file structure..."       },
  LOAD_README:   { index: 2, label: "Loading README..."               },
  DETECT_STACK:  { index: 3, label: "Detecting tech stack..."         },
  AI_ANALYZE:    { index: 4, label: "AI is analyzing the codebase..." },
  GENERATE:      { index: 5, label: "Generating explanation..."       },
};

const STAGE_LABELS = Object.values(STAGES)
  .sort((a, b) => a.index - b.index)
  .map((s) => s.label);

const MAX_STRUCTURE_PATHS = 500;
const analysisCache = new Map();

/* =========================
   CACHE HELPERS
========================= */

function buildCacheKey({ owner, repo, branch }) {
  return `${String(owner || "").toLowerCase()}/${String(repo || "").toLowerCase()}#${String(branch || "").toLowerCase()}`;
}

function readAnalysisCache({ owner, repo, branch }) {
  const key = buildCacheKey({ owner, repo, branch });
  return analysisCache.get(key) || null;
}

function writeAnalysisCache({ owner, repo, branch, repositoryStructure, quality }) {
  const key = buildCacheKey({ owner, repo, branch });
  analysisCache.set(key, {
    repositoryStructure,
    quality,
    updatedAt: Date.now(),
  });
}

/* =========================
   TECH STACK DETECTION
   Four passes — ordered by reliability:
     1. File extensions       → language detection
     2. package.json          → JS/TS ecosystem deps
     3. README content        → frameworks, DBs, cloud, auth, AI, etc.
     4. Config file names     → build tools, test runners, infra (no content needed)
========================= */

/**
 * README keyword map.
 * Each entry: [canonicalName, [...searchTerms]]
 * Terms matched as substrings in lowercased README text.
 * First matching term wins — no duplicates per canonical name.
 */
const README_TECH_SIGNALS = [
  // Runtimes
  ["Node.js",           ["node.js", "nodejs", "node js"]],
  ["Deno",              ["deno"]],
  ["Bun",               ["bun.sh", "bunjs", "bun runtime"]],

  // Frontend frameworks
  ["React",             ["react", "reactjs", "react.js", "react dom"]],
  ["Next.js",           ["next.js", "nextjs", "next js"]],
  ["Vue",               ["vue.js", "vuejs", "vue 3", "vue 2"]],
  ["Nuxt",              ["nuxt.js", "nuxtjs", "nuxt 3"]],
  ["Svelte",            ["svelte", "sveltekit"]],
  ["Angular",           ["angular", "@angular/core"]],
  ["Remix",             ["remix.run", "remix framework"]],
  ["Astro",             ["astro.build", "astro framework"]],
  ["Solid",             ["solidjs", "solid.js"]],

  // Backend frameworks
  ["Express",           ["express.js", "expressjs", "express framework"]],
  ["Fastify",           ["fastify"]],
  ["NestJS",            ["nestjs", "nest.js"]],
  ["Koa",               ["koa.js", "koajs"]],
  ["Django",            ["django"]],
  ["Flask",             ["flask"]],
  ["FastAPI",           ["fastapi"]],
  ["Spring Boot",       ["spring boot", "springboot"]],
  ["Laravel",           ["laravel"]],
  ["Rails",             ["ruby on rails", "rails framework"]],
  ["ASP.NET",           ["asp.net", "aspnet", ".net core"]],

  // Databases
  ["MongoDB",           ["mongodb", "mongo database"]],
  ["PostgreSQL",        ["postgresql", "postgres"]],
  ["MySQL",             ["mysql"]],
  ["SQLite",            ["sqlite"]],
  ["Redis",             ["redis"]],
  ["Supabase",          ["supabase"]],
  ["Firebase",          ["firebase", "firestore", "realtime database"]],
  ["PlanetScale",       ["planetscale"]],
  ["DynamoDB",          ["dynamodb", "amazon dynamodb"]],
  ["Elasticsearch",     ["elasticsearch"]],
  ["Cassandra",         ["apache cassandra", "cassandra"]],
  ["CockroachDB",       ["cockroachdb"]],

  // ORMs & query builders
  ["Prisma",            ["prisma"]],
  ["Drizzle",           ["drizzle orm", "drizzle-orm"]],
  ["Sequelize",         ["sequelize"]],
  ["TypeORM",           ["typeorm"]],
  ["SQLAlchemy",        ["sqlalchemy"]],

  // Cloud & hosting
  ["AWS",               ["amazon web services", "aws s3", "aws lambda", "aws ec2"]],
  ["GCP",               ["google cloud", "google cloud platform", "google cloud run"]],
  ["Azure",             ["microsoft azure", "azure functions", "azure devops"]],
  ["Vercel",            ["vercel", "deploy on vercel"]],
  ["Netlify",           ["netlify", "deploy to netlify"]],
  ["Railway",           ["railway.app", "deploy on railway"]],
  ["Render",            ["render.com", "deploy on render"]],
  ["Heroku",            ["heroku"]],
  ["Cloudflare",        ["cloudflare workers", "cloudflare pages"]],
  ["Fly.io",            ["fly.io", "flyctl"]],

  // Containers & orchestration
  ["Docker",            ["docker", "dockerfile", "docker-compose", "docker compose", "containerized"]],
  ["Kubernetes",        ["kubernetes", " k8s ", "helm chart"]],

  // Auth & security
  ["JWT",               ["json web token", "jsonwebtoken", "jwt authentication"]],
  ["OAuth",             ["oauth2", "oauth 2.0", "openid connect"]],
  ["Clerk",             ["clerk.dev", "clerk auth"]],
  ["Auth.js",           ["next-auth", "auth.js", "authjs"]],
  ["Passport",          ["passport.js", "passportjs"]],
  ["Supabase Auth",     ["supabase auth"]],
  ["Firebase Auth",     ["firebase auth", "firebase authentication"]],

  // AI / ML
  ["OpenAI",            ["openai", "gpt-4", "gpt-3", "chatgpt api", "openai api"]],
  ["Anthropic",         ["anthropic", "claude api", "claude model"]],
  ["LangChain",         ["langchain"]],
  ["Hugging Face",      ["hugging face", "huggingface", "transformers library"]],
  ["Gemini",            ["google gemini", "gemini api", "gemini pro"]],
  ["Ollama",            ["ollama"]],

  // Payments & comms
  ["Stripe",            ["stripe", "stripe payments", "stripe api"]],
  ["Twilio",            ["twilio"]],
  ["SendGrid",          ["sendgrid"]],
  ["Resend",            ["resend.com", "resend email"]],

  // Message queues
  ["BullMQ",            ["bullmq", "bull queue"]],
  ["RabbitMQ",          ["rabbitmq"]],
  ["Kafka",             ["apache kafka", "kafka"]],

  // Testing
  ["Jest",              ["jest testing", "jest framework"]],
  ["Vitest",            ["vitest"]],
  ["Cypress",           ["cypress testing", "cypress e2e"]],
  ["Playwright",        ["playwright"]],

  // CSS & UI
  ["Tailwind CSS",      ["tailwindcss", "tailwind css", "tailwind.config"]],
  ["Sass",              ["sass", "scss"]],
  ["shadcn/ui",         ["shadcn", "shadcn/ui"]],
  ["Radix UI",          ["radix ui", "radix-ui"]],

  // CI/CD
  ["GitHub Actions",    ["github actions", ".github/workflows"]],
  ["GitLab CI",         ["gitlab ci", ".gitlab-ci"]],
  ["CircleCI",          ["circleci"]],

  // Monitoring
  ["Sentry",            ["sentry.io", "sentry sdk"]],
  ["Datadog",           ["datadog"]],
];

/**
 * Config file patterns → tech name.
 * Matched against file paths in the tree — no file content needed.
 */
const CONFIG_FILE_SIGNALS = [
  [/vite\.config\.(js|ts|mjs)$/i,         "Vite"],
  [/vitest\.config\.(js|ts)$/i,           "Vitest"],
  [/tailwind\.config\.(js|ts|cjs|mjs)$/i, "Tailwind CSS"],
  [/next\.config\.(js|ts|mjs)$/i,         "Next.js"],
  [/nuxt\.config\.(js|ts)$/i,             "Nuxt"],
  [/svelte\.config\.(js|ts)$/i,           "Svelte"],
  [/astro\.config\.(js|ts|mjs)$/i,        "Astro"],
  [/remix\.config\.(js|ts)$/i,            "Remix"],
  [/jest\.config\.(js|ts|json)$/i,        "Jest"],
  [/playwright\.config\.(js|ts)$/i,       "Playwright"],
  [/cypress\.config\.(js|ts)$/i,          "Cypress"],
  [/(^|\/)prisma\/schema\.prisma$/i,      "Prisma"],
  [/drizzle\.config\.(js|ts)$/i,          "Drizzle"],
  [/docker-compose\.ya?ml$/i,             "Docker"],
  [/(^|\/)dockerfile$/i,                  "Docker"],
  [/\.github\/workflows\/.+\.ya?ml$/i,    "GitHub Actions"],
  [/requirements\.txt$/i,                 "Python"],
  [/pyproject\.toml$/i,                   "Python"],
  [/cargo\.toml$/i,                       "Rust"],
  [/go\.mod$/i,                           "Go"],
  [/pom\.xml$/i,                          "Java"],
  [/build\.gradle(\.kts)?$/i,             "Java"],
  [/(^|\/)gemfile$/i,                     "Ruby"],
  [/composer\.json$/i,                    "PHP"],
];

function parseReadmeForTech(readmeContent, techSet) {
  const text = readmeContent.toLowerCase();
  for (const [canonicalName, terms] of README_TECH_SIGNALS) {
    for (const term of terms) {
      if (text.includes(term)) {
        techSet.add(canonicalName);
        break; // one match per canonical name is enough
      }
    }
  }
}

function detectFromConfigFiles(treeFiles, techSet) {
  for (const file of treeFiles) {
    for (const [pattern, name] of CONFIG_FILE_SIGNALS) {
      if (pattern.test(file.path)) {
        techSet.add(name);
        break;
      }
    }
  }
}

function detectTechStack(treeFiles, fetchedFiles) {
  const tech = new Set();

  /* ── Pass 1: file extensions → programming languages ── */
  const extensionToLanguage = {
    js:    "JavaScript",
    jsx:   "JavaScript",
    ts:    "TypeScript",
    tsx:   "TypeScript",
    py:    "Python",
    java:  "Java",
    go:    "Go",
    rs:    "Rust",
    rb:    "Ruby",
    cs:    "C#",
    php:   "PHP",
    swift: "Swift",
    kt:    "Kotlin",
    c:     "C",
    cpp:   "C++",
    h:     "C/C++",
  };

  for (const file of treeFiles) {
    const ext = file.path.includes(".") ? file.path.split(".").pop().toLowerCase() : "";
    const language = extensionToLanguage[ext];
    if (language) tech.add(language);
  }

  /* ── Pass 2: package.json → JS/TS ecosystem deps ── */
  const packageFile = fetchedFiles.find((file) =>
    /(^|\/)package\.json$/i.test(file.path)
  );

  if (packageFile?.content) {
    try {
      const parsed = JSON.parse(packageFile.content);
      const dependencies = {
        ...(parsed.dependencies || {}),
        ...(parsed.devDependencies || {}),
      };

      const importantDeps = [
        "react", "next", "vue", "nuxt", "svelte", "@sveltejs/kit",
        "astro", "remix", "@remix-run/node", "solid-js",
        "express", "fastify", "koa", "@hapi/hapi", "@nestjs/core",
        "mongoose", "mongodb", "pg", "mysql", "mysql2", "sqlite", "sqlite3",
        "prisma", "@prisma/client", "drizzle-orm", "sequelize", "typeorm",
        "redis", "ioredis",
        "graphql", "apollo-server", "@apollo/server",
        "socket.io",
        "stripe", "twilio", "@sendgrid/mail", "resend",
        "bullmq", "bull",
        "passport", "jsonwebtoken", "bcrypt",
        "firebase", "@supabase/supabase-js",
        "@aws-sdk/client-s3", "aws-sdk",
        "openai", "@anthropic-ai/sdk", "langchain",
        "tailwindcss",
        "jest", "vitest", "cypress", "@playwright/test",
        "vite", "webpack", "esbuild",
        "sentry", "@sentry/node",
      ];

      for (const depName of Object.keys(dependencies)) {
        if (importantDeps.includes(depName.toLowerCase())) {
          tech.add(depName);
        }
      }
    } catch {
      // malformed package.json — skip
    }
  }

  /* ── Pass 3: README keyword scanning ── */
  const readmeFile = fetchedFiles.find((file) =>
    /(^|\/)readme(\.md|\.txt|\.rst)?$/i.test(file.path)
  );

  if (readmeFile?.content) {
    parseReadmeForTech(readmeFile.content, tech);
  }

  /* ── Pass 4: config file names in the tree (no content needed) ── */
  detectFromConfigFiles(treeFiles, tech);

  return Array.from(tech).sort((a, b) => a.localeCompare(b));
}

/* =========================
   GUARDS & HELPERS
========================= */

function isValidQuality(quality) {
  return Boolean(
    quality &&
    Array.isArray(quality.categories) &&
    quality.categories.length > 0
  );
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function ensureStringArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item) => typeof item === "string" && item.trim().length > 0);
}

function inferRole(path) {
  const lower = path.toLowerCase();
  if (lower.includes("route"))                              return "API route";
  if (lower.includes("controller"))                         return "Controller";
  if (lower.includes("service"))                            return "Service logic";
  if (lower.includes("model") || lower.includes("schema"))  return "Data model";
  if (lower.includes("middleware"))                         return "Middleware";
  if (lower.includes("config"))                             return "Configuration";
  return "Implementation file";
}

/* =========================
   QUALITY SCORING
========================= */

function buildQualityBreakdown() {
  return {
    score: 50,
    outOf: 100,
    categories: [
      { name: "Documentation",   score: 50 },
      { name: "Code Structure",  score: 50 },
      { name: "Maintainability", score: 50 },
      { name: "Testability",     score: 50 },
    ],
  };
}

function buildInitialQuality({ treeFiles, selectedFiles, techStack }) {
  const totalFiles    = treeFiles.length;
  const selectedCount = selectedFiles.length;
  const hasReadme     = treeFiles.some((file) => /(^|\/)readme(\.md)?$/i.test(file.path));
  const hasTests      = treeFiles.some((file) => /(^|\/)(__tests__|tests?|spec)(\/|$)/i.test(file.path));
  const hasCi         = treeFiles.some((file) => /(^|\/)\.github\/workflows\//i.test(file.path));

  const structureScore  = Math.min(100, 45 + Math.min(35, selectedCount * 4));
  const stackScore      = Math.min(100, 40 + Math.min(35, techStack.length * 8));
  const docsScore       = hasReadme ? 85 : 45;
  const testingScore    = hasTests  ? 75 : 40;
  const automationScore = hasCi     ? 80 : 45;

  const categories = [
    { name: "Structure",       score: structureScore  },
    { name: "Stack Clarity",   score: stackScore      },
    { name: "Documentation",   score: docsScore       },
    { name: "Testing Signals", score: testingScore    },
    { name: "Automation",      score: automationScore },
  ];

  const score = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  return {
    score,
    outOf: 100,
    categories,
    metadata: { totalFiles, selectedCount },
  };
}

/* =========================
   FALLBACK (NO LLM)
========================= */

function buildFallbackSampleQuestions() {
  return [
    "What does this project do?",
    "Explain the architecture of this project.",
    "How do I run this project locally?",
    "What are the main components?",
    "What are potential risks or limitations?",
  ];
}

function buildFallbackMarkdownReport({
  repoName,
  question,
  techStack,
  keyFiles,
  queryCategories,
  selectedCount,
  quality,
}) {
  const stackLine = techStack.length ? techStack.join(", ") : "Unknown";
  const focusLine = queryCategories.length ? queryCategories.join(", ") : "general architecture";

  const tableRows = keyFiles.length
    ? keyFiles.map((file) => `| \`${file.path}\` | ${file.role} |`).join("\n")
    : "| — | No key files identified |";

  const qualitySummary = quality
    ? quality.categories.map((c) => `- **${c.name}**: ${c.score}/100`).join("\n")
    : "";

  const limitations = [
    "AI analysis is based on a curated subset of files, not the full codebase.",
    "Implementation details in unselected files may affect accuracy.",
    "Always verify AI-generated explanations against the actual source.",
  ];

  return [
    `# Repository analysis: ${repoName}`,
    "",
    "## Quick summary",
    `Analysed ${selectedCount} high-signal files for this question: "${question}".`,
    `Detected focus area: ${focusLine}.`,
    `Detected stack: ${stackLine}.`,
    "",
    qualitySummary ? "## Code quality (heuristic)\n" + qualitySummary : "",
    "",
    "## Architecture snapshot",
    "```",
    "Client/UI  <->  API Routes  <->  Services  <->  Data / External APIs",
    "     |               |",
    "     +---- config / entry files define runtime wiring",
    "```",
    "",
    "## Smart file selection",
    "The analysis prioritised README, dependency manifests, entry points, config files,",
    "and query-related source files to maximise useful context within token limits.",
    "",
    "## Key files to inspect",
    "| File | Purpose |",
    "|---|---|",
    tableRows,
    "",
    "## Limitations",
    limitations.map((l) => `- ${l}`).join("\n"),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildProjectStructure(treeFiles, selectedPaths = []) {
  const pathsToShow = selectedPaths.length > 0
    ? selectedPaths
    : treeFiles.map((file) => file.path).slice(0, MAX_STRUCTURE_PATHS);

  return {
    paths:      pathsToShow.sort((a, b) => a.localeCompare(b)),
    truncated:  false,
    totalFiles: pathsToShow.length,
  };
}

function buildFallbackAnalysis({
  repoName,
  question,
  techStack,
  selectedFiles,
  queryCategories,
}) {
  const keyFiles = selectedFiles.map((file) => ({
    path: file.path,
    role: inferRole(file.path),
  }));

  const focusSummary = queryCategories.length > 0
    ? `Detected query focus: ${queryCategories.join(", ")}.`
    : "Detected query focus: general architecture.";

  const explanation = [
    `The analysis was generated using ${selectedFiles.length} selected files from ${repoName}.`,
    focusSummary,
    `Question: ${question}`,
    "Detailed control flow may be incomplete if it is not represented in the selected file snippets.",
  ].join(" ");

  const detailedSummary = [
    `Repository: ${repoName}`,
    `Selected files analysed: ${selectedFiles.length}`,
    `Tech stack inferred: ${techStack.join(", ") || "Unknown"}`,
    focusSummary,
  ].join("\n");

  const keyFileLine = keyFiles.length
    ? keyFiles.slice(0, 5).map((f) => f.path).join(", ")
    : "No files identified";

  const queryAnswer = [
    `Question: ${question}`,
    "Direct answer: The repository appears to implement this area through the selected files listed below.",
    "Complete certainty depends on unseen code outside the selected subset.",
    `Evidence from selected files: ${keyFileLine}`,
  ].join("\n");

  const quality         = buildQualityBreakdown();
  const sampleQuestions = buildFallbackSampleQuestions();
  const reportMarkdown  = buildFallbackMarkdownReport({
    repoName,
    question,
    techStack,
    keyFiles,
    queryCategories,
    selectedCount: selectedFiles.length,
    quality,
  });

  return {
    overview: `${repoName} appears to be a software project built with ${techStack.join(", ") || "an unidentified stack"}.`,
    techStack,
    keyFiles,
    explanation,
    detailedSummary,
    queryAnswer,
    quality,
    sampleQuestions,
    reportMarkdown,
    notes: [],
  };
}

/* =========================
   MAIN EXPORT
========================= */

export async function analyzeRepository({
  repoUrl,
  question,
  branch,
  maxFiles,
  debug             = false,
  onStage           = null,
  isInitialAnalysis = false,
}) {
  const emit = (stage) => {
    if (stage && typeof onStage === "function") {
      onStage(stage.index, stage.label);
    }
  };

  /* ── 1. Fetch repo snapshot ── */
  emit(STAGES.FETCH_REPO);
  const snapshot = await fetchRepositorySnapshot(repoUrl, branch);

  const cachedAnalysis = readAnalysisCache({
    owner:  snapshot.owner,
    repo:   snapshot.repo,
    branch: snapshot.branch,
  });

  /* ── 2. Select relevant files ── */
  emit(STAGES.READ_TREE);

  const effectiveQuestion = isInitialAnalysis ? "__INIT__" : question;

  const selection     = selectRelevantFilePaths({
    files:    snapshot.files,
    question: effectiveQuestion,
    maxFiles,
  });

  const selectedList  = ensureArray(selection?.selected);
  const selectedPaths = selectedList.map((item) => item.path);

  const repositoryStructure = buildProjectStructure(snapshot.files, selectedPaths);

  /* ── 3. Fetch file contents ── */
  emit(STAGES.LOAD_README);
  const fetched = await fetchManyFileContents({
    owner:     snapshot.owner,
    repo:      snapshot.repo,
    branch:    snapshot.branch,
    filePaths: selectedPaths,
  });

  const selectedMetaMap = new Map(
    selectedList.map((item) => [item.path, item])
  );

  const fetchedFiles    = ensureArray(fetched?.files);
  const filesWithReason = fetchedFiles.map((file) => {
    const meta = selectedMetaMap.get(file.path);
    return {
      ...file,
      reason:         meta?.reason         || "query_match",
      executionScore: meta?.executionScore || 0,
      queryScore:     meta?.queryScore     || 0,
    };
  });

  /* ── 4. Detect tech stack ──
     Always fetch the README separately for detectTechStack so README-based
     detection works even when the README wasn't selected as a key file.
  ── */
  emit(STAGES.DETECT_STACK);

  const readmePath = snapshot.files.find((f) =>
    /(^|\/)readme(\.md|\.txt|\.rst)?$/i.test(f.path)
  )?.path;

  let allFetchedForStack = filesWithReason;

  if (readmePath && !selectedPaths.includes(readmePath)) {
    try {
      const readmeFetch = await fetchManyFileContents({
        owner:     snapshot.owner,
        repo:      snapshot.repo,
        branch:    snapshot.branch,
        filePaths: [readmePath],
      });
      const readmeFiles = ensureArray(readmeFetch?.files);
      allFetchedForStack = [...filesWithReason, ...readmeFiles];
    } catch {
      // README fetch failed — continue with what we have
    }
  }

  const techStack = detectTechStack(snapshot.files, allFetchedForStack);

  /* ── 5. Initial analysis (repo scan only — no LLM) ── */
  if (isInitialAnalysis) {
    const initialQuality = buildInitialQuality({
      treeFiles:     snapshot.files,
      selectedFiles: filesWithReason,
      techStack,
    });

    writeAnalysisCache({
      owner:               snapshot.owner,
      repo:                snapshot.repo,
      branch:              snapshot.branch,
      repositoryStructure,
      quality:             initialQuality,
    });

    emit(STAGES.GENERATE);

    const initialResponse = {
      overview:             `Repository scan ready for ${snapshot.repoName}.`,
      techStack,
      keyFiles:             [],
      explanation:          "",
      detailedSummary:      "",
      queryAnswer:          "",
      reportMarkdown:       "",
      quality:              initialQuality,
      sampleQuestions:      buildFallbackSampleQuestions(),
      repositoryStructure,
      analysisMode:         "initial",
      stages:               STAGE_LABELS,
      notes:                [],
    };

    if (debug) {
      initialResponse.debug = {
        repository: {
          repoName:   snapshot.repoName,
          branch:     snapshot.branch,
          totalFiles: snapshot.files.length,
        },
        selectedFiles: filesWithReason.map((f) => ({
          path:   f.path,
          size:   f.size,
          reason: f.reason,
        })),
        selection:   selection?.metadata || {},
        fetchErrors: ensureArray(fetched?.errors),
        cache:       { hit: false, stored: true },
        usedLlm:     false,
        llmInfo:     { provider: "none", model: "none" },
      };
    }

    return initialResponse;
  }

  /* ── 6. Build fallback (used if LLM fails) ── */
  const fallbackQuestion = isInitialAnalysis ? "Repository overview" : question;

  const fallback = buildFallbackAnalysis({
    repoName:        snapshot.repoName,
    question:        fallbackQuestion,
    techStack,
    selectedFiles:   filesWithReason,
    queryCategories: ensureArray(selection?.metadata?.activeCategories),
  });

  /* ── 7. Build context for LLM ── */
  const contextData = buildStructuredContext({
    repoName: snapshot.repoName,
    files:    filesWithReason,
  });

  /* ── 8. Call LLM ── */
  emit(STAGES.AI_ANALYZE);
  let llm = { usedLlm: false, result: fallback };

  try {
    const effectiveQuestionForLLM = isInitialAnalysis
      ? "Analyze this repository"
      : question;

    llm = await runStructuredAnalysisWithLLM({
      question:         effectiveQuestionForLLM,
      context:          contextData.context,
      fallbackResult:   fallback,
      techStackHint:    techStack,
      keyFileHint:      ensureArray(fallback.keyFiles).map((f) => f.path),
      isInitialAnalysis,
    });

    if (!llm?.result) throw new Error("Empty LLM result");

    const llmResult = llm.result;

    // Markdown is the primary output — fall back to heuristic if too short
    if (
      typeof llmResult.reportMarkdown !== "string" ||
      llmResult.reportMarkdown.trim().length < 100
    ) {
      llmResult.reportMarkdown = fallback.reportMarkdown;
    }

    llmResult.explanation     = llmResult.reportMarkdown;
    llmResult.detailedSummary = llmResult.reportMarkdown;
    llmResult.queryAnswer     = llmResult.reportMarkdown;

    if (typeof llmResult.overview !== "string" || llmResult.overview.trim().length === 0) {
      llmResult.overview = fallback.overview;
    }

    // Always use our deterministic techStack — more complete than LLM guessing
    llmResult.techStack = techStack;

    llmResult.quality = cachedAnalysis?.quality || fallback.quality;

    const llmSampleQuestions = ensureStringArray(llmResult.sampleQuestions);
    llmResult.sampleQuestions = llmSampleQuestions.length > 0
      ? llmSampleQuestions
      : ensureArray(fallback.sampleQuestions);

    llmResult.keyFiles = ensureArray(llmResult.keyFiles, fallback.keyFiles);
    llmResult.notes    = ensureStringArray(llmResult.notes);

  } catch (error) {
    fallback.notes = [...fallback.notes, `LLM unavailable: ${error.message}`];
    llm = {
      usedLlm: false,
      result:  fallback,
      info:    { provider: "anthropic", error: error.message },
    };
  }

  /* ── 9. Assemble final response ── */
  emit(STAGES.GENERATE);

  const response = {
    overview:            llm.result.overview,
    techStack:           llm.result.techStack,
    keyFiles:            llm.result.keyFiles,
    explanation:         llm.result.explanation,
    detailedSummary:     llm.result.detailedSummary,
    queryAnswer:         llm.result.queryAnswer,
    reportMarkdown:      llm.result.reportMarkdown,
    quality:             cachedAnalysis?.quality || llm.result.quality,
    sampleQuestions:     llm.result.sampleQuestions,
    repositoryStructure: cachedAnalysis?.repositoryStructure || repositoryStructure,
    analysisMode:        "full",
    stages:              STAGE_LABELS,
    notes:               llm.result.notes,
  };

  if (debug) {
    response.debug = {
      repository: {
        repoName:   snapshot.repoName,
        branch:     snapshot.branch,
        totalFiles: snapshot.files.length,
      },
      selectedFiles: filesWithReason.map((f) => ({
        path:   f.path,
        size:   f.size,
        reason: f.reason,
      })),
      selection:   selection?.metadata || {},
      truncation:  contextData.truncation,
      fetchErrors: ensureArray(fetched?.errors),
      cache: {
        hit:      Boolean(cachedAnalysis),
        storedAt: cachedAnalysis?.updatedAt || null,
      },
      usedLlm:  llm.usedLlm,
      llmInfo:  llm.info,
    };
  }

  return response;
}