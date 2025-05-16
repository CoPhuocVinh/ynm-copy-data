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
const rabbitmq_wrapper_service_1 = require("../shared/rabbitmq-wrapper.service");
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
        this.queueName = this.configService.get('queue.docs.name');
    }
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
    async startConsumer() {
        try {
            await this.rabbitMQService.consume(this.queueName, this.processMessage.bind(this), { noAck: false });
            this.logger.log(`Consumer started for queue ${this.queueName}`);
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
                `Last processed: ${this.processingStats.lastProcessedTime}`);
        }, 10000);
    }
    async processMessage(message) {
        if (!message) {
            this.logger.warn('Received null message');
            return;
        }
        try {
            const content = message.content.toString();
            const payload = JSON.parse(content);
            this.logger.log(`VINHCP: Processing document copy request: ${payload.id}`);
            await this.copyDocument(payload);
            this.processingStats.processed++;
            this.processingStats.lastProcessedTime = new Date();
            this.rabbitMQService.ack(message);
            this.logger.log(`Document copy completed for request: ${payload.id}`);
        }
        catch (error) {
            this.processingStats.failed++;
            this.logger.error(`Error processing message: ${error.message}`);
            this.rabbitMQService.nack(message, false, true);
        }
    }
    async copyDocument(payload) {
        this.logger.log(`Copying document ${payload.docId} from ${payload.source} to ${payload.destination}`);
        if (payload.folderId) {
            this.logger.log(`Associated with folder: ${payload.folderId}`);
        }
        if (payload.shardId !== undefined) {
            this.logger.log(`Using shard: ${payload.shardId}`);
        }
        const processingTime = Math.floor(Math.random() * 1500) + 500;
        await new Promise(resolve => setTimeout(resolve, processingTime));
        if (Math.random() < 0.05) {
            throw new Error(`Failed to copy document ${payload.docId} - simulated random failure`);
        }
        this.logger.log(`Document ${payload.docId} copied successfully in ${processingTime}ms`);
    }
    getProcessingStats() {
        return { ...this.processingStats };
    }
};
exports.ConsumerService = ConsumerService;
exports.ConsumerService = ConsumerService = ConsumerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [rabbitmq_wrapper_service_1.RabbitMQWrapperService,
        config_1.ConfigService])
], ConsumerService);
//# sourceMappingURL=consumer.service.js.map