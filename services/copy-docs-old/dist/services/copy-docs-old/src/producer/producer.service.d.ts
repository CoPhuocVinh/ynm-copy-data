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
export declare class ProducerService {
    private readonly rabbitMQService;
    private readonly configService;
    private readonly logger;
    private readonly queueName;
    constructor(rabbitMQService: RabbitMQWrapperService, configService: ConfigService);
    sendDocCopyRequest(payload: Omit<DocCopyPayload, 'id' | 'timestamp'>): Promise<string>;
    sendSampleBatchRequests(count?: number): Promise<string[]>;
}
export {};
