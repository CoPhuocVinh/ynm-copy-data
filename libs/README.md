# Libraries

This directory contains shared libraries that can be used across multiple services in the YNM Copy Data project.

## Current Libraries

- `rabbitmq-adapter`: A NestJS module for integrating with RabbitMQ

## Adding a New Library

To add a new shared library to the project, follow these steps:

1. **Create a new library directory**:
   ```bash
   mkdir -p libs/your-library-name
   ```

2. **Set up the library structure**:
   ```
   libs/your-library-name/
   ├── index.ts            # Main export file
   ├── README.md           # Documentation
   └── src/                # Source code
       ├── interfaces/     # Type definitions and interfaces
       ├── services/       # Service implementations
       └── modules/        # NestJS modules
   ```

3. **Export your library**:
   Create an `index.ts` file in your library root that exports all public components:
   ```typescript
   // libs/your-library-name/index.ts
   export * from './src/interfaces';
   export * from './src/services';
   export * from './src/modules';
   ```

4. **Update tsconfig paths**:
   Make sure your library can be imported using the `@libs/your-library-name` path by updating the root `tsconfig.json`:
   ```json
   "paths": {
     "@libs/your-library-name": ["libs/your-library-name"]
   }
   ```

5. **Document your library**:
   Create a README.md file with usage instructions, API documentation, and examples.

6. **Use your library in services**:
   Import your library in services using the path alias:
   ```typescript
   import { YourService } from '@libs/your-library-name';
   ```

## Library Development Best Practices

1. **Keep libraries focused**: Each library should have a single responsibility
2. **Document thoroughly**: Provide clear documentation and examples
3. **Use proper typing**: Make good use of TypeScript types and interfaces
4. **Consider dependencies**: Minimize external dependencies when possible
5. **Version compatibility**: Ensure your library works with the NestJS version used in the project
6. **Testing**: Write unit tests for your library components 