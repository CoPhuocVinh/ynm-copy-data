export * from './connection.interface';
export * from './channel.interface';
export * from './topology.interface';
export * from './consumer.interface';
export * from './publisher.interface';
export * from './service.interface';

import { RabbitMQConnectionConfig } from './connection.interface';
import { RabbitMQChannelConfig } from './channel.interface';
import { RabbitMQQueueConfig, RabbitMQExchangeConfig, RabbitMQBindingConfig } from './topology.interface';
import { RabbitMQConsumerConfig } from './consumer.interface';
import { RabbitMQPublisherConfig } from './publisher.interface';

/**
 * Complete RabbitMQ configuration
 */
export interface RabbitMQConfig extends RabbitMQConnectionConfig {
  /**
   * Channel configuration
   */
  channel?: RabbitMQChannelConfig;
  
  /**
   * Publisher configuration
   */
  publisher?: RabbitMQPublisherConfig;
}

/**
 * RabbitMQ module options
 */
export interface RabbitMQModuleOptions {
  /**
   * Connection and general configuration
   */
  config: RabbitMQConfig;
  
  /**
   * Queues to set up
   */
  queues?: RabbitMQQueueConfig[];
  
  /**
   * Exchanges to set up
   */
  exchanges?: RabbitMQExchangeConfig[];
  
  /**
   * Bindings to create
   */
  bindings?: RabbitMQBindingConfig[];
  
  /**
   * Consumers to set up
   */
  consumers?: RabbitMQConsumerConfig[];
} 