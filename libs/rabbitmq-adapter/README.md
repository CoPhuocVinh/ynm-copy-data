# RabbitMQ Adapter

A NestJS module for integrating with RabbitMQ for message queuing and event-driven communication.

## Features

- Easy integration with NestJS services
- Support for publishers and subscribers
- Automatic reconnection handling
- Message acknowledgement
- Type-safe interfaces
- Flexible configuration options

## Installation

This library is included as part of the monorepo. To use it in your service, you just need to import it.

## Usage

### Importing the module

To use the RabbitMQ adapter in your service, import the `RabbitMQModule` in your module file:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQModule } from '@libs/rabbitmq-adapter';
import appConfig from '../config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfig],
    }),
    RabbitMQModule.register({
      // Optional custom configuration
    }),
  ],
  providers: [YourService],
})
export class YourModule {}
```

### Using the service for consuming messages

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '@libs/rabbitmq-adapter';

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {}

  async initialize() {
    const queueName = this.configService.get<string>('queue.name');
    
    // Set up a consumer
    await this.rabbitMQService.consume(
      queueName,
      async (message) => {
        try {
          // Process the message
          const content = JSON.parse(message.content.toString());
          this.logger.log(`Processing message: ${JSON.stringify(content)}`);
          
          // Your message processing logic here
          
          // Acknowledge the message
          return true; // Return true to acknowledge the message
        } catch (error) {
          this.logger.error(`Error processing message: ${error.message}`);
          return false; // Return false to reject the message
        }
      }
    );
  }
}
```

### Using the service for producing messages

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '@libs/rabbitmq-adapter';

@Injectable()
export class ProducerService {
  private readonly logger = new Logger(ProducerService.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {}

  async sendMessage(data: any) {
    const queueName = this.configService.get<string>('queue.name');
    
    try {
      // Send a message to the queue
      await this.rabbitMQService.sendToQueue(
        queueName,
        data,
        {
          persistent: true, // Make the message persistent
        }
      );
      
      this.logger.log(`Message sent to queue: ${queueName}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw error;
    }
  }
}
```

## Configuration

The RabbitMQ adapter uses the following configuration structure:

```typescript
// In your env.yaml
rabbitmq:
  host: localhost
  port: 5672
  username: guest
  password: guest
  vhost: /
  ssl: false
  connectionTimeout: 5000
  heartbeat: 10
  prefetchCount: 10
```

## API Reference

### RabbitMQModule

- `register(options?: RabbitMQModuleOptions)`: Register the module with optional configuration
- `registerAsync(options)`: Register the module with async configuration

### RabbitMQService

- `connect()`: Connect to RabbitMQ server
- `createChannel()`: Create a new channel
- `sendToQueue(queue, content, options?)`: Send a message to a queue
- `assertQueue(queue, options?)`: Assert a queue exists
- `bindQueue(queue, exchange, pattern)`: Bind a queue to an exchange
- `consume(queue, callback, options?)`: Consume messages from a queue
- `publish(exchange, routingKey, content, options?)`: Publish a message to an exchange
- `createExchange(name, type, options?)`: Create an exchange
- `close()`: Close the connection

## Error Handling and Reconnection

The RabbitMQ adapter handles connection errors automatically and implements a reconnection strategy with exponential backoff. The service will log connection issues and attempt to reconnect when the connection is lost.

## Best Practices

1. Always acknowledge messages after processing
2. Use appropriate queue and exchange options
3. Implement error handling in your message processing logic
4. Set up proper logging
5. Configure message persistence for important messages
6. Implement graceful shutdown of consumers

## Extending the Adapter

If you need to extend the functionality of the RabbitMQ adapter, you can create a custom service that extends the base `RabbitMQService`. 