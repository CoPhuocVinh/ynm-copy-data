import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ConsumerService } from './consumer/consumer.service';
import { ConsumerModule } from './consumer/consumer.module';

async function bootstrap() {
  const logger = new Logger('ConsumerBootstrap');
  
  // Create NestJS application with ONLY the consumer module
  const app = await NestFactory.create(ConsumerModule);
  
  const configService = app.get(ConfigService);
  
  // Get the consumer service and manually initialize it
  const consumerService = app.get(ConsumerService);
  await consumerService.initialize();
  
  logger.log(`Consumer service ${configService.get<string>('app.name')} is running`);
  logger.log(`Connected to RabbitMQ at ${configService.get<string>('rabbitmq.host')}:${configService.get<number>('rabbitmq.port')}`);
  logger.log(`Listening to queue: ${configService.get<string>('queue.comments.name')}`);

  // Keep the application running
  await app.listen(0); // Listen on a random port to keep the application running
  
  // Handle graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, gracefully shutting down...`);
      await consumerService.shutdown();
      await app.close();
      process.exit(0);
    });
  });
}

bootstrap().catch(err => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
}); 