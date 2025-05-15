# Copy Comments Service - Technical Documentation

This document provides technical details about the Copy Comments service, including directory structure, architecture, and how to run the service.

## Directory Structure

```
services/copy-comments-old/
├── src/                       # Source code
│   ├── shared/                # Shared modules and services
│   │   ├── rabbitmq-wrapper.service.ts  # Custom RabbitMQ wrapper
│   │   └── rabbitmq.module.ts           # Shared RabbitMQ module
│   ├── consumer/              # Consumer-related code
│   │   ├── consumer.service.ts # Comment processing logic
│   │   └── consumer.module.ts  # Consumer module definition
│   ├── producer/              # Producer-related code
│   │   ├── producer.service.ts # Message sending logic
│   │   └── producer.module.ts  # Producer module definition
│   ├── command/               # Command-related code (optional)
│   ├── main-consumer.ts       # Entry point for consumer application
│   ├── main-producer.ts       # Entry point for producer application
│   ├── main.ts                # Original combined entry point (legacy)
│   └── app.module.ts          # Original combined module (legacy)
├── env.yaml                   # Environment configuration
├── package.json               # Project dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md                  # General README
```

## Architecture Overview

This service follows a microservice architecture with separate producer and consumer components. Both can be run independently.

### Key Components

1. **RabbitMQ Wrapper Service (`src/shared/rabbitmq-wrapper.service.ts`)**
   - Custom wrapper around the amqplib library
   - Manages connection to RabbitMQ
   - Provides methods for sending and receiving messages
   - Handles reconnection and error scenarios

2. **Consumer Service (`src/consumer/consumer.service.ts`)**
   - Listens for messages on the configured queue
   - Processes comment copy requests
   - Manages acknowledgements and failure handling
   - Maintains processing statistics

3. **Producer Service (`src/producer/producer.service.ts`)**
   - Sends comment copy requests to RabbitMQ
   - Generates sample data for testing
   - Handles message formatting and delivery confirmation

### Message Flow

1. Producer creates a message with a unique ID and sends it to the queue
2. RabbitMQ stores the message until a consumer is ready to process it
3. Consumer receives the message and attempts to process it
4. If processing succeeds, the message is acknowledged and removed from the queue
5. If processing fails, the message is nacked (negative acknowledgement) and can be requeued

## Service Configuration

Configuration is stored in `env.yaml` and includes:

- RabbitMQ connection details
- Queue configuration
- Application settings

Example configuration:

```yaml
app:
  name: 'copy-comments-service'
  port: 3002

rabbitmq:
  host: 'localhost'
  port: 5672
  username: 'guest'
  password: 'guest'
  vhost: '/'
  heartbeat: 30
  frameMax: 0

queue:
  comments:
    name: 'data_copy_queue'
    durable: true
    autoDelete: false
```

## Running the Service

### Prerequisites

- Node.js v14+
- Yarn package manager
- RabbitMQ server running

### Running the Consumer

The consumer listens for messages and processes them:

```bash
# Development mode
yarn dev:consumer

# Production mode (after building)
yarn build
yarn start:consumer
```

### Running the Producer

The producer sends messages to the queue every 10 seconds:

```bash
# Development mode
yarn dev:producer

# Production mode (after building)
yarn build
yarn start:producer
```

### Building the Service

To build the service for production:

```bash
yarn build
```

This will generate compiled JavaScript files in the `dist/` directory.

## Implementation Details

### Message Format

Messages follow this format:

```typescript
interface CommentCopyPayload {
  id: string;           // Unique message ID (UUID)
  commentId: string;    // ID of comment to copy
  postId?: string;      // Optional post association
  shardId?: number;     // Optional database shard
  source: string;       // Source system
  destination: string;  // Destination system
  timestamp: number;    // Message creation time
  metadata?: Record<string, any>; // Additional metadata
}
```

### Error Handling

The system implements several error handling mechanisms:

1. **Connection Errors**: The RabbitMQ wrapper automatically attempts reconnection
2. **Processing Errors**: Failed messages are requeued for retry
3. **Graceful Shutdown**: Both producer and consumer handle SIGTERM/SIGINT signals

### Simulated Processing

For demonstration purposes, the consumer implements simulated processing:
- Random processing time (500ms to 2s) 
- Random failures (5% chance)
- Statistics tracking of processed/failed messages

## Development Notes

### Independence

The producer and consumer are designed to operate independently:
- Each has its own module and main file
- Each manages its own RabbitMQ connection
- They can be deployed and scaled separately

### Extensibility

To extend the service:
1. Add new message types to the payload interface
2. Extend the consumer service with additional processing logic
3. Update the producer service to generate new message types 