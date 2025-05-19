import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQService } from '@libs/rabbitmq-adapter';
import { CommentCopyPayload, CommentCopyRequestDto, MESSAGE_SEND_DELAY, MESSAGE_SEND_TIMEOUT, MAX_SEND_RETRIES } from '../shared';

@Injectable()
export class ProducerService implements OnModuleInit {
  private readonly logger = new Logger(ProducerService.name);
  private readonly queueName: string;
  private isInitialized = false;

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {
    this.queueName = this.configService.get<string>('queue.comments.name');
  }

  // Auto initialize with OnModuleInit
  async onModuleInit() {
    this.logger.log('Auto initializing producer service via OnModuleInit');
    await this.initialize();
  }

  // Manual initialization
  async initialize() {
    if (this.isInitialized) {
      this.logger.log('Producer service already initialized, skipping initialization');
      return this;
    }

    this.logger.log('Initializing producer service');
    // Verify RabbitMQ connection works by checking if the connection exists
    // Chỉ ghi log, không thực sự kiểm tra kết nối vì RabbitMQService tự động xử lý kết nối
    this.logger.log(`Initializing connection to RabbitMQ queue: ${this.queueName}`);
    this.isInitialized = true;
    return this;
  }

  // Shutdown method for cleanup
  async shutdown() {
    this.logger.log('Producer service shutdown complete');
    this.isInitialized = false;
  }

  /**
   * Send a comment copy request to the RabbitMQ queue
   * @param payload Comment copy request data
   * @returns ID of the sent copy request
   */
  async sendCommentCopyRequest(payload: CommentCopyRequestDto): Promise<string> {
    // Ensure service is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const id = uuidv4();
      const message: CommentCopyPayload = {
        id,
        ...payload,
        timestamp: Date.now(),
      };

      this.logger.log(`Sending comment copy request: ${JSON.stringify(message)}`);

      // Add timeout to prevent hanging if RabbitMQ doesn't respond
      const sendPromise = this.rabbitMQService.sendToQueue(this.queueName, Buffer.from(JSON.stringify(message)), {
        contentType: 'application/json',
        messageId: id,
      });

      // Create promise with timeout
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error(`Send operation timed out after ${MESSAGE_SEND_TIMEOUT}ms`)), MESSAGE_SEND_TIMEOUT);
      });

      // Wait for whichever promise completes first
      const success = await Promise.race([sendPromise, timeoutPromise]);

      if (!success) {
        throw new Error('Failed to send message to queue');
      }

      this.logger.log(`Comment copy request sent successfully with ID: ${id}`);
      return id;
    } catch (error) {
      this.logger.error(`Error sending comment copy request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to create and send multiple sample copy requests
   * @param count Number of requests to create and send
   * @returns List of IDs of the sent requests
   */
  async sendSampleBatchRequests(count: number = 5): Promise<string[]> {
    const ids: string[] = [];

    for (let i = 0; i < count; i++) {
      const payload: CommentCopyRequestDto = {
        commentId: `comment_${Math.floor(Math.random() * 1000)}`,
        postId: `post_${Math.floor(Math.random() * 100)}`,
        shardId: Math.floor(Math.random() * 10),
        source: 'old_database',
        destination: 'new_database',
        metadata: {
          priority: Math.floor(Math.random() * 3) + 1,
          batchId: `batch_${Math.floor(Math.random() * 5)}`,
          commentType: ['text', 'image', 'video', 'audio'][Math.floor(Math.random() * 4)],
        },
      };

      // Add retry mechanism for failed sends
      let retries = 0;
      let id: string | null = null;

      while (retries < MAX_SEND_RETRIES && id === null) {
        try {
          id = await this.sendCommentCopyRequest(payload);
        } catch (error) {
          retries++;
          this.logger.warn(`Failed to send message (attempt ${retries}/${MAX_SEND_RETRIES}): ${error.message}`);

          if (retries < MAX_SEND_RETRIES) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, MESSAGE_SEND_DELAY * retries));
          }
        }
      }

      if (id) {
        ids.push(id);
      } else {
        this.logger.error(`Failed to send message after ${MAX_SEND_RETRIES} attempts`);
      }

      // Add a small delay between messages
      await new Promise((resolve) => setTimeout(resolve, MESSAGE_SEND_DELAY));
    }

    return ids;
  }
}
