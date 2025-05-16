import { Channel, Options } from 'amqplib';

/**
 * Configuration for RabbitMQ queue
 */
export interface RabbitMQQueueConfig {
  /**
   * Name of the queue
   */
  name: string;
  
  /**
   * Queue assertion options
   */
  options?: Options.AssertQueue;
  
  /**
   * Prefetch count specific to this queue
   */
  prefetchCount?: number;
  
  /**
   * Whether to assert this queue during initialization
   * @default true
   */
  assertOnStartup?: boolean;
}

/**
 * Configuration for RabbitMQ exchange
 */
export interface RabbitMQExchangeConfig {
  /**
   * Name of the exchange
   */
  name: string;
  
  /**
   * Type of exchange
   */
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  
  /**
   * Exchange assertion options
   */
  options?: Options.AssertExchange;
  
  /**
   * Whether to assert this exchange during initialization
   * @default true
   */
  assertOnStartup?: boolean;
}

/**
 * Configuration for RabbitMQ binding between queue and exchange
 */
export interface RabbitMQBindingConfig {
  /**
   * Queue name to bind
   */
  queue: string;
  
  /**
   * Exchange name to bind to
   */
  exchange: string;
  
  /**
   * Routing key for the binding
   */
  routingKey: string;
  
  /**
   * Binding arguments
   */
  options?: any;
  
  /**
   * Whether to create this binding during initialization
   * @default true
   */
  bindOnStartup?: boolean;
}

/**
 * Interface for RabbitMQ topology manager
 */
export interface IRabbitMQTopologyManager {
  /**
   * Assert a queue
   */
  assertQueue(channel: Channel, queue: string, options?: Options.AssertQueue): Promise<void>;
  
  /**
   * Assert an exchange
   */
  assertExchange(channel: Channel, exchange: string, type: string, options?: Options.AssertExchange): Promise<void>;
  
  /**
   * Bind a queue to an exchange
   */
  bindQueue(channel: Channel, queue: string, exchange: string, routingKey: string, options?: any): Promise<void>;
  
  /**
   * Delete a queue
   */
  deleteQueue(channel: Channel, queue: string, options?: Options.DeleteQueue): Promise<void>;
  
  /**
   * Delete an exchange
   */
  deleteExchange(channel: Channel, exchange: string, options?: Options.DeleteExchange): Promise<void>;
  
  /**
   * Setup initial topology based on configuration
   */
  setupInitialTopology(channel: Channel): Promise<void>;
} 