import { Channel, Options } from 'amqplib';

/**
 * Publisher configuration
 */
export interface RabbitMQPublisherConfig {
  /**
   * Default exchange for publishing
   * @default ''
   */
  defaultExchange?: string;
  
  /**
   * Whether to use publisher confirms
   * @default false
   */
  useConfirmChannel?: boolean;
  
  /**
   * Timeout for publisher confirms in milliseconds
   * @default 5000
   */
  confirmTimeout?: number;
  
  /**
   * Whether to auto-retry failed publishes
   * @default true
   */
  retryFailedPublishes?: boolean;
  
  /**
   * Maximum number of publish retries
   * @default 3
   */
  maxPublishRetries?: number;
}

/**
 * Publish result
 */
export interface PublishResult {
  /**
   * Whether the publish was successful
   */
  success: boolean;
  
  /**
   * Error message if publish failed
   */
  error?: string;
  
  /**
   * Whether the publish was confirmed by the broker (only if using confirm channel)
   */
  confirmed?: boolean;
}

/**
 * Interface for RabbitMQ publisher
 */
export interface IRabbitMQPublisher {
  /**
   * Publish a message to an exchange
   */
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Options.Publish
  ): Promise<PublishResult>;
  
  /**
   * Send a message directly to a queue
   */
  sendToQueue(
    queue: string,
    content: Buffer,
    options?: Options.Publish
  ): Promise<PublishResult>;
  
  /**
   * Set the channel to use for publishing
   */
  setChannel(channel: Channel): void;
} 