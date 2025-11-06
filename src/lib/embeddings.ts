import { pipeline } from '@xenova/transformers';

let embeddingModel: any = null;

export async function getEmbeddingModel() {
  if (!embeddingModel) {
    embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: false,
    });
  }
  return embeddingModel;
}

export async function embed(text: string): Promise<Float32Array> {
  try {
    const model = await getEmbeddingModel();
    const output = await model(text, { pooling: 'mean', normalize: true });
    
    // Handle different output formats
    let data: Float32Array;
    if (output && output.data) {
      data = output.data as Float32Array;
    } else if (Array.isArray(output)) {
      data = new Float32Array(output.flat());
    } else if (output instanceof Float32Array) {
      data = output;
    } else {
      // Fallback: convert to array
      const arr = Array.isArray(output) ? output : [output];
      data = new Float32Array(arr);
    }
    
    return data;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Return zero vector as fallback
    return new Float32Array(384); // all-MiniLM-L6-v2 has 384 dimensions
  }
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

