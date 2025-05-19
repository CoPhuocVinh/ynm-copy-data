import { Channel, Connection } from 'amqplib';

/**
 * Configuration for RabbitMQ channel
 */
export interface RabbitMQChannelConfig {
  /**
   * Default prefetch count for the channel
   * @default 1
   */
  prefetchCount?: number;
  
  /**
   * Whether to enable publisher confirms
   * @default false
   */
  enablePublisherConfirms?: boolean;
  
  /**
   * Whether to automatically recreate channel on failure
   * @default true
   */
  autoRecreate?: boolean;
}

/**
 * Interface for RabbitMQ channel manager
 */
export interface IRabbitMQChannelManager {
  /**
   * Get the current channel instance
   */
  readonly channel: Channel;
  
  /**
   * Get the current channel ID (increments when channel is recreated)
   */
  readonly channelId: number;
  
  /**
   * Create a new channel
   */
  createChannel(connection: Connection): Promise<Channel>;
  
  /**
   * Close the channel
   */
  closeChannel(): Promise<void>;
  
  /**
   * Ensure a valid channel exists, creating one if necessary
   */
  ensureChannel(connection: Connection): Promise<Channel>;
  
  /**
   * Check if the channel is valid and open
   */
  isChannelValid(): boolean;
  
  /**
   * Set the prefetch count for the channel
   */
  setPrefetchCount(count: number): Promise<void>;
  
  /**
   * Register a channel event listener
   */
  onChannelEvent(event: 'close' | 'error' | 'return' | 'drain', listener: (...args: any[]) => void): void;
} 