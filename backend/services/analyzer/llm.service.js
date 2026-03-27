const DEFAULT_MODEL = process.env.LLM_MODEL || "claude-sonnet-4-20250514";

function getModelTokenLimit(model) {
  const normalized = String(model || "").toLowerCase();

  // Latest Sonnet 4 — 8192 output tokens
  if (normalized.includes("claude-sonnet-4") || normalized.includes("sonnet-4")) return 8192;
  if (normalized.includes("sonnet")) return 8192;
  if (normalized.includes("opus"))   return 8192;
  if (normalized.includes("haiku"))  return 4096;

  return 8192; // default to Sonnet limits
}

function getSafeMaxTokens(model) {
  const modelLimit = getModelTokenLimit(model);
  const configured = Number(process.env.LLM_MAX_TOKENS);

  if (!Number.isFinite(configured) || configured <= 0) {
    return modelLimit;
  }

  return Math.min(Math.floor(configured), modelLimit);
}

/* =========================
   SYSTEM PROMPTS
========================= */

function initialAnalysisSystemPrompt() {
  return `
You are a senior software architect analyzing a real-world codebase.

Your goal is to reconstruct HOW the system works — not just list files.

You MUST think in this order:
1. Identify system layers (frontend, backend, infra, database)
2. Identify responsibilities of each layer
3. Identify how components interact at runtime
4. Reconstruct request/data flow step by step
5. Map to known architectural patterns (MVC, REST, event-driven, etc.)

Rules:
- You MAY infer standard patterns from naming and structure
- DO NOT invent features not supported by the code
- If uncertain, mark it as: "> *Partially inferred from structure*"
- Focus on system behavior and flow, NOT file listing
- Always produce a Mermaid diagram
`;
}

function followUpSystemPrompt() {
  return `
You are a senior backend engineer explaining system behavior in response to a specific question.

Your job is to explain HOW the system works, not just WHAT exists.

Focus on:
- Direct answer to the question
- Request flow and data flow relevant to the question
- Specific file and function references from the provided context
- Code-level callouts where possible

Rules:
- You MAY infer standard architecture patterns
- Do NOT invent unsupported features
- If info is missing: state "Not found in provided context"
- Avoid generic answers — be specific to THIS codebase
- Always include a Mermaid diagram relevant to the question
`;
}

/* =========================
   USER PROMPTS
========================= */

function initialAnalysisUserPrompt({ context, techStackHint = [], keyFileHint = [] }) {
  return `
Context:
${context}

Known Signals:
Tech stack: ${techStackHint.join(", ") || "unknown"}
Key files: ${keyFileHint.join(", ") || "unknown"}

---

Produce a comprehensive Markdown architecture report for this repository.

Structure your output EXACTLY as follows (use these headings):

## Overview
1–2 sentence summary of what this system does.

## Tech Stack
Bullet list of detected technologies and frameworks.

## Architecture Diagram
A Mermaid flowchart showing the main layers and how they connect.
Use this syntax:
\`\`\`mermaid
graph TD
  A[Browser] -->|HTTP| B[API Server]
  B --> C[Service Layer]
  C --> D[(Database)]
\`\`\`

## System Layers
For each layer (Frontend / API / Service / Data / Infra), one paragraph:
- What it does
- Key files responsible
- How it connects to adjacent layers

## Request Lifecycle
Numbered step-by-step walkthrough of a typical request through the full stack.
Be specific: name files, functions, middleware where visible in the code.

## Data Flow
Explain how data moves from input to output. Include any transformations, 
validation steps, or external calls.

## Code Walkthrough
For each key file, explain:
- What it does
- The most important function/export and what it does
- How it connects to the rest of the system

Format each as:
### \`path/to/file.js\`
**Role:** ...
**Key export/function:** \`functionName()\` — ...
**Connects to:** ...

## Architectural Patterns
Which patterns are in use (MVC, REST, layered, event-driven, etc.) and where.

## Notes & Limitations
Any inferences made, missing context, or caveats.

IMPORTANT:
- Be specific to THIS codebase — no generic boilerplate
- Name actual files and functions from the context
- The Mermaid diagram is REQUIRED
`;
}

