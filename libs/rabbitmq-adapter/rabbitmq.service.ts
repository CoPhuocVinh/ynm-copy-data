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

export enum AckMode {
  /**
   * Xác nhận tin nhắn trước khi xử lý - có thể dẫn đến mất tin nhắn nếu xử lý thất bại
   * nhưng tránh được lỗi channel closed do delivery tag không hợp lệ
   */
  PRE_PROCESS = 'pre_process',
  
  /**
   * Xác nhận tin nhắn sau khi xử lý - đảm bảo tin nhắn chỉ được xác nhận khi xử lý thành công
   * nhưng có thể gặp lỗi channel closed nếu channel bị đóng trong quá trình xử lý
   */
  POST_PROCESS = 'post_process',
  
  /**
   * Xác nhận tin nhắn nếu có thể (best effort) - tránh ném lỗi nếu xác nhận thất bại
   */
  BEST_EFFORT = 'best_effort'
}

// Extend ConsumeMessage with additional properties
interface ExtendedConsumeMessage extends amqplib.ConsumeMessage {
  __preAcknowledged?: boolean;
  __channelId?: number;
}

@Injectable()
export class RabbitMQService implements IRabbitMQService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private _connection: any; // Using 'any' for amqplib Connection
  private _channel: amqplib.Channel;
  private readonly config: RabbitMQConfig;
  private readonly queues: RabbitMQQueueConfig[] = [];
  private readonly exchanges: RabbitMQExchangeConfig[] = [];
  private readonly bindings: RabbitMQBindingConfig[] = [];
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 30;
  private reconnectTimeout = 1000;
  private isReconnecting = false;
  private connectionString: string;
  private consumerTags = new Map<string, string>();
  private consumers = new Map<string, (msg: amqplib.ConsumeMessage | null) => void>();
  private consumerOptions = new Map<string, amqplib.Options.Consume>();
  private defaultAckMode: AckMode = AckMode.BEST_EFFORT;
  private consumerAckModes = new Map<string, AckMode>();
  private _channelId = 0;

  constructor(
    private readonly configService: ConfigService,
    options?: RabbitMQModuleOptions,
  ) {
    this.config = options?.config || this.configService.get<RabbitMQConfig>('rabbitmq');
    if (options?.queues) this.queues = options.queues;
    if (options?.exchanges) this.exchanges = options.exchanges;
    if (options?.bindings) this.bindings = options.bindings;

    // Prepare connection string
    const { hostname, port, username, password, vhost } = this.config;
    this.connectionString = `amqp://${username}:${password}@${hostname}:${port}/${encodeURIComponent(vhost || '/')}`;
  }

  get connection(): amqplib.Connection {
    return this._connection;
  }

  get channel(): amqplib.Channel {
    return this._channel;
  }

  /**
   * Kiểm tra xem kênh hiện tại có hợp lệ để thực hiện các hoạt động không
   */
  isChannelValid(): boolean {
    return Boolean(this._connection && this._channel && this._channel.connection);
  }

  /**
   * Tạo một kênh mới nếu cần thiết
   */
  async ensureChannel(): Promise<boolean> {
    if (!this.isChannelValid()) {
      try {
        await this.createChannel();
        await this.restoreConsumers();
        return true;
      } catch (error) {
        this.logger.error(`Failed to ensure channel: ${error.message}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Khôi phục tất cả các consumer đã đăng ký trước đó
   */
  private async restoreConsumers(): Promise<void> {
    if (!this.isChannelValid()) {
      this.logger.warn('Cannot restore consumers: channel not available');
      return;
    }

    // Xóa các consumerTags cũ vì chúng không còn hợp lệ sau khi kênh mới được tạo
    this.consumerTags.clear();

    // Reinstall all consumers
    for (const [queue, callback] of this.consumers.entries()) {
      const options = this.consumerOptions.get(queue) || {};
      const mode = this.consumerAckModes.get(queue) || this.defaultAckMode;
      
      try {
        this.logger.log(`Restoring consumer for queue: ${queue} with ackMode: ${mode}`);
        
        // Set prefetch count for this specific queue if configured
        const queueConfig = this.queues.find(q => q.name === queue);
        if (queueConfig?.prefetchCount !== undefined) {
          await this._channel.prefetch(queueConfig.prefetchCount);
        }
        
        const consumerTag = await this.consume(queue, callback, options, mode);
        this.logger.log(`Consumer restored for queue ${queue} with tag ${consumerTag}`);
      } catch (error) {
        this.logger.error(`Failed to restore consumer for queue ${queue}: ${error.message}`);
        
        // Thử lại trong nền
        setTimeout(async () => {
          try {
            await this.ensureChannel();
            const consumerTag = await this.consume(queue, callback, options, mode);
            this.logger.log(`Consumer restored for queue ${queue} with tag ${consumerTag} (delayed)`);
          } catch (retryError) {
            this.logger.error(`Failed to restore consumer for queue ${queue} even after retry: ${retryError.message}`);
          }
        }, 1000);
      }
    }
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
      const { hostname, port, username, vhost } = this.config;
      
      this.logger.log(`Connecting to RabbitMQ at ${hostname}:${port} with username ${username} and vhost ${vhost || '/'}`);
      
      try {
        this._connection = await amqplib.connect(this.connectionString);
        this.reconnectAttempts = 0;
        this.bindConnectionListeners();
        this.logger.log('Successfully connected to RabbitMQ');
      } catch (connError) {
        this.logger.error(`Failed to connect to RabbitMQ: ${connError.message}`);
        
        // Handle specific connection errors with helpful messages
        if (connError.message.includes('ECONNREFUSED')) {
          this.logger.error(`RabbitMQ connection refused - check if the RabbitMQ server is running at ${hostname}:${port}`);
        } else if (connError.message.includes('ETIMEDOUT')) {
          this.logger.error(`RabbitMQ connection timeout - check network connectivity to ${hostname}:${port}`);
        } else if (connError.message.includes('auth')) {
          this.logger.error('RabbitMQ authentication failed - check username and password');
        }
        
        throw connError;
      }
    } catch (error) {
      this.logger.error(`RabbitMQ connection error: ${error.message}`);
      await this.handleReconnect();
      throw error;
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
    if (this.isReconnecting) {
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const timeout = Math.min(this.reconnectTimeout * Math.pow(2, Math.min(this.reconnectAttempts - 1, 10)), 30000);
    
    this.logger.log(`Attempting to reconnect in ${timeout}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
        await this.createChannel();
        await this.setupInitialTopology();
        await this.restoreConsumers();
        this.isReconnecting = false;
      } catch (error) {
        this.logger.error(`Error during reconnect: ${error.message}`);
        this.isReconnecting = false;
        // Schedule another reconnect attempt
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.handleReconnect();
        }
      }
    }, timeout);
  }

  async createChannel(): Promise<void> {
    try {
      if (!this._connection) {
        this.logger.warn('Cannot create channel: No connection available');
        await this.connect();
      }
      
      this._channel = await this._connection.createChannel();
      this._channelId++;
      
      // Get prefetch count from queue configuration or use default of 1
      let prefetchCount = 1;
      
      // If we have queue configurations, find the highest prefetch count
      if (this.queues.length > 0) {
        for (const queue of this.queues) {
          if (queue.prefetchCount && queue.prefetchCount > prefetchCount) {
            prefetchCount = queue.prefetchCount;
          }
        }
      }
      
      await this._channel.prefetch(prefetchCount);
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
      }
    });

    this._channel.on('close', () => {
      this.logger.warn('Channel closed - will recreate on next operation');
      this._channel = null;
    });

    this._channel.on('return', (msg) => {
      this.logger.warn(`Message was returned: ${msg.fields.replyText}`);
    });
  }

  private async setupInitialTopology(): Promise<void> {
    try {
      // Make sure we have a channel
      if (!this._channel) {
        await this.createChannel();
      }
      
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
      if (!this._channel) {
        await this.createChannel();
      }
      
      await this._channel.assertQueue(queue, options);
    } catch (error) {
      this.logger.error(`Failed to assert queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  async assertExchange(exchange: string, type: string, options?: amqplib.Options.AssertExchange): Promise<void> {
    try {
      if (!this._channel) {
        await this.createChannel();
      }
      
      await this._channel.assertExchange(exchange, type, options);
    } catch (error) {
      this.logger.error(`Failed to assert exchange ${exchange}: ${error.message}`);
      throw error;
    }
  }

  async bindQueue(queue: string, exchange: string, routingKey: string, options?: any): Promise<void> {
    try {
      if (!this._channel) {
        await this.createChannel();
      }
      
      await this._channel.bindQueue(queue, exchange, routingKey, options);
    } catch (error) {
      this.logger.error(`Failed to bind queue ${queue} to exchange ${exchange}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Thiết lập một consumer nhận tin nhắn từ queue với chế độ xác nhận tùy chỉnh
   */
  async consume(
    queue: string,
    callback: (msg: amqplib.ConsumeMessage | null) => void,
    options?: amqplib.Options.Consume,
    ackMode: AckMode = this.defaultAckMode,
  ): Promise<string> {
    try {
      if (!await this.ensureChannel()) {
        throw new Error('Cannot ensure valid channel for consuming');
      }
      
      // Set prefetch count for this specific queue if configured
      const queueConfig = this.queues.find(q => q.name === queue);
      if (queueConfig?.prefetchCount !== undefined) {
        await this._channel.prefetch(queueConfig.prefetchCount);
      }
      
      // Lưu trữ callback và options để khôi phục sau này nếu cần
      this.consumers.set(queue, callback);
      if (options) {
        this.consumerOptions.set(queue, options);
      }
      this.consumerAckModes.set(queue, ackMode);
      
      // Capture current channel ID for this consumer
      const currentChannelId = this._channelId;
      
      // Tạo wrapper callback tùy thuộc vào chế độ xác nhận
      const wrappedCallback = (msg: amqplib.ConsumeMessage | null) => {
        if (!msg) {
          callback(null);
          return;
        }
        
        const extMsg = msg as ExtendedConsumeMessage;
        
        if (ackMode === AckMode.PRE_PROCESS) {
          try {
            if (this.isChannelValid() && this._channelId === currentChannelId) {
              this._channel.ack(msg);
              
              extMsg.__preAcknowledged = true;
              extMsg.__channelId = currentChannelId;
              
              callback(msg);
            } else {
              extMsg.__preAcknowledged = true;
              extMsg.__channelId = currentChannelId;
              callback(msg);
            }
          } catch (error) {
            this.logger.error(`Error in PRE_PROCESS acknowledge for queue ${queue}: ${error.message}`);
            extMsg.__preAcknowledged = true;
            extMsg.__channelId = currentChannelId;
            
            this.createChannel().catch(err => {
              this.logger.error(`Failed to recreate channel in PRE_PROCESS: ${err.message}`);
            });
            
            callback(msg);
          }
        } else {
          extMsg.__channelId = currentChannelId;
          callback(msg);
        }
      };
      
      const { consumerTag } = await this._channel.consume(queue, wrappedCallback, options);
      this.consumerTags.set(queue, consumerTag);
      return consumerTag;
    } catch (error) {
      this.logger.error(`Failed to start consumer on queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Hủy consume từ một queue cụ thể
   */
  async cancelConsumer(queue: string): Promise<void> {
    try {
      if (!this._channel) {
        this.logger.warn(`Cannot cancel consumer for queue ${queue}: channel not available`);
        return;
      }
      
      const consumerTag = this.consumerTags.get(queue);
      if (!consumerTag) {
        this.logger.warn(`No consumer tag found for queue ${queue}`);
        return;
      }
      
      await this._channel.cancel(consumerTag);
      this.consumerTags.delete(queue);
      this.consumers.delete(queue);
      this.consumerOptions.delete(queue);
      this.logger.log(`Consumer canceled for queue ${queue}`);
    } catch (error) {
      this.logger.error(`Failed to cancel consumer for queue ${queue}: ${error.message}`);
    }
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: amqplib.Options.Publish,
  ): Promise<boolean> {
    try {
      if (!await this.ensureChannel()) {
        throw new Error('Cannot ensure valid channel for publishing');
      }
      
      return this._channel.publish(exchange, routingKey, content, {
        persistent: true,
        ...options,
      });
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
      if (!await this.ensureChannel()) {
        throw new Error('Cannot ensure valid channel for sending to queue');
      }
      
      return this._channel.sendToQueue(queue, content, {
        persistent: true,
        ...options,
      });
    } catch (error) {
      this.logger.error(`Failed to send message to queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to handle message acknowledgements with error handling
   */
  private handleMessageAck(
    msg: amqplib.ConsumeMessage, 
    isAck: boolean, 
    allUpTo = false, 
    requeue = true
  ): void {
    if (!msg) {
      return;
    }
    
    const extMsg = msg as ExtendedConsumeMessage;
    const actionName = isAck ? 'acknowledge' : 'negative-acknowledge';
    
    // Check if message was already acknowledged or if channel has changed
    if (extMsg.__preAcknowledged) {
      return;
    }
    
    // Check if message was received on a different channel
    if (extMsg.__channelId !== undefined && extMsg.__channelId !== this._channelId) {
      this.logger.warn(`Cannot ${actionName} message ${msg.fields.deliveryTag} - channel has changed`);
      return;
    }
    
    try {
      if (!this.isChannelValid()) {
        // Schedule channel recreation in background
        setTimeout(() => this.createChannel(), 0);
        return;
      }
      
      try {
        if (isAck) {
          this._channel.ack(msg, allUpTo);
        } else {
          this._channel.nack(msg, allUpTo, requeue);
        }
      } catch (innerError) {
        if (innerError.message.includes('channel closed') || 
            innerError.message.includes('connection closed') ||
            innerError.message.includes('unknown delivery tag')) {
          this._channel = null;
          setTimeout(() => this.handleReconnect(), 100);
        }
      }
    } catch (error) {
      if (error.message.includes('channel closed') || 
          error.message.includes('connection closed') ||
          error.message.includes('not available') ||
          error.message.includes('unknown delivery tag') ||
          !this._channel) {
        
        this._channel = null;
        setTimeout(() => this.handleReconnect(), 100);
      }
    }
  }

  ack(msg: amqplib.ConsumeMessage, allUpTo = false): void {
    this.handleMessageAck(msg, true, allUpTo);
  }

  nack(msg: amqplib.ConsumeMessage, allUpTo = false, requeue = true): void {
    this.handleMessageAck(msg, false, allUpTo, requeue);
  }

  /**
   * Thiết lập chế độ xác nhận mặc định cho tất cả các lệnh consume mới
   */
  setDefaultAckMode(mode: AckMode): void {
    this.defaultAckMode = mode;
    this.logger.log(`Default ack mode set to: ${mode}`);
  }

  async close(): Promise<void> {
    try {
      if (this._channel) {
        await this._channel.close();
        this._channel = null;
      }
      
      if (this._connection) {
        await this._connection.close();
        this._connection = null;
      }
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ connections: ${error.message}`);
    }
  }
} 