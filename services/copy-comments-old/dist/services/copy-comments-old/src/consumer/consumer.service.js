"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ConsumerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rabbitmq_adapter_1 = require("@libs/rabbitmq-adapter");
const shared_1 = require("../shared");
let ConsumerService = ConsumerService_1 = class ConsumerService {
    constructor(rabbitMQService, configService) {
        this.rabbitMQService = rabbitMQService;
        this.configService = configService;
        this.logger = new common_1.Logger(ConsumerService_1.name);
        this.processingStats = {
            processed: 0,
            failed: 0,
            lastProcessedTime: null,
        };
        this.statsReportingInterval = null;
        this.processedMessages = new Map();
        this.maxProcessedMessagesSize = shared_1.MAX_PROCESSED_MESSAGES_SIZE;
        this.messageExpiryTime = shared_1.MESSAGE_EXPIRY_TIME;
        this.queueName = this.configService.get('queue.comments.name');
    }
    async onModuleInit() {
        this.logger.log('Auto initializing consumer service via OnModuleInit');
        await this.initialize();
    }
    async initialize() {
        this.logger.log('Manually initializing consumer service');
        await this.startConsumer();
        this.startStatsReporting();
        this.startCacheCleanup();
        return this;
    }
    async shutdown() {
        if (this.statsReportingInterval) {
            clearInterval(this.statsReportingInterval);
        }
        this.logger.log('Consumer service shutdown complete');
    }
    async startConsumer() {
        try {
            await this.rabbitMQService.consume(this.queueName, this.processMessage.bind(this), { noAck: false }, rabbitmq_adapter_1.AckMode.PRE_PROCESS);
            this.logger.log(`Consumer started for queue ${this.queueName} with PRE_PROCESS ack mode`);
        }
        catch (error) {
            this.logger.error(`Failed to start consumer: ${error.message}`);
            throw error;
        }
    }
    startStatsReporting() {
        this.statsReportingInterval = setInterval(() => {
            this.logger.log(`Processing stats - Processed: ${this.processingStats.processed}, ` +
                `Failed: ${this.processingStats.failed}, ` +
                `Last processed: ${this.processingStats.lastProcessedTime}, ` +
                `Cache size: ${this.processedMessages.size}`);
        }, shared_1.STATS_REPORTING_INTERVAL);
    }
    startCacheCleanup() {
        setInterval(() => {
            this.pruneExpiredMessages();
        }, shared_1.CACHE_CLEANUP_INTERVAL);
    }
    pruneExpiredMessages() {
        const now = Date.now();
        let expiredCount = 0;
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
            const excessItems = this.processedMessages.size - (this.maxProcessedMessagesSize / 2);
            this.pruneOldestMessages(excessItems);
        }
    }
    pruneOldestMessages(count) {
        if (count <= 0)
            return;
        this.logger.log(`Pruning ${count} oldest message IDs from cache due to size limit`);
        const sortedEntries = [...this.processedMessages.entries()]
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < count && i < sortedEntries.length; i++) {
            this.processedMessages.delete(sortedEntries[i][0]);
        }
    }
    async processMessage(message) {
        if (!message) {
            this.logger.warn('Received null message');
            return;
        }
        try {
            const content = message.content.toString();
            const payload = JSON.parse(content);
            if (this.processedMessages.has(payload.id)) {
                this.logger.log(`Message ${payload.id} already processed, acknowledging without reprocessing`);
                if (!message.__preAcknowledged) {
                    this.safeAcknowledge(message, payload.id);
                }
                return;
            }
            this.logger.log(`Processing comment copy request: ${payload.id}`);
            try {
                await this.copyComment(payload);
                this.processingStats.processed++;
                this.processingStats.lastProcessedTime = new Date();
                this.processedMessages.set(payload.id, { id: payload.id, timestamp: Date.now() });
                if (!message.__preAcknowledged) {
                    this.safeAcknowledge(message, payload.id);
                }
                this.logger.log(`Comment copy completed for request: ${payload.id}`);
            }
            catch (processingError) {
                this.processingStats.failed++;
                this.logger.error(`Error processing message: ${processingError.message}`);
                if (!message.__preAcknowledged) {
                    this.safeNegativeAcknowledge(message, payload.id);
                }
                else {
                    this.logger.warn(`Message ${payload.id} failed but was pre-acknowledged, cannot nack`);
                }
            }
        }
        catch (parseError) {
            this.processingStats.failed++;
            this.logger.error(`Error parsing message: ${parseError.message}`);
            if (!message.__preAcknowledged) {
                try {
                    this.rabbitMQService.nack(message, false, false);
                }
                catch (nackError) {
                    this.logger.warn(`Failed to nack malformed message: ${nackError.message}`);
                }
            }
        }
    }
    safeAcknowledge(message, messageId) {
        try {
            this.rabbitMQService.ack(message);
        }
        catch (ackError) {
            this.logger.warn(`Acknowledgement failed for message ${messageId}, but processing completed successfully: ${ackError.message}`);
        }
    }
    safeNegativeAcknowledge(message, messageId) {
        try {
            this.rabbitMQService.nack(message, false, true);
        }
        catch (nackError) {
            this.logger.warn(`Negative acknowledgement failed for message ${messageId}: ${nackError.message}`);
        }
    }
    async copyComment(payload) {
        this.logger.log(`Copying comment ${payload.commentId} from ${payload.source} to ${payload.destination}`);
        if (payload.postId) {
            this.logger.log(`Associated with post: ${payload.postId}`);
        }
        if (payload.shardId !== undefined) {
            this.logger.log(`Using shard: ${payload.shardId}`);
        }
        const processingTime = Math.floor(Math.random() * (shared_1.MAX_PROCESSING_TIME - shared_1.MIN_PROCESSING_TIME)) + shared_1.MIN_PROCESSING_TIME;
        await new Promise(resolve => setTimeout(resolve, processingTime));
        if (Math.random() * 100 < shared_1.SIMULATED_FAILURE_RATE) {
            throw new Error(`Failed to copy comment ${payload.commentId} - simulated random failure`);
        }
        this.logger.log(`Comment ${payload.commentId} copied successfully in ${processingTime}ms`);
    }
    getProcessingStats() {
        return {
            ...this.processingStats,
            cachedMessageCount: this.processedMessages.size
        };
    }
};
exports.ConsumerService = ConsumerService;
exports.ConsumerService = ConsumerService = ConsumerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [rabbitmq_adapter_1.RabbitMQService,
        config_1.ConfigService])
], ConsumerService);
//# sourceMappingURL=consumer.service.js.map