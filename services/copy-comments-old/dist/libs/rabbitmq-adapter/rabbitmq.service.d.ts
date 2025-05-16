import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { IRabbitMQService, RabbitMQModuleOptions } from './rabbitmq.interface';
export declare enum AckMode {
    PRE_PROCESS = "pre_process",
    POST_PROCESS = "post_process",
    BEST_EFFORT = "best_effort"
}
export declare class RabbitMQService implements IRabbitMQService, OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private _connection;
    private _channel;
    private readonly config;
    private readonly queues;
    private readonly exchanges;
    private readonly bindings;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private reconnectTimeout;
    private isReconnecting;
    private connectionString;
    private consumerTags;
    private consumers;
    private consumerOptions;
    private defaultAckMode;
    private consumerAckModes;
    private _channelId;
    constructor(configService: ConfigService, options?: RabbitMQModuleOptions);
    get connection(): amqplib.Connection;
    get channel(): amqplib.Channel;
    isChannelValid(): boolean;
    ensureChannel(): Promise<boolean>;
    private restoreConsumers;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    connect(): Promise<void>;
    private bindConnectionListeners;
    private handleReconnect;
    createChannel(): Promise<void>;
    private bindChannelListeners;
    private setupInitialTopology;
    assertQueue(queue: string, options?: amqplib.Options.AssertQueue): Promise<void>;
    assertExchange(exchange: string, type: string, options?: amqplib.Options.AssertExchange): Promise<void>;
    bindQueue(queue: string, exchange: string, routingKey: string, options?: any): Promise<void>;
    consume(queue: string, callback: (msg: amqplib.ConsumeMessage | null) => void, options?: amqplib.Options.Consume, ackMode?: AckMode): Promise<string>;
    cancelConsumer(queue: string): Promise<void>;
    publish(exchange: string, routingKey: string, content: Buffer, options?: amqplib.Options.Publish): Promise<boolean>;
    sendToQueue(queue: string, content: Buffer, options?: amqplib.Options.Publish): Promise<boolean>;
    ack(msg: amqplib.ConsumeMessage, allUpTo?: boolean): void;
    nack(msg: amqplib.ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
    setDefaultAckMode(mode: AckMode): void;
    close(): Promise<void>;
}
