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
var RabbitMQService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQService = exports.AckMode = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const amqplib = require("amqplib");
var AckMode;
(function (AckMode) {
    AckMode["PRE_PROCESS"] = "pre_process";
    AckMode["POST_PROCESS"] = "post_process";
    AckMode["BEST_EFFORT"] = "best_effort";
})(AckMode || (exports.AckMode = AckMode = {}));
let RabbitMQService = RabbitMQService_1 = class RabbitMQService {
    constructor(configService, options) {
        this.configService = configService;
        this.logger = new common_1.Logger(RabbitMQService_1.name);
        this.queues = [];
        this.exchanges = [];
        this.bindings = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 30;
        this.reconnectTimeout = 1000;
        this.isReconnecting = false;
        this.consumerTags = new Map();
        this.consumers = new Map();
        this.consumerOptions = new Map();
        this.defaultAckMode = AckMode.BEST_EFFORT;
        this.consumerAckModes = new Map();
        this._channelId = 0;
        this.config = options?.config || this.configService.get('rabbitmq');
        if (options?.queues)
            this.queues = options.queues;
        if (options?.exchanges)
            this.exchanges = options.exchanges;
        if (options?.bindings)
            this.bindings = options.bindings;
        const { hostname, port, username, password, vhost } = this.config;
        this.connectionString = `amqp://${username}:${password}@${hostname}:${port}/${encodeURIComponent(vhost || '/')}`;
    }
    get connection() {
        return this._connection;
    }
    get channel() {
        return this._channel;
    }
    isChannelValid() {
        return Boolean(this._connection && this._channel && this._channel.connection);
    }
    async ensureChannel() {
        if (!this.isChannelValid()) {
            try {
                await this.createChannel();
                await this.restoreConsumers();
                return true;
            }
            catch (error) {
                this.logger.error(`Failed to ensure channel: ${error.message}`);
                return false;
            }
        }
        return true;
    }
    async restoreConsumers() {
        if (!this.isChannelValid()) {
            this.logger.warn('Cannot restore consumers: channel not available');
            return;
        }
        this.consumerTags.clear();
        for (const [queue, callback] of this.consumers.entries()) {
            const options = this.consumerOptions.get(queue) || {};
            const mode = this.consumerAckModes.get(queue) || this.defaultAckMode;
            try {
                this.logger.log(`Restoring consumer for queue: ${queue} with ackMode: ${mode}`);
                const queueConfig = this.queues.find(q => q.name === queue);
                if (queueConfig && queueConfig.prefetchCount !== undefined) {
                    this.logger.debug(`Setting prefetch count for queue ${queue} to ${queueConfig.prefetchCount} during restore`);
                    await this._channel.prefetch(queueConfig.prefetchCount);
                }
                const consumerTag = await this.consume(queue, callback, options, mode);
                this.logger.log(`Consumer restored for queue ${queue} with tag ${consumerTag}`);
            }
            catch (error) {
                this.logger.error(`Failed to restore consumer for queue ${queue}: ${error.message}`);
                setTimeout(async () => {
                    try {
                        await this.ensureChannel();
                        const consumerTag = await this.consume(queue, callback, options, mode);
                        this.logger.log(`Consumer restored for queue ${queue} with tag ${consumerTag} (delayed)`);
                    }
                    catch (retryError) {
                        this.logger.error(`Failed to restore consumer for queue ${queue} even after retry: ${retryError.message}`);
                    }
                }, 1000);
            }
        }
    }
    async onModuleInit() {
        await this.connect();
        await this.createChannel();
        await this.setupInitialTopology();
    }
    async onModuleDestroy() {
        await this.close();
    }
    async connect() {
        try {
            const { hostname, port, username, vhost } = this.config;
            this.logger.log(`Connecting to RabbitMQ at ${hostname}:${port} with username ${username} and vhost ${vhost || '/'}`);
            try {
                this._connection = await amqplib.connect(this.connectionString);
                this.reconnectAttempts = 0;
                this.bindConnectionListeners();
                this.logger.log('Successfully connected to RabbitMQ');
            }
            catch (connError) {
                this.logger.error(`Failed to connect to RabbitMQ: ${connError.message}`);
                if (connError.message.includes('ECONNREFUSED')) {
                    this.logger.error(`RabbitMQ connection refused - check if the RabbitMQ server is running at ${hostname}:${port}`);
                }
                else if (connError.message.includes('ETIMEDOUT')) {
                    this.logger.error(`RabbitMQ connection timeout - check network connectivity to ${hostname}:${port}`);
                }
                else if (connError.message.includes('auth')) {
                    this.logger.error('RabbitMQ authentication failed - check username and password');
                }
                throw connError;
            }
        }
        catch (error) {
            this.logger.error(`RabbitMQ connection error: ${error.message}`);
            if (error.stack) {
                this.logger.error(`Stack trace: ${error.stack}`);
            }
            await this.handleReconnect();
            throw error;
        }
    }
    bindConnectionListeners() {
        this._connection.on('error', (err) => {
            this.logger.error(`RabbitMQ connection error: ${err.message}`);
            if (err.message !== 'Connection closing') {
                this.handleReconnect();
            }
        });
        this._connection.on('close', async () => {
            this.logger.warn('RabbitMQ connection closed');
            await this.handleReconnect();
        });
    }
    async handleReconnect() {
        if (this.isReconnecting) {
            this.logger.log('Reconnection already in progress, skipping');
            return;
        }
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
            return;
        }
        this.isReconnecting = true;
        this.reconnectAttempts++;
        const timeout = Math.min(this.reconnectTimeout * Math.pow(2, Math.min(this.reconnectAttempts - 1, 10)), 30000);
        this.logger.log(`Attempting to reconnect in ${timeout}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(async () => {
            try {
                await this.connect();
                await this.createChannel();
                await this.setupInitialTopology();
                await this.restoreConsumers();
                this.isReconnecting = false;
            }
            catch (error) {
                this.logger.error(`Error during reconnect: ${error.message}`);
                this.isReconnecting = false;
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.handleReconnect();
                }
            }
        }, timeout);
    }
    async createChannel() {
        try {
            if (!this._connection) {
                this.logger.warn('Cannot create channel: No connection available');
                await this.connect();
            }
            this._channel = await this._connection.createChannel();
            this._channelId++;
            const defaultPrefetchCount = 1;
            let prefetchCount = defaultPrefetchCount;
            if (this.queues && this.queues.length > 0) {
                for (const queue of this.queues) {
                    if (queue.prefetchCount && queue.prefetchCount > prefetchCount) {
                        prefetchCount = queue.prefetchCount;
                    }
                }
            }
            this.logger.debug(`Setting prefetch count to ${prefetchCount}`);
            this._channel.prefetch(prefetchCount);
            this.bindChannelListeners();
            this.logger.log('Successfully created RabbitMQ channel');
        }
        catch (error) {
            this.logger.error(`Failed to create RabbitMQ channel: ${error.message}`);
            throw error;
        }
    }
    bindChannelListeners() {
        this._channel.on('error', (error) => {
            this.logger.error(`Channel error: ${error.message}`);
            if (error.message.includes('PRECONDITION_FAILED') ||
                error.message.includes('unknown delivery tag')) {
                this._channel = null;
                this.logger.warn('Channel marked as invalid due to delivery tag error');
            }
        });
        this._channel.on('close', () => {
            this.logger.warn('Channel closed - will recreate on next operation');
            this._channel = null;
        });
        this._channel.on('return', (msg) => {
            this.logger.warn(`Message was returned: ${msg.fields.replyText}`);
        });
        this._channel.on('drain', () => {
            this.logger.debug('Channel drain event received');
        });
    }
    async setupInitialTopology() {
        try {
            if (!this._channel) {
                await this.createChannel();
            }
            for (const exchange of this.exchanges) {
                await this.assertExchange(exchange.name, exchange.type, exchange.options);
            }
            for (const queue of this.queues) {
                await this.assertQueue(queue.name, queue.options);
            }
            for (const binding of this.bindings) {
                await this.bindQueue(binding.queue, binding.exchange, binding.routingKey, binding.options);
            }
            this.logger.log('Initial RabbitMQ topology setup completed');
        }
        catch (error) {
            this.logger.error(`Error setting up initial topology: ${error.message}`);
            throw error;
        }
    }
    async assertQueue(queue, options) {
        try {
            if (!this._channel) {
                await this.createChannel();
            }
            this.logger.debug(`Asserting queue: ${queue}`);
            await this._channel.assertQueue(queue, options);
            this.logger.debug(`Queue asserted: ${queue}`);
        }
        catch (error) {
            this.logger.error(`Failed to assert queue ${queue}: ${error.message}`);
            throw error;
        }
    }
    async assertExchange(exchange, type, options) {
        try {
            if (!this._channel) {
                await this.createChannel();
            }
            this.logger.debug(`Asserting exchange: ${exchange} (${type})`);
            await this._channel.assertExchange(exchange, type, options);
            this.logger.debug(`Exchange asserted: ${exchange}`);
        }
        catch (error) {
            this.logger.error(`Failed to assert exchange ${exchange}: ${error.message}`);
            throw error;
        }
    }
    async bindQueue(queue, exchange, routingKey, options) {
        try {
            if (!this._channel) {
                await this.createChannel();
            }
            this.logger.debug(`Binding queue ${queue} to exchange ${exchange} with routing key ${routingKey}`);
            await this._channel.bindQueue(queue, exchange, routingKey, options);
            this.logger.debug(`Queue ${queue} bound to exchange ${exchange}`);
        }
        catch (error) {
            this.logger.error(`Failed to bind queue ${queue} to exchange ${exchange}: ${error.message}`);
            throw error;
        }
    }
    async consume(queue, callback, options, ackMode = this.defaultAckMode) {
        try {
            if (!await this.ensureChannel()) {
                throw new Error('Cannot ensure valid channel for consuming');
            }
            const queueConfig = this.queues.find(q => q.name === queue);
            if (queueConfig && queueConfig.prefetchCount !== undefined) {
                this.logger.debug(`Setting prefetch count for queue ${queue} to ${queueConfig.prefetchCount}`);
                await this._channel.prefetch(queueConfig.prefetchCount);
            }
            this.logger.debug(`Starting consumer on queue: ${queue} with ackMode: ${ackMode}`);
            this.consumers.set(queue, callback);
            if (options) {
                this.consumerOptions.set(queue, options);
            }
            this.consumerAckModes.set(queue, ackMode);
            const currentChannelId = this._channelId;
            const wrappedCallback = (msg) => {
                if (!msg) {
                    callback(null);
                    return;
                }
                if (ackMode === AckMode.PRE_PROCESS) {
                    try {
                        if (this.isChannelValid() && this._channelId === currentChannelId) {
                            this.logger.debug(`PRE_PROCESS: Acknowledging message ${msg.fields.deliveryTag} before processing`);
                            this._channel.ack(msg);
                            msg.__preAcknowledged = true;
                            msg.__channelId = currentChannelId;
                            callback(msg);
                        }
                        else {
                            this.logger.warn(`PRE_PROCESS: Cannot acknowledge message ${msg.fields.deliveryTag} - channel not valid or has changed`);
                            msg.__preAcknowledged = true;
                            msg.__channelId = currentChannelId;
                            callback(msg);
                        }
                    }
                    catch (error) {
                        this.logger.error(`Error in PRE_PROCESS acknowledge for queue ${queue}: ${error.message}`);
                        msg.__preAcknowledged = true;
                        msg.__channelId = currentChannelId;
                        this.createChannel().catch(err => {
                            this.logger.error(`Failed to recreate channel in PRE_PROCESS: ${err.message}`);
                        });
                        callback(msg);
                    }
                }
                else {
                    msg.__channelId = currentChannelId;
                    callback(msg);
                }
            };
            const { consumerTag } = await this._channel.consume(queue, wrappedCallback, options);
            this.consumerTags.set(queue, consumerTag);
            this.logger.debug(`Consumer started on queue ${queue} with tag ${consumerTag}`);
            return consumerTag;
        }
        catch (error) {
            this.logger.error(`Failed to start consumer on queue ${queue}: ${error.message}`);
            throw error;
        }
    }
    async cancelConsumer(queue) {
        try {
            if (!this._channel) {
                this.logger.warn(`Cannot cancel consumer for queue ${queue}: channel not available`);
                return;
            }
            const consumerTag = this.consumerTags.get(queue);
            if (!consumerTag) {
                this.logger.warn(`No consumer tag found for queue ${queue}`);
                return;
            }
            await this._channel.cancel(consumerTag);
            this.consumerTags.delete(queue);
            this.consumers.delete(queue);
            this.consumerOptions.delete(queue);
            this.logger.log(`Consumer canceled for queue ${queue}`);
        }
        catch (error) {
            this.logger.error(`Failed to cancel consumer for queue ${queue}: ${error.message}`);
        }
    }
    async publish(exchange, routingKey, content, options) {
        try {
            if (!await this.ensureChannel()) {
                throw new Error('Cannot ensure valid channel for publishing');
            }
            const result = this._channel.publish(exchange, routingKey, content, {
                persistent: true,
                ...options,
            });
            return result;
        }
        catch (error) {
            this.logger.error(`Failed to publish message to exchange ${exchange}: ${error.message}`);
            throw error;
        }
    }
    async sendToQueue(queue, content, options) {
        try {
            if (!await this.ensureChannel()) {
                throw new Error('Cannot ensure valid channel for sending to queue');
            }
            const result = this._channel.sendToQueue(queue, content, {
                persistent: true,
                ...options,
            });
            return result;
        }
        catch (error) {
            this.logger.error(`Failed to send message to queue ${queue}: ${error.message}`);
            throw error;
        }
    }
    ack(msg, allUpTo = false) {
        if (!msg) {
            this.logger.warn('Cannot acknowledge null message');
            return;
        }
        if (msg.__preAcknowledged) {
            this.logger.debug(`Message ${msg.fields.deliveryTag} was already pre-acknowledged`);
            return;
        }
        if (msg.__channelId !== undefined && msg.__channelId !== this._channelId) {
            this.logger.warn(`Cannot acknowledge message ${msg.fields.deliveryTag} - channel has changed since message was received`);
            return;
        }
        try {
            if (!this.isChannelValid()) {
                this.logger.warn(`Cannot acknowledge message (tag: ${msg.fields.deliveryTag}) - channel not available`);
                setTimeout(() => {
                    this.createChannel().catch(err => {
                        this.logger.error(`Failed to recreate channel during ack: ${err.message}`);
                        this.handleReconnect().catch(reconnectError => {
                            this.logger.error(`Reconnect failed during ack: ${reconnectError.message}`);
                        });
                    });
                }, 0);
                this.logger.error(`Channel not available for acknowledgement of message ${msg.fields.deliveryTag}`);
                return;
            }
            this.logger.debug(`Acknowledging message with tag: ${msg.fields.deliveryTag}, allUpTo: ${allUpTo}`);
            try {
                this._channel.ack(msg, allUpTo);
                this.logger.debug(`Successfully acknowledged message ${msg.fields.deliveryTag}`);
            }
            catch (innerError) {
                this.logger.error(`Direct channel error in ack: ${innerError.message}`);
                if (innerError.message.includes('channel closed') ||
                    innerError.message.includes('connection closed') ||
                    innerError.message.includes('unknown delivery tag')) {
                    this._channel = null;
                    setTimeout(() => {
                        this.handleReconnect().catch(reconnectError => {
                            this.logger.error(`Failed to reconnect after ack error: ${reconnectError.message}`);
                        });
                    }, 100);
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to acknowledge message ${msg.fields.deliveryTag}: ${error.message}`);
            if (error.message.includes('channel closed') ||
                error.message.includes('connection closed') ||
                error.message.includes('not available') ||
                error.message.includes('unknown delivery tag') ||
                !this._channel) {
                this.logger.warn('Connection issue detected during ack, attempting to reconnect...');
                this._channel = null;
                setTimeout(() => {
                    this.handleReconnect().catch(reconnectError => {
                        this.logger.error(`Failed to reconnect after ack error: ${reconnectError.message}`);
                    });
                }, 100);
            }
        }
    }
    nack(msg, allUpTo = false, requeue = true) {
        if (!msg) {
            this.logger.warn('Cannot negative-acknowledge null message');
            return;
        }
        if (msg.__preAcknowledged) {
            this.logger.debug(`Message ${msg.fields.deliveryTag} was already pre-acknowledged, cannot nack`);
            return;
        }
        if (msg.__channelId !== undefined && msg.__channelId !== this._channelId) {
            this.logger.warn(`Cannot negative-acknowledge message ${msg.fields.deliveryTag} - channel has changed since message was received`);
            return;
        }
        try {
            if (!this.isChannelValid()) {
                this.logger.warn(`Cannot negative-acknowledge message (tag: ${msg.fields.deliveryTag}) - channel not available`);
                setTimeout(() => {
                    this.createChannel().catch(err => {
                        this.logger.error(`Failed to recreate channel during nack: ${err.message}`);
                        this.handleReconnect().catch(reconnectError => {
                            this.logger.error(`Reconnect failed during nack: ${reconnectError.message}`);
                        });
                    });
                }, 0);
                this.logger.error(`Channel not available for negative acknowledgement of message ${msg.fields.deliveryTag}`);
                return;
            }
            this.logger.debug(`Negative-acknowledging message with tag: ${msg.fields.deliveryTag}, allUpTo: ${allUpTo}, requeue: ${requeue}`);
            try {
                this._channel.nack(msg, allUpTo, requeue);
                this.logger.debug(`Successfully negative-acknowledged message ${msg.fields.deliveryTag}`);
            }
            catch (innerError) {
                this.logger.error(`Direct channel error in nack: ${innerError.message}`);
                if (innerError.message.includes('channel closed') ||
                    innerError.message.includes('connection closed') ||
                    innerError.message.includes('unknown delivery tag')) {
                    this._channel = null;
                    setTimeout(() => {
                        this.handleReconnect().catch(reconnectError => {
                            this.logger.error(`Failed to reconnect after nack error: ${reconnectError.message}`);
                        });
                    }, 100);
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to negative-acknowledge message ${msg.fields.deliveryTag}: ${error.message}`);
            if (error.message.includes('channel closed') ||
                error.message.includes('connection closed') ||
                error.message.includes('not available') ||
                error.message.includes('unknown delivery tag') ||
                !this._channel) {
                this.logger.warn('Connection issue detected during nack, attempting to reconnect...');
                this._channel = null;
                setTimeout(() => {
                    this.handleReconnect().catch(reconnectError => {
                        this.logger.error(`Failed to reconnect after nack error: ${reconnectError.message}`);
                    });
                }, 100);
            }
        }
    }
    setDefaultAckMode(mode) {
        this.defaultAckMode = mode;
        this.logger.log(`Default ack mode set to: ${mode}`);
    }
    async close() {
        try {
            if (this._channel) {
                await this._channel.close();
                this.logger.log('RabbitMQ channel closed');
                this._channel = null;
            }
            if (this._connection) {
                await this._connection.close();
                this.logger.log('RabbitMQ connection closed');
                this._connection = null;
            }
        }
        catch (error) {
            this.logger.error(`Error closing RabbitMQ connections: ${error.message}`);
        }
    }
};
exports.RabbitMQService = RabbitMQService;
exports.RabbitMQService = RabbitMQService = RabbitMQService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService, Object])
], RabbitMQService);
//# sourceMappingURL=rabbitmq.service.js.map