function userPrompt({ question, context, techStackHint = [], keyFileHint = [] }) {
  return `
Question:
${question}

Context:
${context}

Known Signals:
Tech stack: ${techStackHint.join(", ") || "unknown"}
Key files: ${keyFileHint.join(", ") || "unknown"}

---

Answer the question above with a focused Markdown report.

Structure your output EXACTLY as follows:

## Direct Answer
Answer the question clearly and concisely in 2–4 sentences.

## Architecture Diagram
A Mermaid diagram relevant to the question.
\`\`\`mermaid
graph TD
  ...
\`\`\`

## Step-by-Step Execution Flow
Numbered steps showing exactly what happens in the system for this scenario.
Name actual files and functions from the provided context.

## Data Flow
How data moves through the relevant parts of the system for this question.

## Code Walkthrough
For each file directly relevant to this question:

### \`path/to/file.js\`
**Role:** ...
**Key logic:** explain the specific logic relevant to the question
**Connects to:** ...

## Limitations
What could not be determined from the provided file subset.

IMPORTANT:
- Answer specifically about THIS codebase
- Name actual files, functions, exports from the context
- The Mermaid diagram is REQUIRED
- Do not produce generic architecture descriptions
`;
}

/* =========================
   CLAUDE API CALL
========================= */

async function callClaude({ systemPrompt, userPromptText }) {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing CLAUDE_API_KEY.");
  }

  const safeMaxTokens = getSafeMaxTokens(DEFAULT_MODEL);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: safeMaxTokens,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPromptText,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error (${response.status}): ${text.slice(0, 200)}`);
  }

  return response.json();
}

/* =========================
   MAIN FUNCTION
   Returns Markdown string instead of parsed JSON.
   analyzeRepository.js should use result.reportMarkdown directly.
========================= */

export async function runStructuredAnalysisWithLLM({
  question,
  context,
  fallbackResult,
  techStackHint,
  keyFileHint,
  isInitialAnalysis = false,
}) {
  const systemPrompt = isInitialAnalysis
    ? initialAnalysisSystemPrompt()
    : followUpSystemPrompt();

  const userPromptText = isInitialAnalysis
    ? initialAnalysisUserPrompt({ context, techStackHint, keyFileHint })
    : userPrompt({ question, context, techStackHint, keyFileHint });

  const payload = await callClaude({ systemPrompt, userPromptText });

  const rawContent = payload?.content?.[0]?.text || "";

  if (!rawContent) {
    throw new Error("Empty response from Claude.");
  }

  // ── The LLM now returns Markdown directly. No JSON parsing needed. ──
  // We still return the same shape as before so analyzeRepository.js
  // needs minimal changes: just use result.reportMarkdown everywhere.

  // Extract a short overview from the first non-empty paragraph
  const overviewMatch = rawContent.match(/##\s*Overview\s*\n+([\s\S]*?)(?=\n##|\n---|\z)/i);
  const overview = overviewMatch
    ? overviewMatch[1].trim().slice(0, 300)
    : fallbackResult?.overview || "";

  // Extract tech stack bullets if present
  const techStackMatch = rawContent.match(/##\s*Tech Stack\s*\n+([\s\S]*?)(?=\n##|\z)/i);
  const techStackLines = techStackMatch
    ? techStackMatch[1]
        .split("\n")
        .map((l) => l.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean)
    : [];

  return {
    usedLlm: true,
    result: {
      overview,
      techStack: techStackLines.length > 0 ? techStackLines : (fallbackResult?.techStack || []),
      keyFiles: fallbackResult?.keyFiles || [],
      explanation: rawContent,         // full Markdown
      detailedSummary: rawContent,     // full Markdown
      queryAnswer: rawContent,         // full Markdown — render this on the frontend
      reportMarkdown: rawContent,      // ← primary field: full Markdown report
      quality: fallbackResult?.quality || null,
      sampleQuestions: fallbackResult?.sampleQuestions || [],
      notes: [],
    },
    info: {
      provider: "anthropic",
      model: DEFAULT_MODEL,
    },
  };
}