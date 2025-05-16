"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const producer_service_1 = require("./producer/producer.service");
const producer_module_1 = require("./producer/producer.module");
async function bootstrap() {
    const logger = new common_1.Logger('ProducerBootstrap');
    const app = await core_1.NestFactory.create(producer_module_1.ProducerModule);
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('app.port') || 3002;
    const producerService = app.get(producer_service_1.ProducerService);
    const autoSendInterval = 10000;
    const messageCount = 5;
    logger.log(`Automatic message sending enabled - will send ${messageCount} messages every ${autoSendInterval / 1000} seconds`);
    const intervalId = setInterval(async () => {
        try {
            logger.log(`Auto-sending ${messageCount} messages...`);
            const ids = await producerService.sendSampleBatchRequests(messageCount);
            logger.log(`Successfully sent ${ids.length} messages. Message IDs: ${ids.join(', ')}`);
        }
        catch (error) {
            logger.error(`Error in automatic message sending: ${error.message}`);
        }
    }, autoSendInterval);
    await app.listen(port);
    logger.log(`Producer service ${configService.get('app.name')} is running on port ${port}`);
    logger.log(`Connected to RabbitMQ at ${configService.get('rabbitmq.host')}:${configService.get('rabbitmq.port')}`);
    logger.log(`Automatic message sending is active - sending ${messageCount} messages every ${autoSendInterval / 1000} seconds`);
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
        process.on(signal, async () => {
            logger.log(`Received ${signal}, gracefully shutting down...`);
            clearInterval(intervalId);
            await producerService.shutdown();
            await app.close();
            process.exit(0);
        });
    });
}
bootstrap().catch(err => {
    console.error('Error during bootstrap:', err);
    process.exit(1);
});
//# sourceMappingURL=main-producer.js.map