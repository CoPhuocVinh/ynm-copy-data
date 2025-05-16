# Copy Comments Old Service

This service connects to RabbitMQ to copy old comments data. It demonstrates both producing messages to the queue and consuming messages from the queue.

## Directory Structure

```
services/copy-comments-old/
├── src/                       # Source code
│   ├── shared/                # Shared modules and services
│   ├── consumer/              # Consumer-related code
│   ├── producer/              # Producer-related code
│   ├── command/               # Command-related code
│   ├── main-consumer.ts       # Entry point for consumer application
│   └── main-producer.ts       # Entry point for producer application
├── env.yaml                   # Environment configuration
├── package.json               # Project dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

## Configuration

The service is configured via the `env.yaml` file:

```yaml
app:
  name: copy-comments-old
  port: 3002

rabbitmq:
  host: '192.168.1.12'
  port: 5673
  username: 'nguyennp'
  password: 'nguyennpNguyenNP3579'
  vhost: /
  heartbeat: 60
  frameMax: 0

queue:
  comments:
    name: data_copy_queue
    durable: true
    autoDelete: false
```

## Running the Service

You can use npm/yarn scripts to run the service:

```bash
# Development mode
yarn dev:consumer       # Run consumer only
yarn dev:producer       # Run producer only

# Build the service
yarn build              # Build the service
yarn clean              # Remove the dist directory

# Production mode (after building)
yarn start:consumer     # Run consumer only
yarn start:producer     # Run producer only
```

## Architecture Overview

This service follows a microservice architecture with separate producer and consumer components. Both can be run independently.

### Key Components

1. **Consumer Service** - Listens for messages on the configured queue and processes comment copy requests
2. **Producer Service** - Sends comment copy requests to RabbitMQ

### Message Flow

1. Producer creates a message with a unique ID and sends it to the queue
2. RabbitMQ stores the message until a consumer is ready to process it
3. Consumer receives the message and attempts to process it
4. If processing succeeds, the message is acknowledged and removed from the queue
5. If processing fails, the message is nacked (negative acknowledgement) and can be requeued

## Sample Message Format

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "commentId": "comment_123",
  "postId": "post_456",
  "shardId": 3,
  "source": "old_database",
  "destination": "new_database",
  "timestamp": 1621234567890,
  "metadata": {
    "priority": 2,
    "batchId": "batch_1"
  }
}
``` 