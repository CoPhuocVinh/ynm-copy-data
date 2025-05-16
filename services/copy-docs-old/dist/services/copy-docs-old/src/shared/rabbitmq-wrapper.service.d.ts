import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class RabbitMQWrapperService implements OnModuleInit {
    private readonly configService;
    private readonly logger;
    private connection;
    private channel;
    private initialized;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    initialize(): Promise<void>;
    sendToQueue(queue: string, content: Buffer, options?: any): Promise<boolean>;
    consume(queue: string, callback: (msg: any) => void, options?: any): Promise<string>;
    ack(msg: any, allUpTo?: boolean): void;
    nack(msg: any, allUpTo?: boolean, requeue?: boolean): void;
    close(): Promise<void>;
}
