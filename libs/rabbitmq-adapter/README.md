# NestJS RabbitMQ Adapter

A modular, robust, and highly configurable RabbitMQ adapter for NestJS applications with advanced features.

## Features

- Fully modular architecture with separate managers for different concerns
- Automatic connection handling with exponential backoff reconnection
- Connection and channel recovery
- Consumer auto-recovery after reconnection
- Publisher confirms and message delivery guarantees
- Different acknowledgment modes for flexible message processing
- Advanced configuration options for fine-tuning
- Typed interfaces and comprehensive documentation
- Supports all RabbitMQ features (exchanges, queues, bindings, etc.)

## Architecture

The adapter uses a modular architecture with clear separation of concerns through specialized manager classes. Each manager is responsible for a specific aspect of the RabbitMQ communication:

### Core Architecture

```
                ┌────────────────────────┐
                │    RabbitMQService     │
                │  (Orchestration Layer) │
                └────────────┬───────────┘
                             │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
┌────────▼───────┐  ┌───────▼────────┐  ┌─────▼─────────┐
│  Connection    │  │     Channel    │  │    Topology   │
│    Manager     │  │     Manager    │  │    Manager    │
└────────┬───────┘  └───────┬────────┘  └─────┬─────────┘
         │                  │                  │
         │          ┌───────▼────────┐         │
         │          │   Publisher    │         │
         └────────► │    Manager     │ ◄───────┘
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │    Consumer    │
                    │    Manager     │
                    └────────────────┘
```

### Manager Classes

#### 1. RabbitMQConnectionManager

**Responsibility**: Manages the AMQP connection lifecycle.

- Establishes and maintains connection to RabbitMQ server
- Handles connection failures with automatic reconnection
- Implements exponential backoff reconnection strategy
- Emits connection events (close, error, blocked, unblocked, reconnected)
- Provides connection validation and health checks

**Relationships**:
- Used by RabbitMQService to establish the base connection
- Provides the connection object to ChannelManager

#### 2. RabbitMQChannelManager

**Responsibility**: Manages channel creation and lifecycle.

- Creates and maintains AMQP channels
- Sets channel-level configuration (prefetch count, publisher confirms)
- Handles channel errors and recovery
- Provides channel validation and health checks
- Maintains channel event listeners

**Relationships**:
- Depends on ConnectionManager for the connection instance
- Provides channels to all other managers (Topology, Publisher, Consumer)
- Manages channel lifecycle based on connection state

#### 3. RabbitMQTopologyManager

**Responsibility**: Sets up and maintains RabbitMQ topology components.

- Declares exchanges, queues, and bindings
- Sets up topology based on configuration
- Handles topology recovery after reconnection
- Provides methods for dynamic topology changes

**Relationships**:
- Uses channels from ChannelManager to perform operations
- Configuration is initialized by RabbitMQService
- Topology is set up before consumers are started

#### 4. RabbitMQPublisherManager

**Responsibility**: Handles all aspects of message publishing.

- Publishes messages to exchanges with retry capability
- Handles publisher confirms for delivery guarantees
- Implements error handling and retry logic
- Provides consistent interface for publishing with common options

**Relationships**:
- Uses channels from ChannelManager
- Depends on TopologyManager to ensure exchanges exist
- Used by RabbitMQService for all publishing operations

#### 5. RabbitMQConsumerManager

**Responsibility**: Manages message consumption and processing.

- Starts and manages consumers for queues
- Handles message acknowledgment with different strategies
- Recovers consumers after connection/channel failures
- Manages consumer tags and cancellation

**Relationships**:
- Uses channels from ChannelManager
- Depends on TopologyManager to ensure queues exist
- Used by RabbitMQService for all consuming operations
- Handles acknowledgment for processed messages

### Control Flow

1. RabbitMQService initializes all managers with appropriate configuration
2. ConnectionManager establishes the connection to RabbitMQ
3. ChannelManager creates channels on top of the connection
4. TopologyManager sets up exchanges, queues, and bindings
5. PublisherManager uses channels for message publishing
6. ConsumerManager sets up message consumers
7. On reconnection, this flow is repeated automatically

## Installation

```bash
npm install @your-org/rabbitmq-adapter
```

## Basic Usage

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@your-org/rabbitmq-adapter';

@Module({
  imports: [
    RabbitMQModule.register({
      config: {
        hostname: 'localhost',
        port: 5672,
        username: 'guest',
        password: 'guest',
        // Connection settings
        reconnect: {
          enabled: true,
          maxAttempts: 30
        },
        // Channel settings
        channel: {
          prefetchCount: 10,
          enablePublisherConfirms: true
        },
        // Publisher settings
        publisher: {
          retryFailedPublishes: true,
          maxPublishRetries: 3
        }
      },
      // Topology configuration
      queues: [
        { name: 'my-queue', options: { durable: true } }
      ],
      exchanges: [
        { name: 'my-exchange', type: 'topic', options: { durable: true } }
      ],
      bindings: [
        { queue: 'my-queue', exchange: 'my-exchange', routingKey: 'my.routing.key' }
      ],
      // Consumer configuration
      consumers: [
        { queue: 'my-queue', ackMode: 'post_process' }
      ]
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### Using the Service

```typescript
import { Injectable } from '@nestjs/common';
import { RabbitMQService, AckMode } from '@your-org/rabbitmq-adapter';

@Injectable()
export class AppService {
  constructor(private readonly rabbitmqService: RabbitMQService) {}

  async onModuleInit() {
    // Start consuming messages
    await this.rabbitmqService.consume(
      'my-queue',
      (msg) => {
        if (msg) {
          console.log('Received message:', msg.content.toString());
          // Process message...
          this.rabbitmqService.ack(msg);
        }
      },
      { noAck: false },
      AckMode.POST_PROCESS
    );
  }

  async sendMessage(message: string) {
    // Publish a message
    const success = await this.rabbitmqService.publish(
      'my-exchange',
      'my.routing.key',
      Buffer.from(message),
      { persistent: true }
    );
    
    return success;
  }
}
```

## Advanced Configuration

### Acknowledgment Modes

The adapter supports three acknowledgment modes:

- `AckMode.PRE_PROCESS`: Acknowledge before processing (risks message loss but prevents channel closed errors)
- `AckMode.POST_PROCESS`: Acknowledge after processing (ensures delivery but may have channel errors)
- `AckMode.BEST_EFFORT`: Best effort acknowledgment (prevents errors if channel closes)

### Publisher Confirms

Enable publisher confirms for stronger delivery guarantees:

```typescript
RabbitMQModule.register({
  config: {
    hostname: 'localhost',
    // ... other connection options
    channel: {
      enablePublisherConfirms: true,
    },
    publisher: {
      retryFailedPublishes: true,
      maxPublishRetries: 3,
    }
  }
})
```

### Reconnection Policy

Configure automatic reconnection behavior:

```typescript
RabbitMQModule.register({
  config: {
    hostname: 'localhost',
    // ... other connection options
    reconnect: {
      enabled: true,
      maxAttempts: 30,
      initialTimeout: 1000,
      maxTimeout: 30000,
      backoffFactor: 2
    }
  }
})
```

## License

MIT 