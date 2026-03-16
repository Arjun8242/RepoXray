import { ChromaClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";

const client = new ChromaClient({
  path: process.env.CHROMA_URL || "http://localhost:8000"
});

const COLLECTION_NAME = "codebase_chunks";

export async function getOrCreateCollection() {
  try {
    return await client.getCollection({
      name: COLLECTION_NAME
    });
  } catch (error) {
    return await client.createCollection({
      name: COLLECTION_NAME,
      embeddingFunction: new DefaultEmbeddingFunction()
    });
  }
}