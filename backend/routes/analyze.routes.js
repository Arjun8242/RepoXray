import express from "express";
import {
	analyzeRepositoryController,
	getAnalysisByIdController,
	chatWithAnalysisController,
} from "../controllers/analyze.controller.js";

const router = express.Router();

router.post("/analyze", analyzeRepositoryController);
router.get("/analysis", getAnalysisByIdController);
router.post("/chat", chatWithAnalysisController);

export default router;
