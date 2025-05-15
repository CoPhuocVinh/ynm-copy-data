import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Use require instead of import to avoid TypeScript errors with amqplib
const amqp = require('amqplib');

@Injectable()
export class RabbitMQWrapperService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQWrapperService.name);
  private connection: any;
  private channel: any;
  private initialized = false;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initialize();
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Connect to RabbitMQ
      const host = this.configService.get<string>('rabbitmq.host');
      const port = this.configService.get<number>('rabbitmq.port');
      const username = this.configService.get<string>('rabbitmq.username');
      const password = this.configService.get<string>('rabbitmq.password');
      const vhost = this.configService.get<string>('rabbitmq.vhost') || '/';

      this.logger.log(`Connecting to RabbitMQ at ${host}:${port}`);
      
      // Connect to RabbitMQ
      const connectionUrl = `amqp://${username}:${password}@${host}:${port}/${encodeURIComponent(vhost)}`;
      this.connection = await amqp.connect(connectionUrl);

      // Create a channel
      this.channel = await this.connection.createChannel();
      
      // Setup queues
      const queueName = this.configService.get<string>('queue.docs.name');
      const durable = this.configService.get<boolean>('queue.docs.durable');
      const autoDelete = this.configService.get<boolean>('queue.docs.autoDelete');
      const queueType = this.configService.get<string>('queue.docs.type');
      
      await this.channel.assertQueue(queueName, { 
        durable: durable,
        autoDelete: autoDelete,
        arguments: {
          'x-queue-type': queueType
        }
      });

      this.logger.log(`Queue ${queueName} asserted successfully with type ${queueType}`);
      this.initialized = true;

      // Handle connection issues
      this.connection.on('error', (err) => {
        this.logger.error(`RabbitMQ connection error: ${err.message}`);
        this.initialized = false;
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.initialized = false;
      });

      this.channel.on('error', (err) => {
        this.logger.error(`RabbitMQ channel error: ${err.message}`);
      });

      this.channel.on('close', () => {
        this.logger.warn('RabbitMQ channel closed');
      });

    } catch (error) {
      this.logger.error(`Failed to initialize RabbitMQ: ${error.message}`);
      throw error;
    }
  }

  async sendToQueue(queue: string, content: Buffer, options?: any): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      return this.channel.sendToQueue(queue, content, {
        persistent: true,
        ...options,
      });
    } catch (error) {
      this.logger.error(`Failed to send message to queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  async consume(queue: string, callback: (msg: any) => void, options?: any): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const { consumerTag } = await this.channel.consume(queue, callback, options);
      return consumerTag;
    } catch (error) {
      this.logger.error(`Failed to start consumer on queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  ack(msg: any, allUpTo: boolean = false): void {
    this.channel.ack(msg, allUpTo);
  }

  nack(msg: any, allUpTo: boolean = false, requeue: boolean = true): void {
    this.channel.nack(msg, allUpTo, requeue);
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    this.initialized = false;
  }
} 