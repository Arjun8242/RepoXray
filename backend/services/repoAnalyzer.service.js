import fs from "fs/promises";
import path from "path";
import { getFileFilterConfig, shouldProcessFile } from "./fileFilter.js";
import { processRepositoryChunks } from "./chunkService.js";

const MAX_FILES = 20000;
const MAX_DEPTH = 25;

export async function collectRepositoryFiles(repoPath, options = {}) {

  const config = {
    ...getFileFilterConfig(),
    ...options
  };

  const files = [];
  const errors = [];
  const queue = [{ dir: path.resolve(repoPath), depth: 0 }];

  while (queue.length > 0) {

    const { dir, depth } = queue.shift();

    if (depth > MAX_DEPTH) {
      errors.push({ path: dir, reason: "max_depth_exceeded" });
      continue;
    }

    try {

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {

        const absolutePath = path.join(dir, entry.name);
        const relativePath = path
          .relative(repoPath, absolutePath)
          .replace(/\\/g, "/");

        if (!relativePath || relativePath.startsWith("..")) continue;
        if (entry.isSymbolicLink()) continue;

        // Handle directory
        if (entry.isDirectory()) {
          if (!config.skippedDirectories.has(entry.name)) {
            queue.push({ dir: absolutePath, depth: depth + 1 });
          }
          continue;
        }

        if (!entry.isFile()) continue;

        const stat = await fs.stat(absolutePath);

        const decision = shouldProcessFile(
          relativePath,
          stat.size,
          config
        );

        if (decision.accepted) {
          files.push(relativePath);
        }

        if (files.length >= MAX_FILES) {
          return { files, errors, truncated: true };
        }
      }

    } catch (error) {

      errors.push({
        path: dir,
        reason: "scan_error",
        error: error.message
      });

    }
  }

  return {
    files,
    errors,
    truncated: false
  };
}


export async function analyzeAndChunkRepository({ repoId, repoPath, options = {} }) {

  // Step 1 — Scan repository
  const scanResult = await collectRepositoryFiles(repoPath, options);

  // Step 2 — Chunk the files
  const chunkResult = await processRepositoryChunks({
    repoId,
    repoPath,
    files: scanResult.files,
    options
  });

  return {
    scan: scanResult,
    chunking: chunkResult
  };
}