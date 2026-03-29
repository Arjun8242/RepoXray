import { randomUUID } from "crypto";
import pool from "../db.js";

let initPromise = null;

async function ensureAnalysisSessionsTable() {
  if (!initPromise) {
    initPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_sessions (
        analysis_id TEXT PRIMARY KEY,
        repo_url TEXT NOT NULL,
        branch TEXT,
        max_files INTEGER,
        debug BOOLEAN NOT NULL DEFAULT FALSE,
        result JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  await initPromise;
}

function toSerializableResult(result) {
  return JSON.stringify(result || {});
}

export async function createSession({ repoUrl, branch, maxFiles, debug, result }) {
  await ensureAnalysisSessionsTable();

  const analysisId = randomUUID();
  const serializedResult = toSerializableResult(result);

  const query = `
    INSERT INTO analysis_sessions (
      analysis_id,
      repo_url,
      branch,
      max_files,
      debug,
      result
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    RETURNING
      analysis_id,
      repo_url,
      branch,
      max_files,
      debug,
      result,
      created_at,
      updated_at
  `;

  const values = [analysisId, repoUrl, branch || null, maxFiles ?? null, !!debug, serializedResult];
  const { rows } = await pool.query(query, values);

  const row = rows[0];
  return {
    analysisId: row.analysis_id,
    repoUrl: row.repo_url,
    branch: row.branch,
    maxFiles: row.max_files,
    debug: row.debug,
    result: row.result,
    createdAt: row.created_at?.getTime?.() || Date.now(),
    updatedAt: row.updated_at?.getTime?.() || Date.now(),
  };
}

export async function getSession(analysisId) {
  await ensureAnalysisSessionsTable();

  const { rows } = await pool.query(
    `
      SELECT
        analysis_id,
        repo_url,
        branch,
        max_files,
        debug,
        result,
        created_at,
        updated_at
      FROM analysis_sessions
      WHERE analysis_id = $1
      LIMIT 1
    `,
    [analysisId],
  );

  if (!rows.length) {
    return null;
  }

  const row = rows[0];
  return {
    analysisId: row.analysis_id,
    repoUrl: row.repo_url,
    branch: row.branch,
    maxFiles: row.max_files,
    debug: row.debug,
    result: row.result,
    createdAt: row.created_at?.getTime?.() || Date.now(),
    updatedAt: row.updated_at?.getTime?.() || Date.now(),
  };
}

export async function updateSessionResult(analysisId, result) {
  await ensureAnalysisSessionsTable();

  const serializedResult = toSerializableResult(result);

  const { rows } = await pool.query(
    `
      UPDATE analysis_sessions
      SET
        result = $2::jsonb,
        updated_at = NOW()
      WHERE analysis_id = $1
      RETURNING
        analysis_id,
        repo_url,
        branch,
        max_files,
        debug,
        result,
        created_at,
        updated_at
    `,
    [analysisId, serializedResult],
  );

  if (!rows.length) {
    return null;
  }

  const row = rows[0];
  return {
    analysisId: row.analysis_id,
    repoUrl: row.repo_url,
    branch: row.branch,
    maxFiles: row.max_files,
    debug: row.debug,
    result: row.result,
    createdAt: row.created_at?.getTime?.() || Date.now(),
    updatedAt: row.updated_at?.getTime?.() || Date.now(),
  };
}
