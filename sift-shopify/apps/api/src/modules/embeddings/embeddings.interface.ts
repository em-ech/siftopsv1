export interface EmbeddingsService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

export const EMBEDDINGS_SERVICE = 'EMBEDDINGS_SERVICE';
