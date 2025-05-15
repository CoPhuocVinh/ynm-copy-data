import { Module, Global, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '@libs/rabbitmq-adapter';

// Custom provider for RabbitMQService
const rabbitMQServiceProvider: Provider = {
  provide: RabbitMQService,
  useFactory: async (configService: ConfigService) => {
    // Get the config values with defaults
    const host = configService.get<string>('rabbitmq.host') || 'localhost';
    const port = configService.get<number>('rabbitmq.port') || 5672;
    const username = configService.get<string>('rabbitmq.username') || 'guest';
    const password = configService.get<string>('rabbitmq.password') || 'guest';
    const vhost = configService.get<string>('rabbitmq.vhost') || '/';
    const heartbeat = configService.get<number>('rabbitmq.heartbeat') || 60;
    const frameMax = configService.get<number>('rabbitmq.frameMax') || 0;
    
    const queueName = configService.get<string>('queue.comments.name') || 'comments_queue';
    const durable = configService.get<boolean>('queue.comments.durable') !== false;
    const autoDelete = configService.get<boolean>('queue.comments.autoDelete') === true;
    
    // Create service with options and more resilient settings
    const service = new RabbitMQService(configService, {
      config: {
        hostname: host,
        port: port,
        username: username,
        password: password,
        vhost: vhost,
        heartbeat: heartbeat,
        frameMax: frameMax,
      },
      queues: [
        {
          name: queueName,
          options: {
            durable: durable,
            autoDelete: autoDelete,
          },
        },
      ],
    });
    
    try {
      // Initialize the service (this will connect and create a channel)
      await service.onModuleInit();
      return service;
    } catch (error) {
      console.error('Failed to initialize RabbitMQ service:', error.message);
      
      // Try to reconnect with a delay
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('Retrying RabbitMQ connection...');
      
      try {
        await service.connect();
        await service.createChannel();
        return service;
      } catch (retryError) {
        console.error('Failed to reconnect to RabbitMQ:', retryError.message);
        // Return the service anyway, the consumer will handle reconnection
        return service;
      }
    }
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [rabbitMQServiceProvider],
  exports: [RabbitMQService],
})
export class LibRabbitMQModule {} 