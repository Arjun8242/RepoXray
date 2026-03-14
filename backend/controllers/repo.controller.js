import pool from '../db.js';
import { processRepositoryChunks } from '../services/chunkService.js';
import { analyzeAndChunkRepository } from '../services/repoAnalyzer.service.js';
import { indexRepositoryChunks } from '../services/indexChunk.service.js';

export const createRepository = async(req, res) => {
    try {
        const { repo_url } = req.body;
        const result = await pool.query(
            'INSERT INTO repositories (repo_url) VALUES ($1) RETURNING *',
            [repo_url]
        );
        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error creating repository:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const chunkRepositoryCode = async (req, res) => {
    try {
        const { repoId, repoPath, files } = req.body;

        if (!repoId || !repoPath || !Array.isArray(files)) {
            return res.status(400).json({
                error: 'repoId, repoPath, and files[] are required'
            });
        }

        const repoCheck = await pool.query(
            'SELECT id FROM repositories WHERE id = $1',
            [repoId]
        );

        if (repoCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        const result = await processRepositoryChunks({
            repoId,
            repoPath,
            files
        });

        return res.json({
            message: 'Chunking completed',
            summary: result
        });
    } catch (error) {
        console.error('Error chunking repository code:', error);
        return res.status(500).json({ error: 'Chunk processing failed' });
    }
};

export const analyzeAndChunkRepositoryCode = async (req, res) => {
    try {
        const { repoId, repoPath } = req.body;

        if (!repoId || !repoPath) {
            return res.status(400).json({
                error: 'repoId and repoPath are required'
            });
        }

        const repoCheck = await pool.query(
            'SELECT id FROM repositories WHERE id = $1',
            [repoId]
        );

        if (repoCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        const result = await analyzeAndChunkRepository({
            repoId,
            repoPath
        });

        return res.json({
            message: 'Analyze + chunking completed',
            summary: result
        });
    } catch (error) {
        console.error('Error analyzing/chunking repository code:', error);
        return res.status(500).json({ error: 'Analyze + chunk processing failed' });
    }
};

export const embedRepositoryChunks = async (req, res) => {
    try {
        const { repoId } = req.body;

        if (!repoId) {
            return res.status(400).json({
                error: 'repoId is required'
            });
        }

        const repoCheck = await pool.query(
            'SELECT id FROM repositories WHERE id = $1',
            [repoId]
        );

        if (repoCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        const result = await indexRepositoryChunks(repoId);

        return res.json({
            message: 'Embedding completed',
            summary: result
        });
    } catch (error) {
        console.error('Error embedding repository chunks:', error);
        return res.status(500).json({ error: 'Embedding processing failed' });
    }
};