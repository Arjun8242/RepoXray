import { analyzeRepository } from "../services/analyzer/analyze.service.js";
import {
  createSession,
  getSession,
  updateSessionResult,
} from "../services/analysisStore.service.js";

export const analyzeRepositoryController = async (req, res) => {
  try {
    const { repoUrl, question, branch, maxFiles, debug } = req.body || {};

    if (!repoUrl || typeof repoUrl !== "string") {
      return res.status(400).json({
        error: "repoUrl is required and must be a string.",
      });
    }

    const isInitialAnalysis = !question || typeof question !== "string" || question.trim().length === 0;

    const result = await analyzeRepository({
      repoUrl,
      question: isInitialAnalysis ? "" : question.trim(),
      branch,
      maxFiles,
      debug: !!debug,
      isInitialAnalysis,
    });

    const session = await createSession({
      repoUrl,
      branch,
      maxFiles,
      debug: !!debug,
      result,
    });

    return res.json({
      ...result,
      analysisId: session.analysisId,
      id: session.analysisId,
    });
  } catch (error) {
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;

    return res.status(status).json({
      error: error.message || "Failed to analyze repository.",
    });
  }
};

export const getAnalysisByIdController = async (req, res) => {
  try {
    const analysisId = req.query?.id;

    if (!analysisId || typeof analysisId !== "string") {
      return res.status(400).json({
        error: "Query parameter 'id' is required.",
      });
    }

    const session = await getSession(analysisId);

    if (!session) {
      return res.status(404).json({
        error: `Analysis '${analysisId}' was not found.`,
      });
    }

    return res.json({
      ...session.result,
      analysisId,
      id: analysisId,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Failed to fetch analysis.",
    });
  }
};

export const chatWithAnalysisController = async (req, res) => {
  try {
    const { analysisId, question, debug } = req.body || {};

    if (!analysisId || typeof analysisId !== "string") {
      return res.status(400).json({
        error: "analysisId is required and must be a string.",
      });
    }

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({
        error: "question is required and must be a non-empty string.",
      });
    }

    const session = await getSession(analysisId);

    if (!session) {
      return res.status(404).json({
        error: `Analysis '${analysisId}' was not found.`,
      });
    }

    const followUpResult = await analyzeRepository({
      repoUrl: session.repoUrl,
      question: question.trim(),
      branch: session.branch,
      maxFiles: session.maxFiles,
      debug: typeof debug === "boolean" ? debug : session.debug,
      isInitialAnalysis: false,
    });

    await updateSessionResult(analysisId, followUpResult);

    return res.json({
      analysisId,
      answer:
        followUpResult.queryAnswer ||
        followUpResult.reportMarkdown ||
        followUpResult.explanation ||
        "No response generated.",
      analysis: {
        ...followUpResult,
        analysisId,
        id: analysisId,
      },
    });
  } catch (error) {
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;

    return res.status(status).json({
      error: error.message || "Failed to process chat question.",
    });
  }
};
