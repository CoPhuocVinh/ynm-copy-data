# YNM Copy Data

A microservice architecture for copying data using RabbitMQ with NestJS.

## Project Structure

```
ynm-copy-data/
├── libs/                   # Shared libraries
│   ├── README.md           # Library documentation
│   └── rabbitmq-adapter/   # RabbitMQ integration library
│
├── services/               # Microservices
│   ├── README.md           # Services documentation
│   └── copy-comments-old/  # Example service for copying comments
│
├── package.json            # Root package.json for the monorepo
├── lerna.json              # Lerna configuration for monorepo management
├── nest-cli.json           # NestJS CLI configuration
├── tsconfig.json           # TypeScript configuration
└── env.yaml                # Environment configuration
```

## Architecture Overview

This project follows a microservice architecture pattern using RabbitMQ for message queuing:

1. **Producer Services**: Send data to RabbitMQ queues
2. **Consumer Services**: Process data from RabbitMQ queues
3. **Shared Libraries**: Common code used across services

Each service is a self-contained NestJS application with its own configuration, but shares common libraries from the `libs` directory.

## Prerequisites

- Node.js (v16+)
- Yarn
- RabbitMQ server running (can be local or remote)

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/ynm-copy-data.git
   cd ynm-copy-data
   ```

2. **Install dependencies**:
   ```bash
   yarn install
   ```

3. **Configure RabbitMQ**:
   - Update the RabbitMQ connection settings in `env.yaml`
   - Configure service-specific settings in each service's `env.yaml`

4. **Build the project**:
   ```bash
   yarn build
   ```

5. **Run a service**:
   ```bash
   # Run the consumer
   cd services/copy-comments-old
   yarn start:consumer
   
   # In another terminal, run the producer
   cd services/copy-comments-old
   yarn start:producer
   ```

## Development

### Running in Development Mode

Each service can be run in development mode with hot reloading:

```bash
cd services/copy-comments-old
yarn start:dev:consumer  # For consumer
yarn start:dev:producer  # For producer
```

### Adding New Services

See [services/README.md](services/README.md) for detailed instructions on adding new services.

### Adding New Libraries

See [libs/README.md](libs/README.md) for detailed instructions on adding new shared libraries.

## Project Components

### RabbitMQ Adapter

The RabbitMQ adapter is a shared library that provides a consistent interface for interacting with RabbitMQ. See [libs/rabbitmq-adapter/README.md](libs/rabbitmq-adapter/README.md) for usage instructions.

### Services

Each service in the `services` directory is a standalone NestJS application that can be run independently. Services typically have both producer and consumer components.

## Configuration

### Environment Variables

Each service has its own `env.yaml` file with configuration settings. This includes:

- RabbitMQ connection settings
- Service-specific settings
- Queue and exchange configurations

Example:
```yaml
app:
  name: copy-comments-old
  port: 3002

rabbitmq:
  host: localhost
  port: 5672
  username: guest
  password: guest
  vhost: /

queue:
  comments:
    name: comments-queue
    options:
      durable: true
```

## Testing

```bash
# Run tests for all packages
yarn test

# Run tests for a specific package
cd services/copy-comments-old
yarn test
```

## Deployment

The services are designed to be deployed as individual containers or processes. Each service can be built separately:

```bash
# Build a specific service
cd services/copy-comments-old
yarn build
```

### Docker

You can containerize each service using Docker:

```bash
# Build a Docker image for a service
docker build -t ynm-copy-data/copy-comments-old -f services/copy-comments-old/Dockerfile .
```

## Troubleshooting

### RabbitMQ Connection Issues

If you experience connection issues with RabbitMQ:

1. Check if RabbitMQ is running: `rabbitmqctl status`
2. Verify connection settings in `env.yaml`
3. Check if the virtual host exists: `rabbitmqctl list_vhosts`
4. Ensure the user has proper permissions: `rabbitmqctl list_permissions`

### Service Startup Issues

If a service fails to start:

1. Check the console output for error messages
2. Verify that all dependencies are installed: `yarn install`
3. Ensure the service is built: `yarn build`
4. Check if required environment variables are set in `env.yaml`

## License

This project is licensed under the ISC License. 