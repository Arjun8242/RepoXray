import pool from "../db.js";
import { getOrCreateCollection } from "./vectorStore.js";
import { createEmbedding } from "./embeddingService.js";

export async function indexRepositoryChunks(repoId) {

  const collection = await getOrCreateCollection();

  const chunks = await pool.query(
    "SELECT id, content FROM chunks WHERE repo_id = $1",
    [repoId]
  );

  for (const chunk of chunks.rows) {

    const embedding = await createEmbedding(chunk.content);

    await collection.add({
      ids: [String(chunk.id)],
      embeddings: [embedding],
      documents: [chunk.content],
      metadatas: [{ repo_id: repoId }]
    });

  }

  return {
    indexedChunks: chunks.rows.length
  };
}