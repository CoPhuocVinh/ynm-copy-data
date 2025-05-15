import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ConsumerService } from './consumer/consumer.service';
import { ConsumerModule } from './consumer/consumer.module';
import { RabbitMQService } from '@libs/rabbitmq-adapter';

async function bootstrap() {
  const logger = new Logger('ConsumerBootstrap');
  
  try {
    // Create NestJS application with ONLY the consumer module
    logger.log('Starting consumer application...');
    const app = await NestFactory.create(ConsumerModule);
    
    const configService = app.get(ConfigService);
    
    // Wait a moment for RabbitMQ connections to be established
    logger.log('Waiting for RabbitMQ connections to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get the consumer service and manually initialize it
    logger.log('Initializing consumer service...');
    const consumerService = app.get(ConsumerService);
    
    // Get RabbitMQ service to set up additional error handling
    const rabbitmqService = app.get(RabbitMQService);
    
    try {
      // Add direct channel recovery trigger on channel issues
      if (rabbitmqService.channel) {
        rabbitmqService.channel.on('error', async (error) => {
          logger.error(`Channel error detected in main process: ${error.message}`);
          // Trigger channel recovery
          await consumerService.manualRecovery();
        });
        
        rabbitmqService.channel.on('close', async () => {
          logger.warn('Channel close detected in main process');
          // Trigger channel recovery
          await consumerService.manualRecovery();
        });
      }
      
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
    } catch (initError) {
      logger.error(`Failed to initialize consumer: ${initError.message}`);
      await app.close();
      process.exit(1);
    }
  } catch (appError) {
    logger.error(`Failed to start application: ${appError.message}`);
    process.exit(1);
  }
}

bootstrap().catch(err => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
}); 