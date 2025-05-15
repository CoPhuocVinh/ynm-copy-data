import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
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
export class ProducerService {
  private readonly logger = new Logger(ProducerService.name);
  private readonly queueName: string;

  constructor(
    private readonly rabbitMQService: RabbitMQWrapperService,
    private readonly configService: ConfigService,
  ) {
    this.queueName = this.configService.get<string>('queue.docs.name');
  }

  async sendDocCopyRequest(payload: Omit<DocCopyPayload, 'id' | 'timestamp'>): Promise<string> {
    try {
      const id = uuidv4();
      const message: DocCopyPayload = {
        id,
        ...payload,
        timestamp: Date.now(),
      };

      this.logger.log(`Sending document copy request: ${JSON.stringify(message)}`);
      
      const success = await this.rabbitMQService.sendToQueue(
        this.queueName,
        Buffer.from(JSON.stringify(message)),
        {
          contentType: 'application/json',
          messageId: id,
        },
      );

      if (!success) {
        throw new Error('Failed to send message to queue');
      }

      this.logger.log(`Document copy request sent successfully with ID: ${id}`);
      return id;
    } catch (error) {
      this.logger.error(`Error sending document copy request: ${error.message}`);
      throw error;
    }
  }

  // Helper method to generate sample data and send multiple requests
  async sendSampleBatchRequests(count: number = 5): Promise<string[]> {
    const ids: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const payload = {
        docId: `doc_${Math.floor(Math.random() * 1000)}`,
        folderId: `folder_${Math.floor(Math.random() * 100)}`,
        shardId: Math.floor(Math.random() * 10),
        source: 'old_database',
        destination: 'new_database',
        metadata: {
          priority: Math.floor(Math.random() * 3) + 1,
          batchId: `batch_${Math.floor(Math.random() * 5)}`,
          docType: ['pdf', 'docx', 'xlsx', 'pptx'][Math.floor(Math.random() * 4)],
        },
      };
      
      const id = await this.sendDocCopyRequest(payload);
      ids.push(id);
      
      // Add a small delay between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return ids;
  }
} 