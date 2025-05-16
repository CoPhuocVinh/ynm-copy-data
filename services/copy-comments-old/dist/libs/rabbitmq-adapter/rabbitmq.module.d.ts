import { DynamicModule } from '@nestjs/common';
import { RabbitMQModuleOptions } from './rabbitmq.interface';
export declare class RabbitMQModule {
    static register(options?: RabbitMQModuleOptions): DynamicModule;
    static registerAsync(options: {
        useFactory: (...args: any[]) => Promise<RabbitMQModuleOptions> | RabbitMQModuleOptions;
        inject?: any[];
    }): DynamicModule;
}
