import { ConfigService } from '@nestjs/config';
import { RabbitMQWrapperService } from '../shared/rabbitmq-wrapper.service';
export declare class ConsumerService {
    private readonly rabbitMQService;
    private readonly configService;
    private readonly logger;
    private readonly queueName;
    private processingStats;
    private statsReportingInterval;
    constructor(rabbitMQService: RabbitMQWrapperService, configService: ConfigService);
    initialize(): Promise<this>;
    shutdown(): Promise<void>;
    private startConsumer;
    private startStatsReporting;
    private processMessage;
    private copyDocument;
    getProcessingStats(): {
        processed: number;
        failed: number;
        lastProcessedTime: Date | null;
    };
}
