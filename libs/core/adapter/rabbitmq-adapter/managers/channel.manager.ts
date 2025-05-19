import { Injectable, Logger } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { IRabbitMQChannelManager, RabbitMQChannelConfig } from '../interfaces/channel.interface';

@Injectable()
export class RabbitMQChannelManager implements IRabbitMQChannelManager {
  private readonly logger = new Logger(RabbitMQChannelManager.name);
  private _channel: amqplib.Channel;
  private _channelId = 0;
  private eventListeners: Map<string, ((...args: any[]) => void)[]> = new Map();
  
  constructor(private readonly config: RabbitMQChannelConfig = {}) {
    // Set default configuration values
    this.config = {
      prefetchCount: 1,
      enablePublisherConfirms: false,
      autoRecreate: true,
      ...config
    };
  }

  get channel(): amqplib.Channel {
    return this._channel;
  }

  get channelId(): number {
    return this._channelId;
  }

  async createChannel(connection: amqplib.Connection): Promise<amqplib.Channel> {
    try {
      if (!connection) {
        throw new Error('Cannot create channel: No connection provided');
      }
      
      // We need to use any to bypass TypeScript's type checking since amqplib's types are incompatible
      this._channel = await (connection as any).createChannel();
      this._channelId++;
      
      // Set default prefetch count for the channel
      await this.setPrefetchCount(this.config.prefetchCount);
      
      // Set up publisher confirms if enabled
      if (this.config.enablePublisherConfirms) {
        // Use any to bypass TypeScript's type checking for the confirm method
        await (this._channel as any).confirm();
      }
      
      this.bindChannelListeners();
      this.logger.log(`Successfully created RabbitMQ channel with ID ${this._channelId}`);
      
      return this._channel;
    } catch (error) {
      this.logger.error(`Failed to create RabbitMQ channel: ${error.message}`);
      throw error;
    }
  }

  private bindChannelListeners(): void {
    this._channel.on('error', (error) => {
      this.logger.error(`Channel error: ${error.message}`);
      this.notifyEventListeners('error', error);
      
      if (error.message.includes('PRECONDITION_FAILED') || 
          error.message.includes('unknown delivery tag')) {
        this._channel = null;
      }
    });

    this._channel.on('close', () => {
      this.logger.warn('Channel closed');
      this.notifyEventListeners('close');
      this._channel = null;
    });

    this._channel.on('return', (msg) => {
      this.logger.warn(`Message was returned: ${msg.fields.replyText}`);
      this.notifyEventListeners('return', msg);
    });
    
    this._channel.on('drain', () => {
      this.notifyEventListeners('drain');
    });
  }

  async closeChannel(): Promise<void> {
    if (this._channel) {
      try {
        await this._channel.close();
        this._channel = null;
      } catch (error) {
        this.logger.error(`Error closing channel: ${error.message}`);
      }
    }
  }

  isChannelValid(): boolean {
    // Change the check to avoid accessing potentially non-existent properties
    return Boolean(this._channel);
  }

  async ensureChannel(connection: amqplib.Connection): Promise<amqplib.Channel> {
    if (!this.isChannelValid()) {
      try {
        await this.createChannel(connection);
      } catch (error) {
        this.logger.error(`Failed to ensure channel: ${error.message}`);
        throw error;
      }
    }
    
    return this._channel;
  }

  async setPrefetchCount(count: number): Promise<void> {
    if (!this.isChannelValid()) {
      this.logger.warn(`Cannot set prefetch count: Channel not valid`);
      return;
    }
    
    try {
      await this._channel.prefetch(count);
    } catch (error) {
      this.logger.error(`Failed to set prefetch count: ${error.message}`);
      throw error;
    }
  }

  onChannelEvent(event: 'close' | 'error' | 'return' | 'drain', listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event).push(listener);
  }
  
  private notifyEventListeners(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event) || [];
    
    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (error) {
        this.logger.error(`Error in channel event listener for event '${event}': ${error.message}`);
      }
    }
  }
} 