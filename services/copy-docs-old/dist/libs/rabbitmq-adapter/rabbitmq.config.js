"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rabbitMQConfig = exports.loadConfig = void 0;
const config_1 = require("@nestjs/config");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const loadConfig = (envFilePath = 'env.yaml') => {
    try {
        const yamlConfig = yaml.load(fs.readFileSync(path.resolve(process.cwd(), envFilePath), 'utf8'));
        return yamlConfig;
    }
    catch (error) {
        console.error(`Error loading configuration from ${envFilePath}:`, error);
        return {};
    }
};
exports.loadConfig = loadConfig;
exports.rabbitMQConfig = (0, config_1.registerAs)('rabbitmq', () => {
    const config = (0, exports.loadConfig)();
    return {
        hostname: process.env.RABBITMQ_HOST || config.rabbitmq?.host || 'localhost',
        port: parseInt(process.env.RABBITMQ_PORT || config.rabbitmq?.port || '5672', 10),
        username: process.env.RABBITMQ_USERNAME || config.rabbitmq?.username || 'guest',
        password: process.env.RABBITMQ_PASSWORD || config.rabbitmq?.password || 'guest',
        vhost: process.env.RABBITMQ_VHOST || config.rabbitmq?.vhost || '/',
        heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || config.rabbitmq?.heartbeat || '0', 10),
        frameMax: parseInt(process.env.RABBITMQ_FRAME_MAX || config.rabbitmq?.frameMax || '0', 10),
    };
});
//# sourceMappingURL=rabbitmq.config.js.map