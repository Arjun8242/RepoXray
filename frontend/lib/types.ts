export type QualityCategory = {
  name: string;
  score: number;
};

export type TreeNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  children: TreeNode[];
};

export type FileEntry = {
  path: string;
  content: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type AnalysisModel = {
  analysisId: string;
  quality: {
    score: number;
    outOf: number;
    categories: QualityCategory[];
  };
  paths: string[];
  files: FileEntry[];
  insights: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  reportMarkdown: string;
};

export type AnalyzeRequest = {
  repoUrl: string;
};

export type AnalyzeResponse = {
  analysisId?: string;
  id?: string;
} & Record<string, unknown>;

export type ChatRequest = {
  analysisId: string;
  question: string;
};

export type ChatResponse = {
  answer?: string;
  message?: string;
} & Record<string, unknown>;
