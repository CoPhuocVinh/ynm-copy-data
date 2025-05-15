import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  
  await app.listen(port);
  
  logger.log(`Application ${configService.get<string>('app.name')} is running on port ${port}`);

  // Handle graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, gracefully shutting down...`);
      await app.close();
      process.exit(0);
    });
  });
}

bootstrap().catch(err => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
}); 