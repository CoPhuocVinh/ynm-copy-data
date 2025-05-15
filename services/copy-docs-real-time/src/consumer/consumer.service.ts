import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '@libs/rabbitmq-adapter';
import { ConsumeMessage } from 'amqplib';

interface DocumentCopyPayload {
  id: string;
  documentId: string;
  source: string;
  destination: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class ConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ConsumerService.name);
  private readonly queueName: string;

  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {
    this.queueName = this.configService.get<string>('queue.docs.name');
  }

  async onModuleInit() {
    await this.setupQueue();
    await this.startConsumer();
  }

  private async setupQueue() {
    try {
      const queueOptions = {
        durable: this.configService.get<boolean>('queue.docs.durable'),
        autoDelete: this.configService.get<boolean>('queue.docs.autoDelete'),
      };

      await this.rabbitmqService.assertQueue(this.queueName, queueOptions);
      this.logger.log(`Queue ${this.queueName} asserted successfully`);
    } catch (error) {
      this.logger.error(`Failed to setup queue: ${error.message}`);
      throw error;
    }
  }

  private async startConsumer() {
    try {
      await this.rabbitmqService.consume(
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

  private async processMessage(message: ConsumeMessage | null) {
    if (!message) {
      this.logger.warn('Received null message');
      return;
    }

    try {
      const content = message.content.toString();
      const payload = JSON.parse(content) as DocumentCopyPayload;
      
      this.logger.log(`Processing document copy request: ${payload.id}`);
      
      // Simulate document copy processing
      await this.copyDocument(payload);
      
      // Acknowledge the message
      this.rabbitmqService.ack(message);
      
      this.logger.log(`Document copy completed for request: ${payload.id}`);
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`);
      
      // Reject the message and requeue
      this.rabbitmqService.nack(message, false, true);
    }
  }

  private async copyDocument(payload: DocumentCopyPayload): Promise<void> {
    // Simulate document copying process
    this.logger.log(`Copying document ${payload.documentId} from ${payload.source} to ${payload.destination}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.logger.log(`Document ${payload.documentId} copied successfully`);
  }
} 