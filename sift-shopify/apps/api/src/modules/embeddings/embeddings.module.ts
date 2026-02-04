import { Module, Global } from '@nestjs/common';
import { EMBEDDINGS_SERVICE } from './embeddings.interface';
import { LocalEmbeddingsService } from './local-embeddings.service';
import { OpenAIEmbeddingsService } from './openai-embeddings.service';
import { config } from '../../env';

@Global()
@Module({
  providers: [
    {
      provide: EMBEDDINGS_SERVICE,
      useClass: config.USE_EXTERNAL_EMBEDDINGS
        ? OpenAIEmbeddingsService
        : LocalEmbeddingsService,
    },
  ],
  exports: [EMBEDDINGS_SERVICE],
})
export class EmbeddingsModule {}
