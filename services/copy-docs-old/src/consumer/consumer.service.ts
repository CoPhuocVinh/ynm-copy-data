import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQWrapperService } from '../shared/rabbitmq-wrapper.service';

interface DocCopyPayload {
  id: string;
  docId: string;
  folderId?: string;
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

  constructor(
    private readonly rabbitMQService: RabbitMQWrapperService,
    private readonly configService: ConfigService,
  ) {
    this.queueName = this.configService.get<string>('queue.docs.name');
  }

  // Manual initialization
  async initialize() {
    this.logger.log('Manually initializing consumer service');
    await this.startConsumer();
    this.startStatsReporting();
    return this;
  }

  async shutdown() {
    if (this.statsReportingInterval) {
      clearInterval(this.statsReportingInterval);
    }
    this.logger.log('Consumer service shutdown complete');
  }

  private async startConsumer() {
    try {
      await this.rabbitMQService.consume(
        this.queueName,
        this.processMessage.bind(this),
        { noAck: false },
      );
      this.logger.log(`Consumer started for queue ${this.queueName}`);
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
        `Last processed: ${this.processingStats.lastProcessedTime}`,
      );
    }, 10000);
  }

  private async processMessage(message: any) {
    if (!message) {
      this.logger.warn('Received null message');
      return;
    }

    try {
      const content = message.content.toString();
      const payload = JSON.parse(content) as DocCopyPayload;
      
      this.logger.log(`VINHCP: Processing document copy request: ${payload.id}`);

      // Simulate document copy processing
      await this.copyDocument(payload);
      
      // Update stats
      this.processingStats.processed++;
      this.processingStats.lastProcessedTime = new Date();
      
      // Acknowledge the message
      this.rabbitMQService.ack(message);
      
      this.logger.log(`Document copy completed for request: ${payload.id}`);
    } catch (error) {
      this.processingStats.failed++;
      this.logger.error(`Error processing message: ${error.message}`);
      
      // Reject the message and requeue
      this.rabbitMQService.nack(message, false, true);
    }
  }

  private async copyDocument(payload: DocCopyPayload): Promise<void> {
    // Simulate document copying process
    this.logger.log(`Copying document ${payload.docId} from ${payload.source} to ${payload.destination}`);
    
    if (payload.folderId) {
      this.logger.log(`Associated with folder: ${payload.folderId}`);
    }
    
    if (payload.shardId !== undefined) {
      this.logger.log(`Using shard: ${payload.shardId}`);
    }
    
    // Simulate processing time - random between 500ms and 2s to simulate varying workloads
    const processingTime = Math.floor(Math.random() * 1500) + 500;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional failure
    if (Math.random() < 0.05) { // 5% chance to fail
      throw new Error(`Failed to copy document ${payload.docId} - simulated random failure`);
    }
    
    this.logger.log(`Document ${payload.docId} copied successfully in ${processingTime}ms`);
  }

  // Method to get current processing stats
  getProcessingStats() {
    return { ...this.processingStats };
  }
} 