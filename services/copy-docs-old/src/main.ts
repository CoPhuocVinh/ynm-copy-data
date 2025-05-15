import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Service mode - start web server
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3003;
  
  await app.listen(port);
  
  logger.log(`Application ${configService.get<string>('app.name')} is running on port ${port}`);
  logger.log(`Connected to RabbitMQ at ${configService.get<string>('rabbitmq.host')}:${configService.get<number>('rabbitmq.port')}`);
  logger.log(`Listening to queue: ${configService.get<string>('queue.docs.name')}`);

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