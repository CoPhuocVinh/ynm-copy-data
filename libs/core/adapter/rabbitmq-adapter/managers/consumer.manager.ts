import { Injectable, Logger } from '@nestjs/common';
import { Channel, ConsumeMessage, Options } from 'amqplib';
import { 
  AckMode, 
  ExtendedConsumeMessage, 
  IRabbitMQConsumerManager, 
  RabbitMQConsumerConfig 
} from '../interfaces/consumer.interface';
import { RabbitMQQueueConfig } from '../interfaces/topology.interface';

@Injectable()
export class RabbitMQConsumerManager implements IRabbitMQConsumerManager {
  private readonly logger = new Logger(RabbitMQConsumerManager.name);
  private consumerTags = new Map<string, string>();
  private consumers = new Map<string, (msg: ConsumeMessage | null) => void>();
  private consumerOptions = new Map<string, Options.Consume>();
  private consumerAckModes = new Map<string, AckMode>();
  private defaultAckMode: AckMode = AckMode.POST_PROCESS;
  private queueConfigs: RabbitMQQueueConfig[] = [];
  
  constructor(
    queueConfigs: RabbitMQQueueConfig[] = [],
    consumerConfigs: RabbitMQConsumerConfig[] = []
  ) {
    this.queueConfigs = queueConfigs;
    
    // Setup initial consumers from configuration if provided
    for (const config of consumerConfigs) {
      this.consumerAckModes.set(config.queue, config.ackMode || this.defaultAckMode);
      if (config.options) {
        this.consumerOptions.set(config.queue, config.options);
      }
    }
  }

