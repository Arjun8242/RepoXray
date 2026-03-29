const DEFAULT_MODEL = process.env.LLM_MODEL || "claude-sonnet-4-20250514";

function getModelTokenLimit(model) {
  const normalized = String(model || "").toLowerCase();
  if (normalized.includes("claude-sonnet-4") || normalized.includes("sonnet-4")) return 8192;
  if (normalized.includes("sonnet")) return 8192;
  if (normalized.includes("opus"))   return 8192;
  if (normalized.includes("haiku"))  return 4096;
  return 8192;
}

function getSafeMaxTokens(model) {
  const modelLimit = getModelTokenLimit(model);
  const configured = Number(process.env.LLM_MAX_TOKENS);
  if (!Number.isFinite(configured) || configured <= 0) return modelLimit;
  return Math.min(Math.floor(configured), modelLimit);
}

/* =========================
   SYSTEM PROMPTS
========================= */

function initialAnalysisSystemPrompt() {
  return `
You are a senior software architect producing a deep, specific architecture report for a real codebase.

Your goal is to reconstruct HOW the system works — not summarize files.

Think in this order:
1. Identify all system layers (frontend, backend, services, database, infra)
2. Identify the responsibility of each layer and which files own it
3. Reconstruct runtime interactions and request/data flow step by step
4. Map to known patterns (MVC, REST, layered, event-driven, etc.)
5. Identify security, auth, and deployment concerns

DEPTH REQUIREMENT:
- Every section must be specific to THIS codebase — name actual files, functions, field names
- Prefer 200 words of specific detail over 50 words of generic description
- If a section is not applicable (e.g. no Docker found), omit it entirely
- Target output length: 1500–2000 tokens minimum
- Do NOT write placeholder text like "not found" — omit the section instead

DIAGRAM REQUIREMENT:
- Use ASCII box diagrams only — NO Mermaid syntax
- Draw boxes with ┌─┐ └─┘ │ characters
- Connect layers with │ and ▼ arrows
- Include layer names and key files/components inside each box

Rules:
- You MAY infer standard patterns from naming and structure
- DO NOT invent features not supported by the code
- If uncertain, mark it: "> *Partially inferred from structure*"
`;
}

