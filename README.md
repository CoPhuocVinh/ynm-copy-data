# YNM Copy Data

A microservice architecture for copying data using RabbitMQ with NestJS.

## Project Structure

```
ynm-copy-data/
├── libs/                   # Shared libraries
│   ├── core/              # Core functionality
│   │   ├── adapter/       # External service adapters
│   │   │   └── rabbitmq-adapter/  # RabbitMQ integration
│   │   ├── entities/      # Core domain entities
│   │   ├── dtos/         # Data Transfer Objects
│   │   ├── repositories/ # Data access layer
│   │   ├── constants/    # Application constants
│   │   ├── enums/       # Enumeration types
│   │   ├── interfaces/  # TypeScript interfaces
│   │   ├── types/      # Custom type definitions
│   │   └── utils/      # Utility functions
│   └── README.md        # Library documentation
│
├── services/               # Microservices
│   ├── README.md           # Services documentation
│   └── copy-comments-old/  # Example service for copying comments
│
├── package.json            # Root package.json for the monorepo
├── lerna.json              # Lerna configuration for monorepo management
├── nest-cli.json           # NestJS CLI configuration
├── tsconfig.json           # TypeScript configuration
├── .eslintrc.js           # ESLint configuration
├── .prettierrc            # Prettier configuration
└── env.yaml                # Environment configuration
```

## Architecture Overview

This project follows a microservice architecture pattern using RabbitMQ for message queuing:

1. **Producer Services**: Send data to RabbitMQ queues
2. **Consumer Services**: Process data from RabbitMQ queues
3. **Shared Libraries**: Common code used across services

Each service is a self-contained NestJS application with its own configuration, but shares common libraries from the `libs/core` directory.

## Prerequisites

- Node.js (v20+)
- Yarn (v1.22.22+)
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
   yarn comments-old:consumer
   
   # In another terminal, run the producer
   yarn comments-old:producer
   ```

## Development

### Code Style and Quality

The project uses ESLint and Prettier for code formatting and quality:

- ESLint rules enforce TypeScript best practices
- Prettier ensures consistent code formatting
- Husky pre-commit hooks run linting and formatting

Key ESLint rules:
- Strict TypeScript checks
- PascalCase for interfaces and types
- camelCase for variables
- UPPER_CASE for enum members
- No explicit any types
- Required explicit return types

### Running in Development Mode

Each service can be run in development mode with hot reloading:

```bash
# Run consumer in dev mode
yarn comments-old:consumer

# Run producer in dev mode
yarn comments-old:producer
```

### Adding New Services

See [services/README.md](services/README.md) for detailed instructions on adding new services.

### Adding New Libraries

See [libs/README.md](libs/README.md) for detailed instructions on adding new shared libraries.

## Project Components

### Core Libraries

The `libs/core` directory contains shared functionality:

- **Adapters**: External service integrations (e.g., RabbitMQ)
- **Entities**: Core domain models
- **DTOs**: Data transfer objects
- **Repositories**: Data access layer
- **Constants**: Application-wide constants
- **Enums**: Enumeration types
- **Interfaces**: TypeScript interfaces
- **Types**: Custom type definitions
- **Utils**: Utility functions

### Services

Each service in the `services` directory is a standalone NestJS application that can be run independently. Services typically have both producer and consumer components.

## Configuration

### Environment Variables

Each service has its own `env.yaml` file with configuration settings:

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

The services are designed to be deployed as individual containers or processes:

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