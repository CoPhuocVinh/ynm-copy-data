# Shared Libraries

This directory contains shared libraries and utilities used across the application.

## Directory Structure

```
libs/
├── core/                    # Core functionality and shared components
│   ├── adapter/            # External service adapters
│   │   └── rabbitmq-adapter/  # RabbitMQ integration
│   ├── entities/           # Core domain entities
│   ├── dtos/              # Data Transfer Objects
│   ├── repositories/      # Data access layer
│   ├── constants/         # Application constants
│   ├── enums/            # Enumeration types
│   ├── interfaces/       # TypeScript interfaces
│   ├── types/           # Custom type definitions
│   └── utils/           # Utility functions
```

## Core Components

### Adapters
- Located in `core/adapter/`
- Contains adapters for external services and integrations
- Each adapter should be self-contained and follow a consistent interface

### Entities
- Located in `core/entities/`
- Contains core domain entities
- Represents the fundamental business objects of the application

### DTOs
- Located in `core/dtos/`
- Contains Data Transfer Objects
- Used for transferring data between different layers

### Repositories
- Located in `core/repositories/`
- Contains data access interfaces and implementations
- Abstracts database operations

### Constants
- Located in `core/constants/`
- Contains application-wide constants
- Centralizes configuration values

### Enums
- Located in `core/enums/`
- Contains enumeration types
- Defines fixed sets of values

### Interfaces
- Located in `core/interfaces/`
- Contains TypeScript interfaces
- Defines contracts for classes and objects

### Types
- Located in `core/types/`
- Contains custom type definitions
- Improves type safety

### Utils
- Located in `core/utils/`
- Contains utility functions
- Provides reusable helper methods

## Adding New Libraries

When adding a new library:

1. Determine the appropriate category in the core directory
2. Create a new directory with a descriptive name
3. Include necessary files:
   - `index.ts` for exports
   - `README.md` with documentation
   - Unit tests
   - Type definitions

## Best Practices

1. Keep libraries focused and single-purpose
2. Maintain clear documentation
3. Include unit tests
4. Use TypeScript for type safety
5. Follow consistent naming conventions
6. Keep dependencies minimal
7. Document any external dependencies

## Usage

Import shared libraries in your services:

```typescript
// Example import
import { SomeComponent } from '@libs/core/entities';
```

For detailed documentation on specific components, see their respective README files. 