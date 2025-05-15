import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '@libs/rabbitmq-adapter';
import { v4 as uuidv4 } from 'uuid';

interface DocumentCopyPayload {
  id: string;
  documentId: string;
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
    private readonly rabbitmqService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {
    this.queueName = this.configService.get<string>('queue.docs.name');
  }

  async sendDocumentCopyRequest(payload: Omit<DocumentCopyPayload, 'id' | 'timestamp'>): Promise<string> {
    try {
      const id = uuidv4();
      const message: DocumentCopyPayload = {
        id,
        ...payload,
        timestamp: Date.now(),
      };

      this.logger.log(`Sending document copy request: ${JSON.stringify(message)}`);
      
      const success = await this.rabbitmqService.sendToQueue(
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
} 