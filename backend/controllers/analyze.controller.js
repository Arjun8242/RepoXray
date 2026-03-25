import { analyzeRepository } from "../services/analyzer/analyze.service.js";

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

    return res.json(result);
  } catch (error) {
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;

    return res.status(status).json({
      error: error.message || "Failed to analyze repository.",
    });
  }
};
