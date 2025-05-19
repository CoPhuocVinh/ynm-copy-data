import { Channel, ConsumeMessage, Options } from 'amqplib';

/**
 * Message acknowledgment modes
 */
export enum AckMode {
  /**
   * Acknowledge message before processing
   * May result in message loss if processing fails, but prevents channel closed errors due to invalid delivery tags
   */
  PRE_PROCESS = 'pre_process',
  
  /**
   * Acknowledge message after processing
   * Ensures message is only acknowledged when processing succeeds, but may encounter channel closed errors
   */
  POST_PROCESS = 'post_process',
  
  /**
   * Best effort acknowledgment
   * Avoid throwing errors if acknowledgment fails
   */
  BEST_EFFORT = 'best_effort'
}

/**
 * Extended ConsumeMessage with additional properties
 */
export interface ExtendedConsumeMessage extends ConsumeMessage {
  __preAcknowledged?: boolean;
  __channelId?: number;
}

/**
 * Consumer configuration
 */
export interface RabbitMQConsumerConfig {
  /**
   * Queue to consume from
   */
  queue: string;
  
  /**
   * Consume options
   */
  options?: Options.Consume;
  
  /**
   * Acknowledgment mode
   * @default AckMode.BEST_EFFORT
   */
  ackMode?: AckMode;
  
  /**
   * Whether to start consuming automatically on initialization
   * @default true
   */
  autoStart?: boolean;
}

/**
 * Interface for RabbitMQ consumer manager
 */
export interface IRabbitMQConsumerManager {
  /**
   * Start consuming from a queue
   */
  consume(
    channel: Channel,
    queue: string,
    callback: (msg: ConsumeMessage | null) => void,
    options?: Options.Consume,
    ackMode?: AckMode,
  ): Promise<string>;
  
  /**
   * Cancel a consumer
   */
  cancelConsumer(channel: Channel, queue: string): Promise<void>;
  
  /**
   * Acknowledge a message
   */
  ack(channel: Channel, msg: ConsumeMessage, allUpTo?: boolean): void;
  
  /**
   * Negative-acknowledge a message
   */
  nack(channel: Channel, msg: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
  
  /**
   * Set default acknowledgment mode for new consumers
   */
  setDefaultAckMode(mode: AckMode): void;
  
  /**
   * Restore all consumers after a channel reconnection
   */
  restoreConsumers(channel: Channel): Promise<void>;
} 