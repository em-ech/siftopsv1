import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { EmbeddingsService } from './embeddings.interface';

/**
 * Local deterministic embeddings service.
 * Generates consistent 384-dimensional embeddings from text using hash-based approach.
 * This is suitable for testing and development without requiring an external API.
 *
 * Note: This produces semantically meaningless embeddings - similar texts won't necessarily
 * have similar embeddings. For production, use an external embeddings API.
 */
@Injectable()
export class LocalEmbeddingsService implements EmbeddingsService {
  private readonly logger = new Logger(LocalEmbeddingsService.name);
  private readonly dimensions = 384;

  getDimensions(): number {
    return this.dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const normalized = this.normalizeText(text);
    const embedding = this.hashToEmbedding(normalized);
    return embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  private hashToEmbedding(text: string): number[] {
    // Use multiple rounds of hashing to generate enough bytes
    // Need 384 dimensions * 2 hex chars = 768 hex chars
    // SHA-256 produces 64 hex chars, so need 12 hashes
    const hashes: string[] = [];
    for (let i = 0; i < 12; i++) {
      const hash = crypto
        .createHash('sha256')
        .update(text + ':' + i)
        .digest('hex');
      hashes.push(hash);
    }

    const combined = hashes.join('');
    const embedding: number[] = [];

    // Convert hex pairs to float values in [-1, 1] range
    for (let i = 0; i < this.dimensions; i++) {
      const hexPair = combined.slice(i * 2, i * 2 + 2);
      const value = parseInt(hexPair, 16) / 127.5 - 1;
      embedding.push(value);
    }

    // L2 normalize the embedding
    return this.normalizeVector(embedding);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      return vector;
    }
    return vector.map(val => val / magnitude);
  }
}
