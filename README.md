# YNM Copy Data

A microservice architecture for copying data using RabbitMQ with NestJS.

## Project Structure

```
ynm-copy-data/
├── libs/
│   └── rabbitmq-adapter/     # Reusable RabbitMQ adapter library
│
├── services/
│   ├── copy-docs-real-time/   # Service for real-time document copying
│   ├── copy-comments-real-time/ # Service for real-time comment copying
│   ├── copy-docs-old/         # Service for old document copying
│   └── copy-comments-old/     # Service for old comment copying
```

## Features

- Clean architecture with separation of concerns
- Reusable RabbitMQ adapter library
- Configurable queue and exchange settings
- Graceful handling of connection errors and reconnection
- Proper message acknowledgment

## Prerequisites

- Node.js (v16+)
- Yarn
- RabbitMQ server running

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
yarn install
```

3. Configure RabbitMQ connection in each service's `env.yaml` file

4. Build the project:

```bash
yarn build
```

5. Run a specific service:

```bash
# Start copy-docs-real-time service
cd services/copy-docs-real-time
yarn start
```

## Development

### Running in development mode

```bash
# Start with hot reload
yarn start:dev
```

### Adding new services

1. Create a new directory under `services/`
2. Copy the structure from an existing service
3. Update the configuration in `nest-cli.json`

## Testing

```bash
# Run tests
yarn test

# Run tests with coverage
yarn test:cov
```

## License

This project is licensed under the ISC License. 