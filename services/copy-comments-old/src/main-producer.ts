import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ProducerService } from './producer/producer.service';
import { ProducerModule } from './producer/producer.module';

async function bootstrap() {
  const logger = new Logger('ProducerBootstrap');

  // Create NestJS application with ONLY the producer module
  const app = await NestFactory.create(ProducerModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3002;

  // Get the producer service - không cần gọi initialize vì đã được xử lý qua OnModuleInit
  const producerService = app.get(ProducerService);
  // ProducerService sẽ tự động khởi tạo qua onModuleInit, không cần gọi lại ở đây

  // Automatically send messages every 10 seconds
  const autoSendInterval = 10000; // 10 seconds
  const messageCount = 5; // Number of messages to send each time

  logger.log(`Automatic message sending enabled - will send ${messageCount} messages every ${autoSendInterval / 1000} seconds`);

  // Set up the interval for automatic message sending
  const intervalId = setInterval(async () => {
    try {
      logger.log(`Auto-sending ${messageCount} messages...`);
      const ids = await producerService.sendSampleBatchRequests(messageCount);
      logger.log(`Successfully sent ${ids.length} messages. Message IDs: ${ids.join(', ')}`);
    } catch (error) {
      logger.error(`Error in automatic message sending: ${error.message}`);
    }
  }, autoSendInterval);

  // Start the application
  await app.listen(port);

  logger.log(`Producer service ${configService.get<string>('app.name')} is running on port ${port}`);
  logger.log(`Connected to RabbitMQ at ${configService.get<string>('rabbitmq.host')}:${configService.get<number>('rabbitmq.port')}`);
  logger.log(`Automatic message sending is active - sending ${messageCount} messages every ${autoSendInterval / 1000} seconds`);

  // Handle graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, gracefully shutting down...`);
      clearInterval(intervalId);
      // Đảm bảo shutdown ProducerService đúng cách
      await producerService.shutdown();
      await app.close();
      process.exit(0);
    });
  });
}

bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
});
