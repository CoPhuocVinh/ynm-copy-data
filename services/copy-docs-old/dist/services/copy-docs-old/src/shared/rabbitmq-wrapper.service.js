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
var RabbitMQWrapperService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQWrapperService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const amqp = require('amqplib');
let RabbitMQWrapperService = RabbitMQWrapperService_1 = class RabbitMQWrapperService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(RabbitMQWrapperService_1.name);
        this.initialized = false;
    }
    async onModuleInit() {
        await this.initialize();
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            const host = this.configService.get('rabbitmq.host');
            const port = this.configService.get('rabbitmq.port');
            const username = this.configService.get('rabbitmq.username');
            const password = this.configService.get('rabbitmq.password');
            const vhost = this.configService.get('rabbitmq.vhost') || '/';
            this.logger.log(`Connecting to RabbitMQ at ${host}:${port}`);
            const connectionUrl = `amqp://${username}:${password}@${host}:${port}/${encodeURIComponent(vhost)}`;
            this.connection = await amqp.connect(connectionUrl);
            this.channel = await this.connection.createChannel();
            const queueName = this.configService.get('queue.docs.name');
            const durable = this.configService.get('queue.docs.durable');
            const autoDelete = this.configService.get('queue.docs.autoDelete');
            const queueType = this.configService.get('queue.docs.type');
            await this.channel.assertQueue(queueName, {
                durable: durable,
                autoDelete: autoDelete,
                arguments: {
                    'x-queue-type': queueType
                }
            });
            this.logger.log(`Queue ${queueName} asserted successfully with type ${queueType}`);
            this.initialized = true;
            this.connection.on('error', (err) => {
                this.logger.error(`RabbitMQ connection error: ${err.message}`);
                this.initialized = false;
            });
            this.connection.on('close', () => {
                this.logger.warn('RabbitMQ connection closed');
                this.initialized = false;
            });
            this.channel.on('error', (err) => {
                this.logger.error(`RabbitMQ channel error: ${err.message}`);
            });
            this.channel.on('close', () => {
                this.logger.warn('RabbitMQ channel closed');
            });
        }
        catch (error) {
            this.logger.error(`Failed to initialize RabbitMQ: ${error.message}`);
            throw error;
        }
    }
    async sendToQueue(queue, content, options) {
        if (!this.initialized) {
            await this.initialize();
        }
        try {
            return this.channel.sendToQueue(queue, content, {
                persistent: true,
                ...options,
            });
        }
        catch (error) {
            this.logger.error(`Failed to send message to queue ${queue}: ${error.message}`);
            throw error;
        }
    }
    async consume(queue, callback, options) {
        if (!this.initialized) {
            await this.initialize();
        }
        try {
            const { consumerTag } = await this.channel.consume(queue, callback, options);
            return consumerTag;
        }
        catch (error) {
            this.logger.error(`Failed to start consumer on queue ${queue}: ${error.message}`);
            throw error;
        }
    }
    ack(msg, allUpTo = false) {
        this.channel.ack(msg, allUpTo);
    }
    nack(msg, allUpTo = false, requeue = true) {
        this.channel.nack(msg, allUpTo, requeue);
    }
    async close() {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
        this.initialized = false;
    }
};
exports.RabbitMQWrapperService = RabbitMQWrapperService;
exports.RabbitMQWrapperService = RabbitMQWrapperService = RabbitMQWrapperService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RabbitMQWrapperService);
//# sourceMappingURL=rabbitmq-wrapper.service.js.map