import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { 
  IRabbitMQService, 
  RabbitMQBindingConfig, 
  RabbitMQConfig, 
  RabbitMQExchangeConfig, 
  RabbitMQModuleOptions, 
  RabbitMQQueueConfig 
} from './rabbitmq.interface';

@Injectable()
export class RabbitMQService implements IRabbitMQService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private _connection: any;
  private _channel: amqplib.Channel;
  private readonly config: RabbitMQConfig;
  private readonly queues: RabbitMQQueueConfig[] = [];
  private readonly exchanges: RabbitMQExchangeConfig[] = [];
  private readonly bindings: RabbitMQBindingConfig[] = [];
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeout = 1000;

  constructor(
    private readonly configService: ConfigService,
    options?: RabbitMQModuleOptions,
  ) {
    this.config = options?.config || this.configService.get<RabbitMQConfig>('rabbitmq');
    if (options?.queues) this.queues = options.queues;
    if (options?.exchanges) this.exchanges = options.exchanges;
    if (options?.bindings) this.bindings = options.bindings;
  }

  get connection(): any {
    return this._connection;
  }

  get channel(): amqplib.Channel {
    return this._channel;
  }

  async onModuleInit() {
    await this.connect();
    await this.createChannel();
    await this.setupInitialTopology();
  }

  async onModuleDestroy() {
    await this.close();
  }

  async connect(): Promise<void> {
    try {
      const { hostname, port, username, password, vhost, heartbeat, frameMax } = this.config;
      
      this.logger.log(`Connecting to RabbitMQ at ${hostname}:${port}`);
      
      this._connection = await amqplib.connect({
        protocol: 'amqp',
        hostname,
        port: port || 5672,
        username,
        password,
        vhost: vhost || '/',
        frameMax: frameMax || 0,
        heartbeat: heartbeat || 0,
      });

      this.reconnectAttempts = 0;
      this.bindConnectionListeners();
      this.logger.log('Successfully connected to RabbitMQ');
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
      await this.handleReconnect();
    }
  }

  private bindConnectionListeners() {
    this._connection.on('error', (err) => {
      this.logger.error(`RabbitMQ connection error: ${err.message}`);
      if (err.message !== 'Connection closing') {
        this.handleReconnect();
      }
    });

    this._connection.on('close', async () => {
      this.logger.warn('RabbitMQ connection closed');
      await this.handleReconnect();
    });
  }

  private async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    this.reconnectAttempts++;
    const timeout = this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1);
    
    this.logger.log(`Attempting to reconnect in ${timeout}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
        await this.createChannel();
        await this.setupInitialTopology();
      } catch (error) {
        this.logger.error(`Error during reconnect: ${error.message}`);
      }
    }, timeout);
  }

  async createChannel(): Promise<void> {
    try {
      this._channel = await this._connection.createChannel();
      this.bindChannelListeners();
      this.logger.log('Successfully created RabbitMQ channel');
    } catch (error) {
      this.logger.error(`Failed to create RabbitMQ channel: ${error.message}`);
      throw error;
    }
  }

  private bindChannelListeners() {
    this._channel.on('error', (error) => {
      this.logger.error(`Channel error: ${error.message}`);
      if (error.message.includes('PRECONDITION_FAILED') || 
          error.message.includes('unknown delivery tag')) {
        this._channel = null;
        this.logger.warn('Channel marked as invalid due to delivery tag error');
      }
    });

    this._channel.on('close', () => {
      this.logger.warn('Channel closed - marking as null');
      this._channel = null;
    });
  }

  private async setupInitialTopology(): Promise<void> {
    try {
      // Setup exchanges
      for (const exchange of this.exchanges) {
        await this.assertExchange(exchange.name, exchange.type, exchange.options);
      }

      // Setup queues
      for (const queue of this.queues) {
        await this.assertQueue(queue.name, queue.options);
      }

      // Setup bindings
      for (const binding of this.bindings) {
        await this.bindQueue(binding.queue, binding.exchange, binding.routingKey, binding.options);
      }

      this.logger.log('Initial RabbitMQ topology setup completed');
    } catch (error) {
      this.logger.error(`Error setting up initial topology: ${error.message}`);
      throw error;
    }
  }

  async assertQueue(queue: string, options?: amqplib.Options.AssertQueue): Promise<void> {
    try {
      this.logger.debug(`Asserting queue: ${queue}`);
      await this._channel.assertQueue(queue, options);
      this.logger.debug(`Queue asserted: ${queue}`);
    } catch (error) {
      this.logger.error(`Failed to assert queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  async assertExchange(exchange: string, type: string, options?: amqplib.Options.AssertExchange): Promise<void> {
    try {
      this.logger.debug(`Asserting exchange: ${exchange} (${type})`);
      await this._channel.assertExchange(exchange, type, options);
      this.logger.debug(`Exchange asserted: ${exchange}`);
    } catch (error) {
      this.logger.error(`Failed to assert exchange ${exchange}: ${error.message}`);
      throw error;
    }
  }

  async bindQueue(queue: string, exchange: string, routingKey: string, options?: any): Promise<void> {
    try {
      this.logger.debug(`Binding queue ${queue} to exchange ${exchange} with routing key ${routingKey}`);
      await this._channel.bindQueue(queue, exchange, routingKey, options);
      this.logger.debug(`Queue ${queue} bound to exchange ${exchange}`);
    } catch (error) {
      this.logger.error(`Failed to bind queue ${queue} to exchange ${exchange}: ${error.message}`);
      throw error;
    }
  }

  async consume(
    queue: string,
    callback: (msg: amqplib.ConsumeMessage | null) => void,
    options?: amqplib.Options.Consume,
  ): Promise<string> {
    try {
      this.logger.debug(`Starting consumer on queue: ${queue}`);
      const { consumerTag } = await this._channel.consume(queue, callback, options);
      this.logger.debug(`Consumer started on queue ${queue} with tag ${consumerTag}`);
      return consumerTag;
    } catch (error) {
      this.logger.error(`Failed to start consumer on queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: amqplib.Options.Publish,
  ): Promise<boolean> {
    try {
      const result = this._channel.publish(exchange, routingKey, content, {
        persistent: true,
        ...options,
      });
      return result;
    } catch (error) {
      this.logger.error(`Failed to publish message to exchange ${exchange}: ${error.message}`);
      throw error;
    }
  }

  async sendToQueue(
    queue: string,
    content: Buffer,
    options?: amqplib.Options.Publish,
  ): Promise<boolean> {
    try {
      const result = this._channel.sendToQueue(queue, content, {
        persistent: true,
        ...options,
      });
      return result;
    } catch (error) {
      this.logger.error(`Failed to send message to queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  ack(msg: amqplib.ConsumeMessage, allUpTo = false): void {
    try {
      if (this._channel && this._channel.connection) {
        this._channel.ack(msg, allUpTo);
      } else {
        this.logger.warn('Cannot acknowledge message - channel not available');
        throw new Error('Channel not available for acknowledgement');
      }
    } catch (error) {
      this.logger.error(`Failed to acknowledge message: ${error.message}`);
      throw error;
    }
  }

  nack(msg: amqplib.ConsumeMessage, allUpTo = false, requeue = true): void {
    try {
      if (this._channel && this._channel.connection) {
        this._channel.nack(msg, allUpTo, requeue);
      } else {
        this.logger.warn('Cannot negative-acknowledge message - channel not available');
        throw new Error('Channel not available for negative acknowledgement');
      }
    } catch (error) {
      this.logger.error(`Failed to negative-acknowledge message: ${error.message}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this._channel) {
        await this._channel.close();
        this.logger.log('RabbitMQ channel closed');
      }
      
      if (this._connection) {
        await this._connection.close();
        this.logger.log('RabbitMQ connection closed');
      }
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ connections: ${error.message}`);
    }
  }
} 