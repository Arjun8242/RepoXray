export async function createEmbedding(text) {
  const token = process.env.HUGGING_FACE;

  if (!token) {
    throw new Error("Missing HUGGING_FACE environment variable.");
  }

  const response = await fetch(
    "https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5/pipeline/feature-extraction",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  // Depending on the exact model and input, the response might be a 1D array of floats
  // or a 2D array if batching (even with a single input). We need to return a single 1D embedding array.
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return result[0];
  }
  
  return result;
}