# YNM Copy Data Source Code

This document explains the structure and organization of the YNM Copy Data project source code.

## Project Overview

YNM Copy Data is a microservice-based system for copying data between systems using RabbitMQ for message queuing. The project follows a monorepo structure with:

1. Shared libraries in the `libs/` directory
2. Individual microservices in the `services/` directory

## Directory Structure

```
ynm-copy-data/
├── libs/                   # Shared libraries
│   └── rabbitmq-adapter/   # RabbitMQ integration library
│
├── services/               # Microservices
│   └── copy-comments-old/  # Service for copying comments from old system
│       └── src/            # Source code for the service
│           ├── consumer/   # Consumer implementation
│           ├── producer/   # Producer implementation
│           └── shared/     # Shared code between consumer and producer
```

## Service Structure

Each service follows a similar structure:

```
service/
├── src/
│   ├── main-consumer.ts    # Entry point for consumer
│   ├── main-producer.ts    # Entry point for producer
│   ├── consumer/           # Consumer implementation
│   │   ├── consumer.module.ts
│   │   └── consumer.service.ts
│   ├── producer/           # Producer implementation
│   │   ├── producer.module.ts
│   │   └── producer.service.ts
│   └── shared/             # Shared components
│       ├── constants/      # Constants and enums
│       ├── interfaces/     # TypeScript interfaces
│       └── types/          # TypeScript types
```

## Consumer-Producer Pattern

The services follow a consumer-producer pattern:

1. **Producers** generate and send messages to RabbitMQ queues
2. **Consumers** receive and process messages from RabbitMQ queues

This separation allows for:
- Independent scaling of producers and consumers
- Loose coupling between message production and consumption
- Better error handling and message processing guarantees

## Shared Libraries

### RabbitMQ Adapter

The `libs/rabbitmq-adapter` library provides a consistent interface for working with RabbitMQ:

```typescript
// Producer example
await rabbitMQService.sendToQueue('queue-name', messageData);

// Consumer example
await rabbitMQService.consume('queue-name', async (message) => {
  // Process message
  return true; // Acknowledge the message
});
```

## Running the Code

### Prerequisites

- Node.js (v16+)
- Yarn
- RabbitMQ server

### Starting a Consumer

```bash
cd services/your-service
yarn start:consumer
```

### Starting a Producer

```bash
cd services/your-service
yarn start:producer
```

## Code Conventions

1. **NestJS Modules**: Each component is organized as a NestJS module
2. **Dependency Injection**: Services use NestJS's dependency injection
3. **Configuration**: Configuration is loaded from env.yaml files
4. **Logging**: NestJS Logger is used for consistent logging
5. **Error Handling**: Proper error handling with graceful shutdown

## Important Implementation Details

### Message Processing

Messages are processed in the consumer services. The typical flow is:

1. Message is received from RabbitMQ
2. Message is validated and parsed
3. Business logic is applied
4. Results are stored or forwarded as needed
5. Message is acknowledged (or rejected if processing fails)

### Error Handling

Both consumers and producers implement error handling:

1. **Connection Errors**: Automatic reconnection with exponential backoff
2. **Processing Errors**: Failed messages can be retried or sent to a dead-letter queue
3. **Graceful Shutdown**: Services properly close connections when shutting down

## Adding New Features

1. **New Service**: Create a new directory in `services/` following the existing pattern
2. **New Functionality**: Add to existing services by extending their modules
3. **Shared Code**: Common functionality should be added to the `libs/` directory

## Best Practices

1. Keep services focused on a single responsibility
2. Use TypeScript types for message structures
3. Implement comprehensive logging
4. Handle errors gracefully
5. Test thoroughly with unit and integration tests 