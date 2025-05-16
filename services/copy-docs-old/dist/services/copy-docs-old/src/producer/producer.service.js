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
const rabbitmq_wrapper_service_1 = require("../shared/rabbitmq-wrapper.service");
let ProducerService = ProducerService_1 = class ProducerService {
    constructor(rabbitMQService, configService) {
        this.rabbitMQService = rabbitMQService;
        this.configService = configService;
        this.logger = new common_1.Logger(ProducerService_1.name);
        this.queueName = this.configService.get('queue.docs.name');
    }
    async sendDocCopyRequest(payload) {
        try {
            const id = (0, uuid_1.v4)();
            const message = {
                id,
                ...payload,
                timestamp: Date.now(),
            };
            this.logger.log(`Sending document copy request: ${JSON.stringify(message)}`);
            const success = await this.rabbitMQService.sendToQueue(this.queueName, Buffer.from(JSON.stringify(message)), {
                contentType: 'application/json',
                messageId: id,
            });
            if (!success) {
                throw new Error('Failed to send message to queue');
            }
            this.logger.log(`Document copy request sent successfully with ID: ${id}`);
            return id;
        }
        catch (error) {
            this.logger.error(`Error sending document copy request: ${error.message}`);
            throw error;
        }
    }
    async sendSampleBatchRequests(count = 5) {
        const ids = [];
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
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return ids;
    }
};
exports.ProducerService = ProducerService;
exports.ProducerService = ProducerService = ProducerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [rabbitmq_wrapper_service_1.RabbitMQWrapperService,
        config_1.ConfigService])
], ProducerService);
//# sourceMappingURL=producer.service.js.map