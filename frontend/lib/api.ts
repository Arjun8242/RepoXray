import type { AnalyzeRequest, AnalyzeResponse, ChatRequest, ChatResponse } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
const ANALYZE_PATH = "/api/analyze";
const ANALYSIS_PATH = "/api/analysis";
const CHAT_PATH = "/api/chat";

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function joinUrl(base: string, path: string): string {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (!cleanBase) {
    return cleanPath;
  }

  return `${cleanBase}${cleanPath}`;
}

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Server returned an invalid JSON payload.");
  }
}

async function requestJson(endpoint: string, init: RequestInit): Promise<Record<string, unknown>> {
  const firstUrl = joinUrl(API_BASE_URL, endpoint);
  const response = await fetch(firstUrl, init);

  const body = await parseResponse(response);

  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : "Request failed.";
    throw new Error(message);
  }

  return body;
}

export async function analyzeRepository(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  return (await requestJson(ANALYZE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })) as AnalyzeResponse;
}

export async function getAnalysisById(analysisId: string): Promise<Record<string, unknown>> {
  const query = `?id=${encodeURIComponent(analysisId)}`;
  return requestJson(`${ANALYSIS_PATH}${query}`, { method: "GET" });
}

export async function postChatQuestion(payload: ChatRequest): Promise<ChatResponse> {
  return (await requestJson(CHAT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })) as ChatResponse;
}
