import { createRepository, chunkRepositoryCode, analyzeAndChunkRepositoryCode, embedRepositoryChunks } from "../controllers/repo.controller.js";
import express from 'express';

const router = express.Router();

router.post('/repo', createRepository);
router.post('/repo/chunk', chunkRepositoryCode);
router.post('/repo/chunk/analyze', analyzeAndChunkRepositoryCode);
router.post('/repo/chunk/embed', embedRepositoryChunks);

export default router;