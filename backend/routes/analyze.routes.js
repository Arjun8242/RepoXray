import express from "express";
import { analyzeRepositoryController } from "../controllers/analyze.controller.js";

const router = express.Router();

router.post("/analyze", analyzeRepositoryController);

export default router;
