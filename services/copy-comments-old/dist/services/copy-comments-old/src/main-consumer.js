"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const consumer_service_1 = require("./consumer/consumer.service");
const consumer_module_1 = require("./consumer/consumer.module");
async function bootstrap() {
    const logger = new common_1.Logger('ConsumerBootstrap');
    const app = await core_1.NestFactory.create(consumer_module_1.ConsumerModule);
    const configService = app.get(config_1.ConfigService);
    const consumerService = app.get(consumer_service_1.ConsumerService);
    await consumerService.initialize();
    logger.log(`Consumer service ${configService.get('app.name')} is running`);
    logger.log(`Connected to RabbitMQ at ${configService.get('rabbitmq.host')}:${configService.get('rabbitmq.port')}`);
    logger.log(`Listening to queue: ${configService.get('queue.comments.name')}`);
    await app.listen(0);
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
        process.on(signal, async () => {
            logger.log(`Received ${signal}, gracefully shutting down...`);
            await consumerService.shutdown();
            await app.close();
            process.exit(0);
        });
    });
}
bootstrap().catch(err => {
    console.error('Error during bootstrap:', err);
    process.exit(1);
});
//# sourceMappingURL=main-consumer.js.map