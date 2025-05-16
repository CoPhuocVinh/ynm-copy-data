import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '@libs/rabbitmq-adapter';
import { CommentCopyRequestDto } from '../shared';
export declare class ProducerService implements OnModuleInit {
    private readonly rabbitMQService;
    private readonly configService;
    private readonly logger;
    private readonly queueName;
    private isInitialized;
    constructor(rabbitMQService: RabbitMQService, configService: ConfigService);
    onModuleInit(): Promise<void>;
    initialize(): Promise<this>;
    shutdown(): Promise<void>;
    sendCommentCopyRequest(payload: CommentCopyRequestDto): Promise<string>;
    sendSampleBatchRequests(count?: number): Promise<string[]>;
}
