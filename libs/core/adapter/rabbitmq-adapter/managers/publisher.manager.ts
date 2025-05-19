import { Injectable, Logger } from '@nestjs/common';
import { Channel, Options } from 'amqplib';
import { IRabbitMQPublisher, PublishResult, RabbitMQPublisherConfig } from '../interfaces/publisher.interface';

@Injectable()
export class RabbitMQPublisherManager implements IRabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisherManager.name);
  private _channel: Channel;
  
  constructor(private readonly config: RabbitMQPublisherConfig = {}) {
    // Set default configuration values
    this.config = {
      defaultExchange: '',
      useConfirmChannel: false,
      confirmTimeout: 5000,
      retryFailedPublishes: true,
      maxPublishRetries: 3,
      ...config
    };
  }

  setChannel(channel: Channel): void {
    this._channel = channel;
    
    // Setup confirm channel if needed
    if (this.config.useConfirmChannel && channel) {
      try {
        // Use any to bypass TypeScript type checking
        (channel as any).confirm();
        this.logger.log('Publisher channel set to confirm mode');
      } catch (error) {
        this.logger.error(`Failed to set channel to confirm mode: ${error.message}`);
      }
    }
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Options.Publish
  ): Promise<PublishResult> {
    const retryCount = 0;
    return this.publishWithRetry(exchange, routingKey, content, options, retryCount);
  }

  private async publishWithRetry(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Options.Publish,
    retryCount = 0
  ): Promise<PublishResult> {
    try {
      if (!this._channel) {
        return {
          success: false,
          error: 'No channel available for publishing'
        };
      }
      
      const publishOptions = {
        persistent: true,
        ...options
      };
      
      if (this.config.useConfirmChannel) {
        return await this.publishWithConfirm(exchange, routingKey, content, publishOptions);
      } else {
        const result = this._channel.publish(exchange, routingKey, content, publishOptions);
        
        return {
          success: result,
          error: result ? undefined : 'Channel write buffer full'
        };
      }
    } catch (error) {
      this.logger.error(`Failed to publish message to exchange ${exchange}: ${error.message}`);
      
      // Retry if enabled and not exceeded max retries
      if (this.config.retryFailedPublishes && retryCount < this.config.maxPublishRetries) {
        const nextRetry = retryCount + 1;
        const delay = Math.pow(2, nextRetry) * 100; // Exponential backoff
        
        this.logger.log(`Retrying publish (${nextRetry}/${this.config.maxPublishRetries}) in ${delay}ms`);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(this.publishWithRetry(exchange, routingKey, content, options, nextRetry));
          }, delay);
        });
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  private publishWithConfirm(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: Options.Publish
  ): Promise<PublishResult> {
    return new Promise((resolve) => {
      // Set up timeout for confirm
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          confirmed: false,
          error: `Publish confirmation timed out after ${this.config.confirmTimeout}ms`
        });
      }, this.config.confirmTimeout);
      
      // Set up one-time confirmation handlers
      const onConfirm = () => {
        clearTimeout(timeoutId);
        resolve({
          success: true,
          confirmed: true
        });
      };
      
      const onError = (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          confirmed: false,
          error: err ? err.message : 'Publish was rejected'
        });
      };
      
      // Publish the message
      try {
        const result = this._channel.publish(exchange, routingKey, content, options);
        
        if (!result) {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            confirmed: false,
            error: 'Channel write buffer full'
          });
          return;
        }
        
        // Register confirmation handlers
        this._channel.once('ack', onConfirm);
        this._channel.once('nack', onError);
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          confirmed: false,
          error: error.message
        });
      }
    });
  }

  async sendToQueue(
    queue: string,
    content: Buffer,
    options?: Options.Publish
  ): Promise<PublishResult> {
    const retryCount = 0;
    return this.sendToQueueWithRetry(queue, content, options, retryCount);
  }

  private async sendToQueueWithRetry(
    queue: string,
    content: Buffer,
    options?: Options.Publish,
    retryCount = 0
  ): Promise<PublishResult> {
    try {
      if (!this._channel) {
        return {
          success: false,
          error: 'No channel available for sending to queue'
        };
      }
      
      const publishOptions = {
        persistent: true,
        ...options
      };
      
      if (this.config.useConfirmChannel) {
        return await this.sendToQueueWithConfirm(queue, content, publishOptions);
      } else {
        const result = this._channel.sendToQueue(queue, content, publishOptions);
        
        return {
          success: result,
          error: result ? undefined : 'Channel write buffer full'
        };
      }
    } catch (error) {
      this.logger.error(`Failed to send message to queue ${queue}: ${error.message}`);
      
      // Retry if enabled and not exceeded max retries
      if (this.config.retryFailedPublishes && retryCount < this.config.maxPublishRetries) {
        const nextRetry = retryCount + 1;
        const delay = Math.pow(2, nextRetry) * 100; // Exponential backoff
        
        this.logger.log(`Retrying send to queue (${nextRetry}/${this.config.maxPublishRetries}) in ${delay}ms`);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(this.sendToQueueWithRetry(queue, content, options, nextRetry));
          }, delay);
        });
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  private sendToQueueWithConfirm(
    queue: string,
    content: Buffer,
    options: Options.Publish
  ): Promise<PublishResult> {
    return new Promise((resolve) => {
      // Set up timeout for confirm
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          confirmed: false,
          error: `Send confirmation timed out after ${this.config.confirmTimeout}ms`
        });
      }, this.config.confirmTimeout);
      
      // Set up one-time confirmation handlers
      const onConfirm = () => {
        clearTimeout(timeoutId);
        resolve({
          success: true,
          confirmed: true
        });
      };
      
      const onError = (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          confirmed: false,
          error: err ? err.message : 'Send was rejected'
        });
      };
      
      // Send the message
      try {
        const result = this._channel.sendToQueue(queue, content, options);
        
        if (!result) {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            confirmed: false,
            error: 'Channel write buffer full'
          });
          return;
        }
        
        // Register confirmation handlers
        this._channel.once('ack', onConfirm);
        this._channel.once('nack', onError);
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          confirmed: false,
          error: error.message
        });
      }
    });
  }
} 