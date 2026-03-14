import path from "path";
import pool from "../db.js";
import { shouldProcessFile } from "./fileFilter.js";
import { readSourceFile } from "../utils/fileReader.js";

const CHUNK_SIZE = 400;
const OVERLAP = 30;

export async function processRepositoryChunks({ repoId, repoPath, files }) {

  if (!repoId || !repoPath || !Array.isArray(files)) {
    throw new Error("repoId, repoPath and files are required");
  }

  const results = {
    totalFiles: files.length,
    processedFiles: 0,
    skippedFiles: 0,
    chunksCreated: 0,
    errors: []
  };

  const chunkRows = [];

  for (const file of files) {

    const relativePath = file.replace(/\\/g, "/");
    const absolutePath = path.resolve(repoPath, relativePath);

    try {

      // Read file
      const readResult = await readSourceFile(absolutePath);

      if (readResult.skipped) {
        results.skippedFiles++;
        continue;
      }

      // Filter file
      const decision = shouldProcessFile(relativePath, readResult.sizeBytes);

      if (!decision.accepted) {
        results.skippedFiles++;
        continue;
      }

      // Create chunks
      const chunks = chunkSourceCode({
        repoId,
        filePath: relativePath,
        content: readResult.content
      });

      if (chunks.length === 0) {
        results.skippedFiles++;
        continue;
      }

      chunkRows.push(...chunks);
      results.processedFiles++;

    } catch (error) {

      results.skippedFiles++;
      results.errors.push({
        filePath: relativePath,
        reason: "processing_error",
        error: error.message
      });

    }
  }

  if (chunkRows.length > 0) {
    await insertChunks(chunkRows);
  }

  results.chunksCreated = chunkRows.length;

  return results;
}


export function chunkSourceCode({ repoId, filePath, content }) {

  const lines = content.split("\n");
  const chunks = [];

  let start = 0;
  let index = 1;

  while (start < lines.length) {

  const end = Math.min(start + CHUNK_SIZE, lines.length);

  const chunkText = lines.slice(start, end).join("\n").trim();

  if (chunkText) {

    chunks.push({
      repo_id: repoId,
      file_path: filePath,
      chunk_index: index,
      start_line: start + 1,
      end_line: end,
      content: chunkText
    });

    index++;
  }

  if (end >= lines.length) {
    break;   // 🔴 prevents infinite loop
  }

  start = end - OVERLAP;
}

  return chunks;
}


async function insertChunks(chunks) {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    const query = `
      INSERT INTO chunks 
      (repo_id, file_path, chunk_index, start_line, end_line, content)
      VALUES ($1,$2,$3,$4,$5,$6)
    `;

    for (const chunk of chunks) {

      await client.query(query, [
        chunk.repo_id,
        chunk.file_path,
        chunk.chunk_index,
        chunk.start_line,
        chunk.end_line,
        chunk.content
      ]);

    }

    await client.query("COMMIT");

  } catch (err) {

    await client.query("ROLLBACK");
    throw err;

  } finally {

    client.release();

  }
}