import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { EmbeddingsService } from './embeddings.interface';
import { config } from '../../env';

/**
 * OpenAI embeddings service.
 * Uses the text-embedding-3-small model to generate 384-dimensional embeddings.
 */
@Injectable()
export class OpenAIEmbeddingsService implements EmbeddingsService {
  private readonly logger = new Logger(OpenAIEmbeddingsService.name);
  private readonly client: OpenAI;
  private readonly model = 'text-embedding-3-small';
  private readonly dimensions = 384;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  getDimensions(): number {
    return this.dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const normalizedTexts = texts.map(text => this.normalizeText(text));

      const response = await this.client.embeddings.create({
        model: this.model,
        input: normalizedTexts,
        dimensions: this.dimensions,
      });

      return response.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);
    } catch (error) {
      this.logger.error('Failed to generate embeddings from OpenAI', error);
      throw error;
    }
  }

  private normalizeText(text: string): string {
    return text
      .trim()
      .slice(0, 8000) // OpenAI has token limits
      .replace(/\s+/g, ' ');
  }
}
