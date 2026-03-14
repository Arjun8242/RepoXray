import { createRepository, chunkRepositoryCode, analyzeAndChunkRepositoryCode } from "../controllers/repo.controller.js";
import express from 'express';

const router = express.Router();

router.post('/repo', createRepository);
router.post('/repo/chunk', chunkRepositoryCode);
router.post('/repo/chunk/analyze', analyzeAndChunkRepositoryCode);

export default router;