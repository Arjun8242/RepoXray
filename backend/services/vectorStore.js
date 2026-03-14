import { ChromaClient } from "chromadb";

const client = new ChromaClient();

const COLLECTION_NAME = "codebase_chunks";

export async function getOrCreateCollection() {
  try {
    return await client.getCollection(COLLECTION_NAME);
  } catch (error) {
    return await client.createCollection(COLLECTION_NAME);
  }
}