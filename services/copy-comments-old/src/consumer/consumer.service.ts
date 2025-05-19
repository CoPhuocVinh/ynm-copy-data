import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AckMode, RabbitMQService } from '@libs/core/adapter/rabbitmq-adapter';
import {
  CommentCopyPayload,
  ProcessedMessage,
  ProcessingStats,
  MAX_PROCESSED_MESSAGES_SIZE,
  MESSAGE_EXPIRY_TIME,
  CACHE_CLEANUP_INTERVAL,
  STATS_REPORTING_INTERVAL,
  SIMULATED_FAILURE_RATE,
  MIN_PROCESSING_TIME,
  MAX_PROCESSING_TIME,
} from '../shared';

@Injectable()
export class ConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ConsumerService.name);
  private readonly queueName: string;
  private processingStats: ProcessingStats = {
    processed: 0,
    failed: 0,
    lastProcessedTime: null,
  };
  private statsReportingInterval: NodeJS.Timeout | null = null;
  private processedMessages = new Map<string, ProcessedMessage>();
  private readonly maxProcessedMessagesSize = MAX_PROCESSED_MESSAGES_SIZE;
  private readonly messageExpiryTime = MESSAGE_EXPIRY_TIME;
  private isInitialized = false;

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {
    this.queueName = this.configService.get<string>('queue.comments.name');
  }

  // Auto initialize with OnModuleInit
  async onModuleInit() {
    this.logger.log('Auto initializing consumer service via OnModuleInit');
    await this.initialize();
  }

  // Manual initialization
  async initialize() {
    if (this.isInitialized) {
      this.logger.log('Consumer service already initialized, skipping initialization');
      return this;
    }

    this.logger.log('Manually initializing consumer service');
    await this.startConsumer();
    this.startStatsReporting();
    this.startCacheCleanup();
    this.isInitialized = true;
    return this;
  }

  async shutdown() {
    if (this.statsReportingInterval) {
      clearInterval(this.statsReportingInterval);
    }
    this.isInitialized = false;
    this.logger.log('Consumer service shutdown complete');
  }

  private async startConsumer() {
    try {
      await this.rabbitMQService.consume(this.queueName, this.processMessage.bind(this), { noAck: false }, AckMode.POST_PROCESS);
      this.logger.log(`Consumer started for queue ${this.queueName} with POST_PROCESS ack mode`);
    } catch (error) {
      this.logger.error(`Failed to start consumer: ${error.message}`);
      throw error;
    }
  }

  private startStatsReporting() {
    // Report processing stats every 10 seconds
    this.statsReportingInterval = setInterval(() => {
      this.logger.log(
        `Processing stats - Processed: ${this.processingStats.processed}, ` +
          `Failed: ${this.processingStats.failed}, ` +
          `Last processed: ${this.processingStats.lastProcessedTime}, ` +
          `Cache size: ${this.processedMessages.size}`,
      );
    }, STATS_REPORTING_INTERVAL);
  }

  private startCacheCleanup() {
    setInterval(() => {
      this.pruneExpiredMessages();
    }, CACHE_CLEANUP_INTERVAL);
  }

  private pruneExpiredMessages() {
    const now = Date.now();
    let expiredCount = 0;

    const PRUNE_THRESHOLD_RATIO = 0.5;

    for (const [id, message] of this.processedMessages.entries()) {
      if (now - message.timestamp > this.messageExpiryTime) {
        this.processedMessages.delete(id);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`Pruned ${expiredCount} expired message IDs from cache`);
    }

    if (this.processedMessages.size > this.maxProcessedMessagesSize) {
      //const excessItems = this.processedMessages.size - (this.maxProcessedMessagesSize / 2);
      const excessItems = this.processedMessages.size - this.maxProcessedMessagesSize * PRUNE_THRESHOLD_RATIO;
      this.pruneOldestMessages(excessItems);
    }
  }

  private pruneOldestMessages(count: number) {
    if (count <= 0) return;

    this.logger.log(`Pruning ${count} oldest message IDs from cache due to size limit`);

    const sortedEntries = [...this.processedMessages.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < count && i < sortedEntries.length; i++) {
      this.processedMessages.delete(sortedEntries[i][0]);
    }
  }

  private async processMessage(message: any) {
    if (!message) {
      this.logger.warn('Received null message');
      return;
    }

    try {
      const content = message.content.toString();
      const payload = JSON.parse(content) as CommentCopyPayload;

      if (this.processedMessages.has(payload.id)) {
        this.logger.log(`Message ${payload.id} already processed, acknowledging without reprocessing`);
        this.safeAcknowledge(message, payload.id);
        return;
      }

      this.logger.log(`Processing comment copy request: ${payload.id}`);

      try {
        await this.copyComment(payload);

        this.processingStats.processed++;
        this.processingStats.lastProcessedTime = new Date();
        this.processedMessages.set(payload.id, { id: payload.id, timestamp: Date.now() });

        this.safeAcknowledge(message, payload.id);

        this.logger.log(`Comment copy completed for request: ${payload.id}`);
      } catch (processingError) {
        this.processingStats.failed++;
        this.logger.error(`Error processing message: ${processingError.message}`);

        this.safeNegativeAcknowledge(message, payload.id);
      }
    } catch (parseError) {
      this.processingStats.failed++;
      this.logger.error(`Error parsing message: ${parseError.message}`);

      try {
        // Set requeue to true to ensure messages are requeued when there's a parsing error
        this.rabbitMQService.nack(message, false, true);
      } catch (nackError) {
        this.logger.warn(`Failed to nack malformed message: ${nackError.message}`);
      }
    }
  }

  private safeAcknowledge(message: any, messageId: string) {
    try {
      // The RabbitMQService will now handle channel ID checking internally
      // and avoid acknowledging messages from a previous channel
      this.rabbitMQService.ack(message);
    } catch (ackError) {
      this.logger.warn(`Acknowledgement failed for message ${messageId}, but processing completed successfully: ${ackError.message}`);
    }
  }

  private safeNegativeAcknowledge(message: any, messageId: string) {
    try {
      // The RabbitMQService will now handle channel ID checking internally
      // and avoid negative-acknowledging messages from a previous channel
      this.rabbitMQService.nack(message, false, true);
    } catch (nackError) {
      this.logger.warn(`Negative acknowledgement failed for message ${messageId}: ${nackError.message}`);
    }
  }

  private async copyComment(payload: CommentCopyPayload): Promise<void> {
    this.logger.log(`Copying comment ${payload.commentId} from ${payload.source} to ${payload.destination}`);

    if (payload.postId) {
      this.logger.log(`Associated with post: ${payload.postId}`);
    }

    if (payload.shardId !== undefined) {
      this.logger.log(`Using shard: ${payload.shardId}`);
    }

    // Simulate processing time - random between MIN_PROCESSING_TIME and MAX_PROCESSING_TIME
    const processingTime = Math.floor(Math.random() * (MAX_PROCESSING_TIME - MIN_PROCESSING_TIME)) + MIN_PROCESSING_TIME;
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    // Simulate occasional failure with SIMULATED_FAILURE_RATE% chance
    if (Math.random() * 100 < SIMULATED_FAILURE_RATE) {
      throw new Error(`Failed to copy comment ${payload.commentId} - simulated random failure`);
    }

    this.logger.log(`Comment ${payload.commentId} copied successfully in ${processingTime}ms`);
  }

  getProcessingStats(): ProcessingStats {
    return {
      ...this.processingStats,
      cachedMessageCount: this.processedMessages.size,
    };
  }
}
