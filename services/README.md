# Services

This directory contains all the microservices of the YNM Copy Data project.

## Current Services

- `copy-comments-old`: Service for copying comments from old system

## Adding a New Service

To add a new service to the project, follow these steps:

1. **Create a new service directory**:
   ```bash
   mkdir -p services/your-service-name/src
   ```

2. **Copy the basic structure**:
   - Copy the basic structure from an existing service (e.g., copy-comments-old)
   - Make sure to include:
     - package.json (update the name and description)
     - tsconfig.json
     - env.yaml (configure environment variables)
     - src/ directory with appropriate structure

3. **Set up the module structure**:
   ```
   services/your-service-name/
   ├── package.json
   ├── tsconfig.json
   ├── env.yaml
   ├── README.md
   └── src/
       ├── main-consumer.ts     # If your service has a consumer
       ├── main-producer.ts     # If your service has a producer
       ├── consumer/            # Consumer implementation
       │   ├── consumer.module.ts
       │   └── consumer.service.ts
       ├── producer/            # Producer implementation
       │   ├── producer.module.ts
       │   └── producer.service.ts
       └── shared/              # Shared components
           ├── constants/
           ├── interfaces/
           └── types/
   ```

4. **Update the project configuration**:
   - Add your service to `nest-cli.json` in the root directory:
   ```json
   "your-service-name": {
     "type": "application",
     "root": "services/your-service-name",
     "entryFile": "main-consumer", // or main-producer
     "sourceRoot": "services/your-service-name/src",
     "compilerOptions": {
       "tsConfigPath": "services/your-service-name/tsconfig.json"
     }
   }
   ```

5. **Install dependencies**:
   ```bash
   cd services/your-service-name
   yarn install
   ```

6. **Implement your service logic**:
   - Use the RabbitMQ adapter from libs/rabbitmq-adapter
   - Follow the consumer/producer pattern as needed
   - Implement your business logic in the service

7. **Configure environment variables**:
   - Update env.yaml with your service-specific configuration

8. **Build and test your service**:
   ```bash
   # From the root directory
   yarn build
   
   # Or from your service directory
   cd services/your-service-name
   yarn build
   yarn start
   ```

## Service Architecture

Each service should follow these principles:

1. **Separation of concerns**: Split consumer and producer functionality
2. **Configuration**: Use env.yaml for environment configuration
3. **Error handling**: Implement proper error handling and reconnection logic
4. **Logging**: Use NestJS Logger for consistent logging
5. **Graceful shutdown**: Handle shutdown signals properly

## Running a Service

To run a service in development mode:
```bash
cd services/your-service-name
yarn start:dev
```

To run a service in production mode:
```bash
cd services/your-service-name
yarn start
``` 