  /**
   * Start consuming from a queue
   */
  async consume(
    channel: Channel,
    queue: string,
    callback: (msg: ConsumeMessage | null) => void,
    options?: Options.Consume,
    ackMode: AckMode = this.defaultAckMode,
  ): Promise<string> {
    try {
      if (!channel) {
        throw new Error('Cannot consume: Channel not provided');
      }
      
      // Set prefetch count for this specific queue if configured
      const queueConfig = this.queueConfigs.find(q => q.name === queue);
      if (queueConfig?.prefetchCount !== undefined) {
        await channel.prefetch(queueConfig.prefetchCount);
      }
      
      // Store callback and options for future restoration
      this.consumers.set(queue, callback);
      if (options) {
        this.consumerOptions.set(queue, options);
      }
      this.consumerAckModes.set(queue, ackMode);
      
      // Capture channel ID for this consumer
      const channelId = Date.now(); // Use timestamp as channel ID for simplicity
      
      // Create a wrapper callback based on acknowledgment mode
      const wrappedCallback = (msg: ConsumeMessage | null) => {
        if (!msg) {
          callback(null);
          return;
        }
        
        const extMsg = msg as ExtendedConsumeMessage;
        
        if (ackMode === AckMode.PRE_PROCESS) {
          try {
            if (channel && channel.connection) {
              channel.ack(msg);
              
              extMsg.__preAcknowledged = true;
              extMsg.__channelId = channelId;
              
              callback(msg);
            } else {
              extMsg.__preAcknowledged = true;
              extMsg.__channelId = channelId;
              callback(msg);
            }
          } catch (error) {
            this.logger.error(`Error in PRE_PROCESS acknowledge for queue ${queue}: ${error.message}`);
            extMsg.__preAcknowledged = true;
            extMsg.__channelId = channelId;
            callback(msg);
          }
        } else {
          extMsg.__channelId = channelId;
          callback(msg);
        }
      };
      
      const { consumerTag } = await channel.consume(queue, wrappedCallback, options);
      this.consumerTags.set(queue, consumerTag);
      this.logger.log(`Consumer started on queue ${queue} with tag ${consumerTag}`);
      
      return consumerTag;
    } catch (error) {
      this.logger.error(`Failed to start consumer on queue ${queue}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel a consumer
   */
  async cancelConsumer(channel: Channel, queue: string): Promise<void> {
    try {
      if (!channel) {
        this.logger.warn(`Cannot cancel consumer for queue ${queue}: channel not available`);
        return;
      }
      
      const consumerTag = this.consumerTags.get(queue);
      if (!consumerTag) {
        this.logger.warn(`No consumer tag found for queue ${queue}`);
        return;
      }
      
      await channel.cancel(consumerTag);
      this.consumerTags.delete(queue);
      this.consumers.delete(queue);
      this.consumerOptions.delete(queue);
      this.consumerAckModes.delete(queue);
      this.logger.log(`Consumer canceled for queue ${queue}`);
    } catch (error) {
      this.logger.error(`Failed to cancel consumer for queue ${queue}: ${error.message}`);
    }
  }

  /**
   * Restore all consumers after a channel reconnection
   */
  async restoreConsumers(channel: Channel): Promise<void> {
    if (!channel) {
      this.logger.warn('Cannot restore consumers: channel not available');
      return;
    }

    // Clear old consumer tags as they are no longer valid
    this.consumerTags.clear();

    // Reinstall all consumers
    for (const [queue, callback] of this.consumers.entries()) {
      const options = this.consumerOptions.get(queue);
      const mode = this.consumerAckModes.get(queue) || this.defaultAckMode;
      
      try {
        this.logger.log(`Restoring consumer for queue: ${queue} with ackMode: ${mode}`);
        
        // Set prefetch count for this specific queue if configured
        const queueConfig = this.queueConfigs.find(q => q.name === queue);
        if (queueConfig?.prefetchCount !== undefined) {
          await channel.prefetch(queueConfig.prefetchCount);
        }
        
        const consumerTag = await this.consume(channel, queue, callback, options, mode);
        this.logger.log(`Consumer restored for queue ${queue} with tag ${consumerTag}`);
      } catch (error) {
        this.logger.error(`Failed to restore consumer for queue ${queue}: ${error.message}`);
        
        // Retry in the background
        setTimeout(async () => {
          try {
            const consumerTag = await this.consume(channel, queue, callback, options, mode);
            this.logger.log(`Consumer restored for queue ${queue} with tag ${consumerTag} (delayed)`);
          } catch (retryError) {
            this.logger.error(`Failed to restore consumer for queue ${queue} even after retry: ${retryError.message}`);
          }
        }, 1000);
      }
    }
  }

  /**
   * Helper method to handle message acknowledgements with error handling
   */
  private handleMessageAck(
    channel: Channel,
    msg: ConsumeMessage, 
    isAck: boolean, 
    allUpTo = false, 
    requeue = true
  ): void {
    if (!msg) {
      return;
    }
    
    const extMsg = msg as ExtendedConsumeMessage;
    const actionName = isAck ? 'acknowledge' : 'negative-acknowledge';
    
    // Check if message was already acknowledged
    if (extMsg.__preAcknowledged) {
      return;
    }
    
    try {
      if (!channel || !channel.connection) {
        this.logger.warn(`Cannot ${actionName} message: channel not available`);
        return;
      }
      
      try {
        if (isAck) {
          channel.ack(msg, allUpTo);
        } else {
          channel.nack(msg, allUpTo, requeue);
        }
      } catch (innerError) {
        this.logger.error(`Error in ${actionName}: ${innerError.message}`);
        throw innerError; // Rethrow to handle in consumer with POST_PROCESS mode
      }
    } catch (error) {
      this.logger.error(`Failed to ${actionName} message: ${error.message}`);
      throw error; // Rethrow to handle in consumer with POST_PROCESS mode
    }
  }

  /**
   * Acknowledge a message
   */
  ack(channel: Channel, msg: ConsumeMessage, allUpTo = false): void {
    this.handleMessageAck(channel, msg, true, allUpTo);
  }

  /**
   * Negative-acknowledge a message
   */
  nack(channel: Channel, msg: ConsumeMessage, allUpTo = false, requeue = true): void {
    this.handleMessageAck(channel, msg, false, allUpTo, requeue);
  }

  /**
   * Set default acknowledgment mode for new consumers
   */
  setDefaultAckMode(mode: AckMode): void {
    this.defaultAckMode = mode;
    this.logger.log(`Default acknowledgment mode set to: ${mode}`);
  }
} 