const DEFAULT_MODEL = process.env.LLM_MODEL || "claude-3-haiku-20240307";

function getModelTokenLimit(model) {
  const normalized = String(model || "").toLowerCase();

  if (normalized.includes("claude-3-haiku-20240307")) return 4096;
  if (normalized.includes("haiku")) return 4096;
  if (normalized.includes("sonnet")) return 8192;
  if (normalized.includes("opus")) return 8192;

  return 4096;
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
   SYSTEM PROMPTS (UPGRADED)
========================= */

function initialAnalysisSystemPrompt() {
  return `
You are a senior software architect analyzing a real-world codebase.

Your goal is NOT to summarize files.
Your goal is to reconstruct how the system works.

You MUST think in this order:
1. Identify system layers (frontend, backend, infra)
2. Identify responsibilities of each layer
3. Identify how components interact
4. Reconstruct request/data flow
5. Map to known architectural patterns (MVC, REST, etc.)

Rules:
- You MAY infer standard architectural patterns based on naming and structure
- DO NOT invent features not supported by code
- If uncertain, say: "Partially inferred from structure"
- Focus on system behavior, not file listing
`;
}

function followUpSystemPrompt() {
  return `
You are a senior backend engineer explaining system behavior.

Your job is to explain HOW the system works, not just WHAT exists.

Focus on:
- request flow
- data flow
- component interactions

Rules:
- You MAY infer standard architecture patterns
- Do NOT invent unsupported features
- If missing info: "Not found in provided context"
- Avoid generic answers
`;
}

/* =========================
   USER PROMPTS (UPGRADED)
========================= */

function initialAnalysisUserPrompt({ context, techStackHint = [], keyFileHint = [] }) {
  return `
Context:
${context}

Known Signals:
Tech stack: ${techStackHint.join(", ") || "unknown"}
Key files: ${keyFileHint.join(", ") || "unknown"}

Instructions:

Reconstruct the architecture of this system.

Follow these steps STRICTLY:

1. Identify system layers (frontend, backend, services, database)
2. Explain responsibilities of each layer
3. Identify key components (controllers, routes, components, etc.)
4. Reconstruct request lifecycle (step-by-step)
5. Reconstruct data flow between frontend and backend
6. Identify architectural patterns (MVC, REST, layered architecture)
7. Identify external integrations (APIs, DB, services)

IMPORTANT:
- You may use common patterns from similar tech stacks
- Do NOT just list files — explain how system works
- Prefer flow explanations over descriptions

Output STRICTLY in JSON:

{
  "overview": "",
  "techStack": [],
  "keyFiles": [{ "path": "", "role": "" }],
  "explanation": "",
  "executionFlow": "",
  "queryAnswer": "",
  "notes": []
}
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

Instructions:

Answer by reconstructing system behavior.

Include:
1. Direct Answer
2. Step-by-step execution flow
3. Component interactions
4. Data flow
5. Limitations

IMPORTANT:
- Prefer flow explanation over static description
- Use known patterns (MVC, REST, etc.) where applicable

Output STRICTLY in JSON:

{
  "overview": "",
  "techStack": [],
  "keyFiles": [{ "path": "", "role": "" }],
  "explanation": "",
  "executionFlow": "",
  "queryAnswer": "",
  "notes": []
}
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

  const payload = await callClaude({
    systemPrompt,
    userPromptText,
  });

  const rawContent = payload?.content?.[0]?.text || "";

  if (!rawContent) {
    throw new Error("Empty response from Claude.");
  }

  /* =========================
     SAFE JSON PARSING
  ========================= */

  let parsedResult;

  try {
    const jsonMatch =
      rawContent.match(/```json\s*([\s\S]*?)\s*```/) ||
      rawContent.match(/```\s*([\s\S]*?)\s*```/);

    const jsonText = jsonMatch ? jsonMatch[1] : rawContent;

    parsedResult = JSON.parse(jsonText);
  } catch (err) {
    console.warn("JSON parse failed, returning fallback structure");

    parsedResult = {
      overview: "",
      techStack: [],
      keyFiles: [],
      explanation: rawContent,
      executionFlow: "",
      queryAnswer: "",
      notes: ["Response was not valid JSON"],
    };
  }

  return {
    usedLlm: true,
    result: parsedResult,
    info: {
      provider: "anthropic",
      model: DEFAULT_MODEL,
    },
  };
}