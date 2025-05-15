import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQModuleOptions } from './rabbitmq.interface';
import { rabbitMQConfig } from './rabbitmq.config';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(rabbitMQConfig),
  ],
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {
  static register(options?: RabbitMQModuleOptions): DynamicModule {
    return {
      module: RabbitMQModule,
      providers: [
        {
          provide: RabbitMQService,
          useFactory: (configService: ConfigService) => {
            return new RabbitMQService(configService, options);
          },
          inject: [ConfigService],
        },
      ],
      exports: [RabbitMQService],
    };
  }

  static registerAsync(options: {
    useFactory: (...args: any[]) => Promise<RabbitMQModuleOptions> | RabbitMQModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const provider: Provider = {
      provide: RabbitMQService,
      useFactory: async (configService: ConfigService, ...args: any[]) => {
        const moduleOptions = await options.useFactory(...args);
        return new RabbitMQService(configService, moduleOptions);
      },
      inject: [ConfigService, ...(options.inject || [])],
    };

    return {
      module: RabbitMQModule,
      providers: [provider],
      exports: [RabbitMQService],
    };
  }
} 