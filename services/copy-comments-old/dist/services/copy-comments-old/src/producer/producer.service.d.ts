import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '@libs/rabbitmq-adapter';
import { CommentCopyRequestDto } from '../shared';
export declare class ProducerService {
    private readonly rabbitMQService;
    private readonly configService;
    private readonly logger;
    private readonly queueName;
    constructor(rabbitMQService: RabbitMQService, configService: ConfigService);
    sendCommentCopyRequest(payload: CommentCopyRequestDto): Promise<string>;
    sendSampleBatchRequests(count?: number): Promise<string[]>;
}
