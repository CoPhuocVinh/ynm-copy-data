import { Channel, Connection, ConsumeMessage, Options } from 'amqplib';
export interface RabbitMQConfig {
    hostname: string;
    port: number;
    username: string;
    password: string;
    vhost?: string;
    heartbeat?: number;
    frameMax?: number;
}
export interface RabbitMQQueueConfig {
    name: string;
    options?: Options.AssertQueue;
    prefetchCount?: number;
}
export interface RabbitMQExchangeConfig {
    name: string;
    type: 'direct' | 'topic' | 'fanout' | 'headers';
    options?: Options.AssertExchange;
}
export interface RabbitMQBindingConfig {
    queue: string;
    exchange: string;
    routingKey: string;
    options?: any;
}
export interface RabbitMQModuleOptions {
    config: RabbitMQConfig;
    queues?: RabbitMQQueueConfig[];
    exchanges?: RabbitMQExchangeConfig[];
    bindings?: RabbitMQBindingConfig[];
}
export interface IRabbitMQService {
    connection: Connection;
    channel: Channel;
    connect(): Promise<void>;
    createChannel(): Promise<void>;
    assertQueue(queue: string, options?: Options.AssertQueue): Promise<void>;
    assertExchange(exchange: string, type: string, options?: Options.AssertExchange): Promise<void>;
    bindQueue(queue: string, exchange: string, routingKey: string, options?: any): Promise<void>;
    consume(queue: string, callback: (msg: ConsumeMessage | null) => void, options?: Options.Consume): Promise<string>;
    publish(exchange: string, routingKey: string, content: Buffer, options?: Options.Publish): Promise<boolean>;
    sendToQueue(queue: string, content: Buffer, options?: Options.Publish): Promise<boolean>;
    ack(msg: ConsumeMessage, allUpTo?: boolean): void;
    nack(msg: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
    close(): Promise<void>;
}