function followUpSystemPrompt() {
  return `
You are a senior backend engineer answering a specific question about a real codebase.

Your job is to explain HOW the system works for this specific question — not just list what exists.

Focus on:
- A direct, specific answer to the question
- Step-by-step execution flow relevant to the question
- Specific file names, function names, and logic from the provided context
- Code-level callouts wherever possible

DEPTH REQUIREMENT:
- Be specific to THIS codebase — name actual files, functions, exports
- Prefer 200 words of specific detail over 50 words of generic description
- Target output length: 800–1200 tokens minimum
- If information is not in the provided context, say "Not found in provided context" — do not guess

DIAGRAM REQUIREMENT:
- Use ASCII box diagrams only — NO Mermaid syntax
- Draw the flow relevant to the question with ┌─┐ └─┘ │ ▼ characters

Rules:
- You MAY infer standard architecture patterns
- Do NOT invent unsupported features
- Avoid generic answers — every sentence should reference THIS codebase
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

Produce a comprehensive Markdown architecture report. Use EXACTLY these sections in this order.
Skip any section that is genuinely not applicable — do not write placeholder text.

## Overview
2–3 sentences. What does this system do, who uses it, and what makes it distinctive?

## Tech Stack
A markdown table with columns: Choice | Why
One row per major technology. Explain WHY this tech was chosen based on what you see in the code.
Example:
| Choice | Why |
|--------|-----|
| React 19 + Vite | Fast HMR, modern bundling |

## High-Level Architecture
Draw an ASCII box diagram showing ALL layers from top to bottom.
Use this exact style:

\`\`\`
┌─────────────────────────────────────┐
│           Frontend Layer            │
│  React SPA — pages, components,     │
│  context, axios API client          │
└─────────────────────────────────────┘
                   │ HTTP REST
                   ▼
┌─────────────────────────────────────┐
│           Backend Layer             │
│  Express.js — routes, controllers,  │
│  middleware, services               │
└─────────────────────────────────────┘
                   │ Mongoose ODM
                   ▼
┌─────────────────────────────────────┐
│           Database Layer            │
│  MongoDB — Users, Workouts,         │
│  Progress collections               │
└─────────────────────────────────────┘
\`\`\`

## System Layers
For each detected layer (Frontend / API / Services / Data / Infra), write one focused paragraph:
- What it does
- Which specific files own it (name them)
- How it connects to the adjacent layer

## Request Lifecycle
Numbered step-by-step walkthrough of a complete request through the system.
Name actual files, functions, and middleware at each step. Minimum 8 steps.

## Data Flow
Explain how data moves from user input to final output.
Cover: validation → transformation → persistence → response.
Name actual files and functions at each stage.

## Authentication Flow
Step-by-step sequence for: registration → email verification → login → protected route access.
Use an ASCII sequence diagram with arrows between Client, Controller, Service, DB.
Example style:
\`\`\`
┌──────────┐  POST /register   ┌──────────────┐
│  Client  │──────────────────▶│ authController│
└──────────┘                   └──────┬───────┘
                                      │ hash password
                                      │ save User
                                      ▼
                               ┌──────────────┐
                               │ emailService  │
                               │ sends OTP     │
                               └──────────────┘
\`\`\`

## Code Walkthrough
For each key file, use this exact format:

### \`path/to/file.js\`
**Role:** what this file does in one sentence
**Key export/function:** \`functionName()\` — what it does and why it matters
**Connects to:** which other files call it or are called by it

## Data Architecture
For each database collection or model, list its fields:
\`\`\`
Users Collection
├── _id
├── email (unique, indexed)
├── passwordHash
└── isVerified (bool)
\`\`\`

## Infrastructure & Deployment
If Docker, CI/CD, environment config, or cloud deployment is detected:
- Container structure and service dependencies
- Environment variables required
- How services communicate

## Security Architecture
List every security layer as numbered lines:
\`\`\`
Layer 1: [name] → [what it protects against]
Layer 2: ...
\`\`\`

## Key Decisions & Trade-offs
A markdown table:
| Decision | Benefit | Trade-off |
|----------|---------|-----------|
One row per major architectural choice. Be specific — name the pattern and its real cost.

## Summary
One paragraph naming the exact architectural pattern
(e.g. "3-tier MVC+Services, containerized, REST API") and what makes this codebase distinctive.

---
IMPORTANT:
- Name actual files and functions from the context — no generic boilerplate
- ASCII diagrams are REQUIRED for High-Level Architecture and Authentication Flow
- Every section must contain specifics from THIS codebase
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

Answer the question with a focused Markdown report. Use EXACTLY these sections.
Skip any section not applicable — never write placeholder text.

## Direct Answer
2–4 sentences answering the question directly and specifically.
Name actual files or functions from the context if relevant.

## Architecture Diagram
An ASCII box diagram relevant to this specific question.
Use ┌─┐ └─┘ │ ▼ characters. Show only the layers/components relevant to the question.
\`\`\`
┌───────────────────────┐
│  Component Name       │
│  file.js              │
└───────────────────────┘
         │
         ▼
\`\`\`

## Step-by-Step Execution Flow
Numbered steps for exactly what happens in the system for this scenario.
Name actual files, functions, and middleware at every step. Minimum 6 steps.

## Data Flow
How data moves through the relevant parts of the system for this question.
Name files and functions at each transformation point.

## Code Walkthrough
For each file directly relevant to the question:

### \`path/to/file.js\`
**Role:** one sentence
**Key logic:** the specific logic relevant to this question
**Connects to:** which files it calls or is called by

## Limitations
What could not be determined from the provided file subset.
Be specific — name which files were missing that would answer the question fully.

---
IMPORTANT:
- Answer specifically about THIS codebase — name actual files, functions, exports
- ASCII diagram is REQUIRED
- Do not produce generic architecture descriptions
- Minimum 800 tokens of output
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
   Returns Markdown directly — no JSON parsing.
   analyzeRepository.js uses result.reportMarkdown as the primary field.
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

  // Extract short overview from ## Overview section
  const overviewMatch = rawContent.match(/##\s*Overview\s*\n+([\s\S]*?)(?=\n##|\n---|\z)/i);
  const overview = overviewMatch
    ? overviewMatch[1].trim().slice(0, 300)
    : fallbackResult?.overview || "";

  // Extract tech stack from ## Tech Stack table if present
  const techStackMatch = rawContent.match(/##\s*Tech Stack\s*\n+([\s\S]*?)(?=\n##|\z)/i);
  const techStackLines = techStackMatch
    ? techStackMatch[1]
        .split("\n")
        .filter((l) => l.startsWith("|") && !l.includes("Choice") && !l.includes("---"))
        .map((l) => l.split("|")[1]?.trim())
        .filter(Boolean)
    : [];

  return {
    usedLlm: true,
    result: {
      overview,
      techStack: techStackLines.length > 0 ? techStackLines : (fallbackResult?.techStack || []),
      keyFiles:        fallbackResult?.keyFiles        || [],
      explanation:     rawContent,
      detailedSummary: rawContent,
      queryAnswer:     rawContent,
      reportMarkdown:  rawContent,   
      quality:         fallbackResult?.quality         || null,
      sampleQuestions: fallbackResult?.sampleQuestions || [],
      notes: [],
    },
    info: {
      provider: "anthropic",
      model: DEFAULT_MODEL,
    },
  };
}