import { Injectable, Logger } from '@nestjs/common';
import { Channel, Options } from 'amqplib';
import { 
  IRabbitMQTopologyManager, 
  RabbitMQBindingConfig, 
  RabbitMQExchangeConfig, 
  RabbitMQQueueConfig 
} from '../interfaces/topology.interface';

@Injectable()
export class RabbitMQTopologyManager implements IRabbitMQTopologyManager {
  private readonly logger = new Logger(RabbitMQTopologyManager.name);
  private readonly queues: RabbitMQQueueConfig[] = [];
  private readonly exchanges: RabbitMQExchangeConfig[] = [];
  private readonly bindings: RabbitMQBindingConfig[] = [];

  constructor(
    queues: RabbitMQQueueConfig[] = [], 
    exchanges: RabbitMQExchangeConfig[] = [],
    bindings: RabbitMQBindingConfig[] = []
  ) {
    this.queues = queues;
    this.exchanges = exchanges;
    this.bindings = bindings;
  }

  async assertQueue(
    channel: Channel,
    queue: string, 
    options?: Options.AssertQueue
  ): Promise<void> {
    try {
      if (!channel) {
        throw new Error('Cannot assert queue: Channel not provided');
      }
      
      await channel.assertQueue(queue, options);
      this.logger.debug(`Queue asserted: ${queue}`);
    } catch (error) {
      this.logger.error(`Failed to assert queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  async assertExchange(
    channel: Channel,
    exchange: string, 
    type: string, 
    options?: Options.AssertExchange
  ): Promise<void> {
    try {
      if (!channel) {
        throw new Error('Cannot assert exchange: Channel not provided');
      }
      
      await channel.assertExchange(exchange, type, options);
      this.logger.debug(`Exchange asserted: ${exchange} (${type})`);
    } catch (error) {
      this.logger.error(`Failed to assert exchange ${exchange}: ${error.message}`);
      throw error;
    }
  }

  async bindQueue(
    channel: Channel,
    queue: string, 
    exchange: string, 
    routingKey: string, 
    options?: any
  ): Promise<void> {
    try {
      if (!channel) {
        throw new Error('Cannot bind queue: Channel not provided');
      }
      
      await channel.bindQueue(queue, exchange, routingKey, options);
      this.logger.debug(`Queue ${queue} bound to exchange ${exchange} with routing key ${routingKey}`);
    } catch (error) {
      this.logger.error(`Failed to bind queue ${queue} to exchange ${exchange}: ${error.message}`);
      throw error;
    }
  }

  async deleteQueue(
    channel: Channel,
    queue: string, 
    options?: Options.DeleteQueue
  ): Promise<void> {
    try {
      if (!channel) {
        throw new Error('Cannot delete queue: Channel not provided');
      }
      
      await channel.deleteQueue(queue, options);
      this.logger.debug(`Queue deleted: ${queue}`);
    } catch (error) {
      this.logger.error(`Failed to delete queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  async deleteExchange(
    channel: Channel,
    exchange: string, 
    options?: Options.DeleteExchange
  ): Promise<void> {
    try {
      if (!channel) {
        throw new Error('Cannot delete exchange: Channel not provided');
      }
      
      await channel.deleteExchange(exchange, options);
      this.logger.debug(`Exchange deleted: ${exchange}`);
    } catch (error) {
      this.logger.error(`Failed to delete exchange ${exchange}: ${error.message}`);
      throw error;
    }
  }

  async setupInitialTopology(channel: Channel): Promise<void> {
    try {
      if (!channel) {
        throw new Error('Cannot setup topology: Channel not provided');
      }
      
      // Setup exchanges
      for (const exchange of this.exchanges) {
        if (exchange.assertOnStartup !== false) {
          await this.assertExchange(
            channel, 
            exchange.name, 
            exchange.type, 
            exchange.options
          );
        }
      }

      // Setup queues
      for (const queue of this.queues) {
        if (queue.assertOnStartup !== false) {
          await this.assertQueue(
            channel, 
            queue.name, 
            queue.options
          );
        }
      }

      // Setup bindings
      for (const binding of this.bindings) {
        if (binding.bindOnStartup !== false) {
          await this.bindQueue(
            channel, 
            binding.queue, 
            binding.exchange, 
            binding.routingKey, 
            binding.options
          );
        }
      }

      this.logger.log('Initial RabbitMQ topology setup completed');
    } catch (error) {
      this.logger.error(`Error setting up initial topology: ${error.message}`);
      throw error;
    }
  }
} 