import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { config } from './env';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    rawBody: true,
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: [config.FRONTEND_URL, 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Start server
  const port = config.PORT;
  await app.listen(port);

  logger.log(`Application running on port ${port}`);
  logger.log(`Environment: ${config.NODE_ENV}`);
  logger.log(`Demo mode: ${config.DEMO_MODE}`);
  logger.log(`External embeddings: ${config.USE_EXTERNAL_EMBEDDINGS}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
