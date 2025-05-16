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

@Injectable()
export class RabbitMQService implements IRabbitMQService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private _connection: any; // Using 'any' to avoid TypeScript errors with amqplib types
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
  private consumerTags: Map<string, string> = new Map(); // Lưu trữ consumer tag theo queue
  private consumers: Map<string, (msg: amqplib.ConsumeMessage | null) => void> = new Map(); // Lưu trữ consumer callback theo queue
  private consumerOptions: Map<string, amqplib.Options.Consume> = new Map(); // Lưu trữ consumer options theo queue
  private defaultAckMode: AckMode = AckMode.BEST_EFFORT;
  private consumerAckModes: Map<string, AckMode> = new Map(); // Lưu trữ chế độ xác nhận theo queue
  private _channelId: number = 0;  // Track channel ID to detect channel changes

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
   * @returns boolean - true nếu kênh hợp lệ, false nếu không
   */
  isChannelValid(): boolean {
    return Boolean(this._connection && this._channel && this._channel.connection);
  }

  /**
   * Tạo một kênh mới nếu cần thiết
   * @returns Promise<boolean> - true nếu kênh hợp lệ hoặc đã được tạo mới, false nếu không thể tạo kênh
   */
  async ensureChannel(): Promise<boolean> {
    if (!this.isChannelValid()) {
      try {
        await this.createChannel();
        // Nếu tạo channel thành công, khôi phục các consumer đã đăng ký
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
        
        // Sử dụng phương thức consume() để đăng ký lại consumer
        // Điều này đảm bảo rằng các wrapper callbacks được tạo lại đúng cách
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
      
      // Use a more straightforward connection approach with a connection string
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
      if (error.stack) {
        this.logger.error(`Stack trace: ${error.stack}`);
      }
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
      this.logger.log('Reconnection already in progress, skipping');
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
        // Khôi phục các consumer đã đăng ký
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
      // Increment channel ID to track channel changes
      this._channelId++;
      this._channel.prefetch(10); // Set prefetch count to 10 messages at a time
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
      this.logger.warn('Channel closed - will recreate on next operation');
      this._channel = null;
    });

    // Thêm xử lý các sự kiện khác nếu cần
    this._channel.on('return', (msg) => {
      this.logger.warn(`Message was returned: ${msg.fields.replyText}`);
    });

    this._channel.on('drain', () => {
      this.logger.debug('Channel drain event received');
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
      if (!this._channel) {
        await this.createChannel();
      }
      
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
      if (!this._channel) {
        await this.createChannel();
      }
      
      this.logger.debug(`Binding queue ${queue} to exchange ${exchange} with routing key ${routingKey}`);
      await this._channel.bindQueue(queue, exchange, routingKey, options);
      this.logger.debug(`Queue ${queue} bound to exchange ${exchange}`);
    } catch (error) {
      this.logger.error(`Failed to bind queue ${queue} to exchange ${exchange}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Thiết lập một consumer nhận tin nhắn từ queue với chế độ xác nhận tùy chỉnh
   * @param queue Tên queue
   * @param callback Hàm callback xử lý tin nhắn
   * @param options Tùy chọn consume
   * @param ackMode Chế độ xác nhận (mặc định: BEST_EFFORT)
   * @returns Promise<string> consumerTag
   */
  async consume(
    queue: string,
    callback: (msg: amqplib.ConsumeMessage | null) => void,
    options?: amqplib.Options.Consume,
    ackMode: AckMode = this.defaultAckMode,
  ): Promise<string> {
    try {
      // Đảm bảo kênh đã sẵn sàng
      if (!await this.ensureChannel()) {
        throw new Error('Cannot ensure valid channel for consuming');
      }
      
      this.logger.debug(`Starting consumer on queue: ${queue} with ackMode: ${ackMode}`);
      
      // Lưu trữ callback và options để khôi phục sau này nếu cần
      this.consumers.set(queue, callback);
      if (options) {
        this.consumerOptions.set(queue, options);
      }
      // Lưu trữ chế độ xác nhận
      this.consumerAckModes.set(queue, ackMode);
      
      // Capture current channel ID for this consumer
      const currentChannelId = this._channelId;
      
      // Tạo wrapper callback tùy thuộc vào chế độ xác nhận
      const wrappedCallback = (msg: amqplib.ConsumeMessage | null) => {
        if (!msg) {
          callback(null);
          return;
        }
        
        if (ackMode === AckMode.PRE_PROCESS) {
          // Xác nhận tin nhắn trước khi xử lý để tránh lỗi channel closed
          try {
            if (this.isChannelValid() && this._channelId === currentChannelId) {
              this.logger.debug(`PRE_PROCESS: Acknowledging message ${msg.fields.deliveryTag} before processing`);
              this._channel.ack(msg); // Sử dụng _channel trực tiếp để tránh vòng lặp
              
              // Đánh dấu đã xác nhận trên tin nhắn để tránh xác nhận lại
              (msg as any).__preAcknowledged = true;
              (msg as any).__channelId = currentChannelId;
              
              // Bây giờ gọi callback để xử lý
              callback(msg);
            } else {
              this.logger.warn(`PRE_PROCESS: Cannot acknowledge message ${msg.fields.deliveryTag} - channel not valid or has changed`);
              // Mark message as pre-acknowledged to avoid further ack attempts
              (msg as any).__preAcknowledged = true;
              (msg as any).__channelId = currentChannelId;
              // Vẫn chuyển tiếp tin nhắn để xử lý
              callback(msg);
            }
          } catch (error) {
            this.logger.error(`Error in PRE_PROCESS acknowledge for queue ${queue}: ${error.message}`);
            // Mark message as pre-acknowledged to avoid further ack attempts
            (msg as any).__preAcknowledged = true;
            (msg as any).__channelId = currentChannelId;
            // Thử tạo lại kênh trong nền
            this.createChannel().catch(err => {
              this.logger.error(`Failed to recreate channel in PRE_PROCESS: ${err.message}`);
            });
            // Vẫn chuyển tiếp tin nhắn để xử lý
            callback(msg);
          }
        } else {
          // Chế độ POST_PROCESS hoặc BEST_EFFORT: Chuyển tin nhắn cho callback xử lý
          // Store channel ID with the message
          (msg as any).__channelId = currentChannelId;
          callback(msg);
        }
      };
      
      const { consumerTag } = await this._channel.consume(queue, wrappedCallback, options);
      this.consumerTags.set(queue, consumerTag);
      this.logger.debug(`Consumer started on queue ${queue} with tag ${consumerTag}`);
      return consumerTag;
    } catch (error) {
      this.logger.error(`Failed to start consumer on queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Hủy consume từ một queue cụ thể
   * @param queue Tên queue hoặc consumer tag
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
      // Đảm bảo kênh đã sẵn sàng
      if (!await this.ensureChannel()) {
        throw new Error('Cannot ensure valid channel for publishing');
      }
      
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
      // Đảm bảo kênh đã sẵn sàng
      if (!await this.ensureChannel()) {
        throw new Error('Cannot ensure valid channel for sending to queue');
      }
      
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
    if (!msg) {
      this.logger.warn('Cannot acknowledge null message');
      return;
    }
    
    // Check if message was already acknowledged or if channel has changed
    if ((msg as any).__preAcknowledged) {
      this.logger.debug(`Message ${msg.fields.deliveryTag} was already pre-acknowledged`);
      return;
    }
    
    // Check if message was received on a different channel
    if ((msg as any).__channelId !== undefined && (msg as any).__channelId !== this._channelId) {
      this.logger.warn(`Cannot acknowledge message ${msg.fields.deliveryTag} - channel has changed since message was received`);
      return;
    }
    
    try {
      if (!this.isChannelValid()) {
        this.logger.warn(`Cannot acknowledge message (tag: ${msg.fields.deliveryTag}) - channel not available`);
        
        // Try to recreate the channel in the background without blocking
        setTimeout(() => {
          this.createChannel().catch(err => {
            this.logger.error(`Failed to recreate channel during ack: ${err.message}`);
            this.handleReconnect().catch(reconnectError => {
              this.logger.error(`Reconnect failed during ack: ${reconnectError.message}`);
            });
          });
        }, 0);
        
        // Don't throw an error, just log it and return
        this.logger.error(`Channel not available for acknowledgement of message ${msg.fields.deliveryTag}`);
        return;
      }
      
      this.logger.debug(`Acknowledging message with tag: ${msg.fields.deliveryTag}, allUpTo: ${allUpTo}`);
      
      try {
        this._channel.ack(msg, allUpTo);
        this.logger.debug(`Successfully acknowledged message ${msg.fields.deliveryTag}`);
      } catch (innerError) {
        // Handle specific channel errors
        this.logger.error(`Direct channel error in ack: ${innerError.message}`);
        
        // Don't throw the error, just handle the reconnection
        if (innerError.message.includes('channel closed') || 
            innerError.message.includes('connection closed') ||
            innerError.message.includes('unknown delivery tag')) {
          this._channel = null; // Mark channel as invalid
          
          // Schedule reconnection in the background
          setTimeout(() => {
            this.handleReconnect().catch(reconnectError => {
              this.logger.error(`Failed to reconnect after ack error: ${reconnectError.message}`);
            });
          }, 100);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to acknowledge message ${msg.fields.deliveryTag}: ${error.message}`);
      
      // If this is a connection-related error, try to reconnect
      if (error.message.includes('channel closed') || 
          error.message.includes('connection closed') ||
          error.message.includes('not available') ||
          error.message.includes('unknown delivery tag') ||
          !this._channel) {
        
        this.logger.warn('Connection issue detected during ack, attempting to reconnect...');
        this._channel = null; // Mark channel as invalid
        
        // Schedule reconnection in the background
        setTimeout(() => {
          this.handleReconnect().catch(reconnectError => {
            this.logger.error(`Failed to reconnect after ack error: ${reconnectError.message}`);
          });
        }, 100);
      }
      
      // Don't throw the error
    }
  }

  nack(msg: amqplib.ConsumeMessage, allUpTo = false, requeue = true): void {
    if (!msg) {
      this.logger.warn('Cannot negative-acknowledge null message');
      return;
    }
    
    // Check if message was already acknowledged or if channel has changed
    if ((msg as any).__preAcknowledged) {
      this.logger.debug(`Message ${msg.fields.deliveryTag} was already pre-acknowledged, cannot nack`);
      return;
    }
    
    // Check if message was received on a different channel
    if ((msg as any).__channelId !== undefined && (msg as any).__channelId !== this._channelId) {
      this.logger.warn(`Cannot negative-acknowledge message ${msg.fields.deliveryTag} - channel has changed since message was received`);
      return;
    }
    
    try {
      if (!this.isChannelValid()) {
        this.logger.warn(`Cannot negative-acknowledge message (tag: ${msg.fields.deliveryTag}) - channel not available`);
        
        // Try to recreate the channel in the background without blocking
        setTimeout(() => {
          this.createChannel().catch(err => {
            this.logger.error(`Failed to recreate channel during nack: ${err.message}`);
            this.handleReconnect().catch(reconnectError => {
              this.logger.error(`Reconnect failed during nack: ${reconnectError.message}`);
            });
          });
        }, 0);
        
        // Don't throw an error, just log it and return
        this.logger.error(`Channel not available for negative acknowledgement of message ${msg.fields.deliveryTag}`);
        return;
      }
      
      this.logger.debug(`Negative-acknowledging message with tag: ${msg.fields.deliveryTag}, allUpTo: ${allUpTo}, requeue: ${requeue}`);
      
      try {
        this._channel.nack(msg, allUpTo, requeue);
        this.logger.debug(`Successfully negative-acknowledged message ${msg.fields.deliveryTag}`);
      } catch (innerError) {
        // Handle specific channel errors
        this.logger.error(`Direct channel error in nack: ${innerError.message}`);
        
        // Don't throw the error, just handle the reconnection
        if (innerError.message.includes('channel closed') || 
            innerError.message.includes('connection closed') ||
            innerError.message.includes('unknown delivery tag')) {
          this._channel = null; // Mark channel as invalid
          
          // Schedule reconnection in the background
          setTimeout(() => {
            this.handleReconnect().catch(reconnectError => {
              this.logger.error(`Failed to reconnect after nack error: ${reconnectError.message}`);
            });
          }, 100);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to negative-acknowledge message ${msg.fields.deliveryTag}: ${error.message}`);
      
      // If this is a connection-related error, try to reconnect
      if (error.message.includes('channel closed') || 
          error.message.includes('connection closed') ||
          error.message.includes('not available') ||
          error.message.includes('unknown delivery tag') ||
          !this._channel) {
        
        this.logger.warn('Connection issue detected during nack, attempting to reconnect...');
        this._channel = null; // Mark channel as invalid
        
        // Schedule reconnection in the background
        setTimeout(() => {
          this.handleReconnect().catch(reconnectError => {
            this.logger.error(`Failed to reconnect after nack error: ${reconnectError.message}`);
          });
        }, 100);
      }
      
      // Don't throw the error
    }
  }

  /**
   * Thiết lập chế độ xác nhận mặc định cho tất cả các lệnh consume mới
   * @param mode Chế độ xác nhận mặc định
   */
  setDefaultAckMode(mode: AckMode): void {
    this.defaultAckMode = mode;
    this.logger.log(`Default ack mode set to: ${mode}`);
  }

  async close(): Promise<void> {
    try {
      if (this._channel) {
        await this._channel.close();
        this.logger.log('RabbitMQ channel closed');
        this._channel = null;
      }
      
      if (this._connection) {
        await this._connection.close();
        this.logger.log('RabbitMQ connection closed');
        this._connection = null;
      }
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ connections: ${error.message}`);
    }
  }
} 