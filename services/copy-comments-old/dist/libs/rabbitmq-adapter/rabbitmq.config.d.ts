import { RabbitMQConfig } from './rabbitmq.interface';
export declare const loadConfig: (envFilePath?: string) => Record<string, any>;
export declare const rabbitMQConfig: (() => RabbitMQConfig) & import("@nestjs/config").ConfigFactoryKeyHost<RabbitMQConfig>;
