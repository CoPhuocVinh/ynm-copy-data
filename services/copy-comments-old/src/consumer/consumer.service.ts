import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '@libs/rabbitmq-adapter';
import { ConsumeMessage } from 'amqplib';

interface CommentCopyPayload {
  id: string;
  commentId: string;
  postId?: string;
  shardId?: number;
  source: string;
  destination: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);
  private readonly queueName: string;
  private processingStats = {
    processed: 0,
    failed: 0,
    lastProcessedTime: null as Date | null,
  };
  private statsReportingInterval: NodeJS.Timeout | null = null;
  private consumerTag: string | null = null;
  private isProcessing = false; // Lock to prevent concurrent processing
  private channelRecoveryInProgress = false; // Flag to track channel recovery

  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {
    this.queueName = this.configService.get<string>('queue.comments.name');
  }

  // Manual initialization
  async initialize() {
    this.logger.log('Manually initializing consumer service');
    
    try {
      // First, ensure RabbitMQ is connected
      if (!this.rabbitmqService.connection) {
        await this.rabbitmqService.connect();
        // Brief delay to allow connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Ensure we have a channel
      if (!this.rabbitmqService.channel) {
        await this.rabbitmqService.createChannel();
        // Brief delay to allow channel to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Set up queue and bindings
      await this.setupQueue();
      
      // Brief delay before starting consumer
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start consumer
      await this.startConsumer();
      
      // Start stats reporting
      this.startStatsReporting();
      
      this.logger.log('Consumer service initialization complete');
      return this;
    } catch (error) {
      this.logger.error(`Failed to initialize consumer service: ${error.message}`);
      // Try again after a delay
      setTimeout(() => {
        this.logger.log('Attempting to reinitialize consumer service');
        this.initialize();
      }, 5000);
      throw error;
    }
  }

  // Set up the queue before consuming
  private async setupQueue() {
    try {
      const queueOptions = {
        durable: this.configService.get<boolean>('queue.comments.durable') !== false,
        autoDelete: this.configService.get<boolean>('queue.comments.autoDelete') === true,
      };

      // Make sure we have a connection and channel
      if (!this.rabbitmqService.connection || !this.rabbitmqService.channel) {
        this.logger.log('RabbitMQ connection or channel not initialized');
        
        // Try to reconnect
        if (!this.rabbitmqService.connection) {
          this.logger.log('Attempting to connect to RabbitMQ...');
          await this.rabbitmqService.connect();
        }
        
        // Create channel if needed
        if (!this.rabbitmqService.channel) {
          this.logger.log('Creating RabbitMQ channel...');
          await this.rabbitmqService.createChannel();
        }
      }

      // Check again if we have a channel
      if (!this.rabbitmqService.channel) {
        throw new Error('Failed to initialize RabbitMQ channel');
      }

      // Assert queue
      await this.rabbitmqService.assertQueue(this.queueName, queueOptions);
      this.logger.log(`Queue ${this.queueName} asserted successfully`);
    } catch (error) {
      this.logger.error(`Failed to setup queue: ${error.message}`);
      throw error;
    }
  }

  async shutdown() {
    if (this.statsReportingInterval) {
      clearInterval(this.statsReportingInterval);
      this.statsReportingInterval = null;
    }
    
    // Since RabbitMQService doesn't have cancelConsumer, 
    // we'll let the service shutdown handle the cleanup
    this.logger.log('Consumer service shutdown initiated');
    
    // Try to close the RabbitMQ connection
    try {
      await this.rabbitmqService.close();
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ connection: ${error.message}`);
    }
    
    this.logger.log('Consumer service shutdown complete');
  }

  private async startConsumer() {
    try {
      // Double check the channel is ready
      if (!this.rabbitmqService.channel) {
        this.logger.warn('RabbitMQ channel not initialized, attempting to create it');
        if (this.rabbitmqService.connection) {
          await this.rabbitmqService.createChannel();
        } else {
          this.logger.warn('RabbitMQ connection not available, connecting first');
          await this.rabbitmqService.connect();
          await this.rabbitmqService.createChannel();
        }
      }
      
      if (!this.rabbitmqService.channel) {
        throw new Error('Failed to initialize RabbitMQ channel after attempts');
      }
      
      // Set prefetch to 1 to ensure we only process one message at a time
      await this.rabbitmqService.channel.prefetch(1);
      this.logger.log('Set channel prefetch to 1');
      
      // Generate a unique consumer tag
      const uniqueConsumerTag = `consumer_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      this.logger.log(`Starting consumer for queue: ${this.queueName} with tag ${uniqueConsumerTag}`);
      this.consumerTag = await this.rabbitmqService.consume(
        this.queueName,
        this.processMessage.bind(this),
        { 
          noAck: true,
          consumerTag: uniqueConsumerTag
        },
      );
      this.logger.log(`Consumer started for queue ${this.queueName} with tag ${this.consumerTag}`);
    } catch (error) {
      this.logger.error(`Failed to start consumer: ${error.message}`);
      // Try reconnecting after a short delay
      setTimeout(() => {
        this.logger.log('Attempting to restart consumer after failure');
        this.recoverChannel();
      }, 5000);
      throw error;
    }
  }

  private startStatsReporting() {
    // Report processing stats every 10 seconds
    this.statsReportingInterval = setInterval(() => {
      this.logger.log(
        `Processing stats - Processed: ${this.processingStats.processed}, ` +
        `Failed: ${this.processingStats.failed}, ` +
        `Last processed: ${this.processingStats.lastProcessedTime}`,
      );
    }, 10000);
  }

  private async processMessage(message: ConsumeMessage | null) {
    if (!message) {
      this.logger.warn('Received null message');
      return;
    }

    // Skip processing if a recovery is in progress or another message is being processed
    if (this.channelRecoveryInProgress) {
      this.logger.warn('Channel recovery in progress, deferring message processing');
      return;
    }

    if (this.isProcessing) {
      this.logger.warn('Another message is being processed, deferring');
      return;
    }

    this.isProcessing = true;
    let messageId = 'unknown';
    let payloadId = 'unknown';
    
    try {
      const content = message.content.toString();
      const payload = JSON.parse(content) as CommentCopyPayload;
      messageId = message.properties.messageId || 'unknown';
      payloadId = payload.id;
      
      this.logger.log(`Processing comment copy request: ${payload.id} (${messageId})`);
      
      // Simulate comment copy processing
      await this.copyComment(payload);
      
      // Update stats
      this.processingStats.processed++;
      this.processingStats.lastProcessedTime = new Date();
      
      // No need to acknowledge - using auto-ack (noAck: true)
      this.logger.log(`Comment copy completed for request: ${payload.id} (${messageId})`);
    } catch (error) {
      this.processingStats.failed++;
      this.logger.error(`Error processing message for ${payloadId} (${messageId}): ${error.message}`);
      // With auto-ack, we can't nack failed messages, so they won't be requeued
      // Consider implementing a dead-letter queue for error handling
    } finally {
      this.isProcessing = false;
    }
  }

  private async copyComment(payload: CommentCopyPayload): Promise<void> {
    // Simulate comment copying process
    this.logger.log(`Copying comment ${payload.commentId} from ${payload.source} to ${payload.destination}`);
    
    if (payload.postId) {
      this.logger.log(`Associated with post: ${payload.postId}`);
    }
    
    if (payload.shardId !== undefined) {
      this.logger.log(`Using shard: ${payload.shardId}`);
    }
    
    // Simulate processing time - random between 500ms and 2s to simulate varying workloads
    const processingTime = Math.floor(Math.random() * 1500) + 500;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional failure
    if (Math.random() < 0.05) { // 5% chance to fail
      throw new Error(`Failed to copy comment ${payload.commentId} - simulated random failure`);
    }
    
    this.logger.log(`Comment ${payload.commentId} copied successfully in ${processingTime}ms`);
  }

  // Method to get current processing stats
  getProcessingStats() {
    return { ...this.processingStats };
  }

  // Public method to trigger channel recovery from external sources
  async manualRecovery(): Promise<void> {
    this.logger.log('Manual channel recovery triggered');
    // This method can be called from outside the class (e.g., from main-consumer.ts)
    await this.recoverChannel();
  }

  // Helper method to check if channel is healthy
  private isChannelHealthy(): boolean {
    if (!this.rabbitmqService.channel) {
      return false;
    }
    
    try {
      // Check if we can access both the channel and its connection
      const channelObj = this.rabbitmqService.channel;
      return !!channelObj && !!channelObj.connection;
    } catch (error) {
      this.logger.error(`Error checking channel health: ${error.message}`);
      return false;
    }
  }

  // Helper method to recover channel after errors
  private async recoverChannel(): Promise<void> {
    // Prevent multiple recovery attempts
    if (this.channelRecoveryInProgress) {
      this.logger.log('Channel recovery already in progress, skipping');
      return;
    }

    this.channelRecoveryInProgress = true;
    try {
      this.logger.log('Attempting to recover RabbitMQ channel...');
      
      // Delay before reconnection to allow server state to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Cancel existing consumer if possible
      if (this.consumerTag && this.rabbitmqService.channel) {
        try {
          await this.rabbitmqService.channel.cancel(this.consumerTag);
          this.logger.log(`Cancelled existing consumer with tag ${this.consumerTag}`);
        } catch (error) {
          this.logger.warn(`Could not cancel consumer: ${error.message}`);
        }
      }
      
      // Create new consumer with a unique tag to avoid conflicts
      const newConsumerTag = `consumer_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Check if we need to reconnect
      if (!this.rabbitmqService.connection) {
        await this.rabbitmqService.connect();
        // Allow connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Recreate channel
      await this.rabbitmqService.createChannel();
      
      // Ensure channel has prefetch set
      if (this.rabbitmqService.channel) {
        await this.rabbitmqService.channel.prefetch(1);
        this.logger.log('Set prefetch to 1 on recovered channel');
      }
      
      // Re-setup queue
      await this.setupQueue();
      
      // Start consuming with new consumer tag and auto-ack
      this.consumerTag = await this.rabbitmqService.consume(
        this.queueName,
        this.processMessage.bind(this),
        { 
          noAck: true,
          consumerTag: newConsumerTag
        },
      );
      
      this.logger.log(`Successfully recovered RabbitMQ channel with new consumer tag: ${this.consumerTag}`);
    } catch (error) {
      this.logger.error(`Failed to recover channel: ${error.message}`);
      
      // Try again after a delay
      setTimeout(() => this.recoverChannel(), 5000);
    } finally {
      this.channelRecoveryInProgress = false;
    }
  }
} 