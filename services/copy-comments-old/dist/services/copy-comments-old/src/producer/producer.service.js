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
var ProducerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProducerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const uuid_1 = require("uuid");
const rabbitmq_adapter_1 = require("@libs/rabbitmq-adapter");
const shared_1 = require("../shared");
let ProducerService = ProducerService_1 = class ProducerService {
    constructor(rabbitMQService, configService) {
        this.rabbitMQService = rabbitMQService;
        this.configService = configService;
        this.logger = new common_1.Logger(ProducerService_1.name);
        this.isInitialized = false;
        this.queueName = this.configService.get('queue.comments.name');
    }
    async onModuleInit() {
        this.logger.log('Auto initializing producer service via OnModuleInit');
        await this.initialize();
    }
    async initialize() {
        if (this.isInitialized) {
            this.logger.log('Producer service already initialized, skipping initialization');
            return this;
        }
        this.logger.log('Initializing producer service');
        this.logger.log(`Initializing connection to RabbitMQ queue: ${this.queueName}`);
        this.isInitialized = true;
        return this;
    }
    async shutdown() {
        this.logger.log('Producer service shutdown complete');
        this.isInitialized = false;
    }
    async sendCommentCopyRequest(payload) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const id = (0, uuid_1.v4)();
            const message = {
                id,
                ...payload,
                timestamp: Date.now(),
            };
            this.logger.log(`Sending comment copy request: ${JSON.stringify(message)}`);
            const sendPromise = this.rabbitMQService.sendToQueue(this.queueName, Buffer.from(JSON.stringify(message)), {
                contentType: 'application/json',
                messageId: id,
            });
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Send operation timed out after ${shared_1.MESSAGE_SEND_TIMEOUT}ms`)), shared_1.MESSAGE_SEND_TIMEOUT);
            });
            const success = await Promise.race([sendPromise, timeoutPromise]);
            if (!success) {
                throw new Error('Failed to send message to queue');
            }
            this.logger.log(`Comment copy request sent successfully with ID: ${id}`);
            return id;
        }
        catch (error) {
            this.logger.error(`Error sending comment copy request: ${error.message}`);
            throw error;
        }
    }
    async sendSampleBatchRequests(count = 5) {
        const ids = [];
        for (let i = 0; i < count; i++) {
            const payload = {
                commentId: `comment_${Math.floor(Math.random() * 1000)}`,
                postId: `post_${Math.floor(Math.random() * 100)}`,
                shardId: Math.floor(Math.random() * 10),
                source: 'old_database',
                destination: 'new_database',
                metadata: {
                    priority: Math.floor(Math.random() * 3) + 1,
                    batchId: `batch_${Math.floor(Math.random() * 5)}`,
                    commentType: ['text', 'image', 'video', 'audio'][Math.floor(Math.random() * 4)],
                },
            };
            let retries = 0;
            let id = null;
            while (retries < shared_1.MAX_SEND_RETRIES && id === null) {
                try {
                    id = await this.sendCommentCopyRequest(payload);
                }
                catch (error) {
                    retries++;
                    this.logger.warn(`Failed to send message (attempt ${retries}/${shared_1.MAX_SEND_RETRIES}): ${error.message}`);
                    if (retries < shared_1.MAX_SEND_RETRIES) {
                        await new Promise(resolve => setTimeout(resolve, shared_1.MESSAGE_SEND_DELAY * retries));
                    }
                }
            }
            if (id) {
                ids.push(id);
            }
            else {
                this.logger.error(`Failed to send message after ${shared_1.MAX_SEND_RETRIES} attempts`);
            }
            await new Promise(resolve => setTimeout(resolve, shared_1.MESSAGE_SEND_DELAY));
        }
        return ids;
    }
};
exports.ProducerService = ProducerService;
exports.ProducerService = ProducerService = ProducerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [rabbitmq_adapter_1.RabbitMQService,
        config_1.ConfigService])
], ProducerService);
//# sourceMappingURL=producer.service.js.map