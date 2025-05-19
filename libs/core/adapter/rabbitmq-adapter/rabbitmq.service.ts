import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsumeMessage, Options } from 'amqplib';
import {
  AckMode,
  IRabbitMQService,
  RabbitMQBindingConfig,
  RabbitMQConfig,
  RabbitMQConsumerConfig,
  RabbitMQExchangeConfig,
  RabbitMQModuleOptions,
  RabbitMQQueueConfig
} from './interfaces';
import {
  RabbitMQChannelManager,
  RabbitMQConnectionManager,
  RabbitMQConsumerManager,
  RabbitMQPublisherManager,
  RabbitMQTopologyManager
} from './managers';

@Injectable()
export class RabbitMQService implements IRabbitMQService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private readonly connectionManager: RabbitMQConnectionManager;
  private readonly channelManager: RabbitMQChannelManager;
  private readonly topologyManager: RabbitMQTopologyManager;
  private readonly consumerManager: RabbitMQConsumerManager;
  private readonly publisherManager: RabbitMQPublisherManager;

  constructor(
    private readonly configService: ConfigService,
    options?: RabbitMQModuleOptions,
  ) {
    const config = options?.config || this.configService.get<RabbitMQConfig>('rabbitmq');
    
    if (!config) {
      throw new Error('RabbitMQ configuration is missing');
    }
    
    // Initialize managers
    this.connectionManager = new RabbitMQConnectionManager(config);
    this.channelManager = new RabbitMQChannelManager(config.channel);
    this.topologyManager = new RabbitMQTopologyManager(
      options?.queues || [],
      options?.exchanges || [],
      options?.bindings || []
    );
    this.consumerManager = new RabbitMQConsumerManager(
      options?.queues || [],
      options?.consumers || []
    );
    this.publisherManager = new RabbitMQPublisherManager(config.publisher);
    
    // Setup connection event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle connection events
    this.connectionManager.onConnectionEvent('reconnected', async () => {
      try {
        const channel = await this.channelManager.createChannel(this.connection);
        this.publisherManager.setChannel(channel);
        await this.topologyManager.setupInitialTopology(channel);
        await this.consumerManager.restoreConsumers(channel);
      } catch (error) {
        this.logger.error(`Failed to handle reconnection: ${error.message}`);
      }
    });
  }

  get connection() {
    return this.connectionManager.connection;
  }

  get channel() {
    return this.channelManager.channel;
  }

  async onModuleInit() {
    await this.initialize();
  }

  async onModuleDestroy() {
    await this.close();
  }

  async initialize(): Promise<void> {
    try {
      await this.connectionManager.initialize();
      const channel = await this.channelManager.createChannel(this.connection);
      this.publisherManager.setChannel(channel);
      await this.topologyManager.setupInitialTopology(channel);
      this.logger.log('RabbitMQ service successfully initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize RabbitMQ service: ${error.message}`);
      throw error;
    }
  }

  async connect(): Promise<void> {
    await this.connectionManager.connect();
  }

  async createChannel(): Promise<void> {
    const channel = await this.channelManager.createChannel(this.connection);
    this.publisherManager.setChannel(channel);
  }

  isChannelValid(): boolean {
    return this.channelManager.isChannelValid();
  }

  async ensureChannel(): Promise<boolean> {
    try {
      if (!this.isChannelValid()) {
        const channel = await this.channelManager.createChannel(this.connection);
        this.publisherManager.setChannel(channel);
        await this.consumerManager.restoreConsumers(channel);
        return true;
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to ensure channel: ${error.message}`);
      return false;
    }
  }

  async assertQueue(queue: string, options?: Options.AssertQueue): Promise<void> {
    const channel = await this.channelManager.ensureChannel(this.connection);
    await this.topologyManager.assertQueue(channel, queue, options);
  }

  async assertExchange(exchange: string, type: string, options?: Options.AssertExchange): Promise<void> {
    const channel = await this.channelManager.ensureChannel(this.connection);
    await this.topologyManager.assertExchange(channel, exchange, type, options);
  }

  async bindQueue(queue: string, exchange: string, routingKey: string, options?: any): Promise<void> {
    const channel = await this.channelManager.ensureChannel(this.connection);
    await this.topologyManager.bindQueue(channel, queue, exchange, routingKey, options);
  }

  async consume(
    queue: string,
    callback: (msg: ConsumeMessage | null) => void,
    options?: Options.Consume,
    ackMode: AckMode = AckMode.BEST_EFFORT,
  ): Promise<string> {
    const channel = await this.channelManager.ensureChannel(this.connection);
    return this.consumerManager.consume(channel, queue, callback, options, ackMode);
  }

  async cancelConsumer(queue: string): Promise<void> {
    if (this.isChannelValid()) {
      await this.consumerManager.cancelConsumer(this.channel, queue);
    }
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Options.Publish,
  ): Promise<boolean> {
    await this.ensureChannel();
    const result = await this.publisherManager.publish(exchange, routingKey, content, options);
    return result.success;
  }

  async sendToQueue(
    queue: string,
    content: Buffer,
    options?: Options.Publish,
  ): Promise<boolean> {
    await this.ensureChannel();
    const result = await this.publisherManager.sendToQueue(queue, content, options);
    return result.success;
  }

  ack(msg: ConsumeMessage, allUpTo = false): void {
    if (this.isChannelValid()) {
      this.consumerManager.ack(this.channel, msg, allUpTo);
    }
  }

  nack(msg: ConsumeMessage, allUpTo = false, requeue = true): void {
    if (this.isChannelValid()) {
      this.consumerManager.nack(this.channel, msg, allUpTo, requeue);
    }
  }

  setDefaultAckMode(mode: AckMode): void {
    this.consumerManager.setDefaultAckMode(mode);
  }

  async close(): Promise<void> {
    try {
      if (this.channelManager.isChannelValid()) {
        await this.channelManager.closeChannel();
      }
      
      if (this.connectionManager.isConnected()) {
        await this.connectionManager.close();
      }
      
      this.logger.log('RabbitMQ connections closed');
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ connections: ${error.message}`);
    }
  }
} 