# RabbitMQ Adapter

A NestJS module for integrating with RabbitMQ, providing a consistent interface for message queuing operations.

## Location

This adapter is part of the core adapters and is located at:
```
libs/core/adapter/rabbitmq-adapter/
```

## Features

- Asynchronous message publishing and consuming
- Automatic connection management
- Configurable queue options
- Message acknowledgment handling
- Error handling and reconnection
- TypeScript support

## Installation

The adapter is available as part of the core libraries. Import it in your module:

```typescript
import { RabbitMQModule } from '@libs/core/adapter/rabbitmq-adapter';
```

## Configuration

Configure the adapter in your module:

```typescript
@Module({
  imports: [
    RabbitMQModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        config: {
          hostname: configService.get('rabbitmq.host'),
          port: configService.get('rabbitmq.port'),
          username: configService.get('rabbitmq.username'),
          password: configService.get('rabbitmq.password'),
          vhost: configService.get('rabbitmq.vhost'),
        },
        queues: [
          {
            name: 'your-queue-name',
            options: {
              durable: true,
              autoDelete: false,
            },
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],
})
export class YourModule {}
```

## Usage

### Publishing Messages

```typescript
@Injectable()
export class YourService {
  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async publishMessage(message: any) {
    await this.rabbitMQService.sendToQueue('your-queue-name', message);
  }
}
```

### Consuming Messages

```typescript
@Injectable()
export class YourService {
  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async startConsumer() {
    await this.rabbitMQService.consume(
      'your-queue-name',
      this.handleMessage.bind(this),
      { noAck: false },
      AckMode.POST_PROCESS
    );
  }

  private async handleMessage(message: any) {
    // Process message
    // Acknowledge or reject based on processing result
  }
}
```

## Message Acknowledgment

The adapter supports different acknowledgment modes:

- `AckMode.PRE_PROCESS`: Acknowledge before processing
- `AckMode.POST_PROCESS`: Acknowledge after successful processing
- `AckMode.MANUAL`: Manual acknowledgment

## Error Handling

The adapter includes built-in error handling:

- Automatic reconnection on connection loss
- Message rejection on processing errors
- Dead letter queue support
- Error logging

## Best Practices

1. Always use proper error handling
2. Configure appropriate queue options
3. Use message acknowledgment appropriately
4. Monitor connection status
5. Handle message processing errors
6. Use appropriate prefetch counts

## Related Components

This adapter is part of the core adapters and works with other core components:

- Entities for message structures
- DTOs for data transfer
- Interfaces for type definitions
- Utils for helper functions

## Contributing

When contributing to this adapter:

1. Follow the core library structure
2. Maintain backward compatibility
3. Add appropriate tests
4. Update documentation
5. Follow TypeScript best practices 