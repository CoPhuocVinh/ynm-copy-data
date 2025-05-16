"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('app.port') || 3003;
    await app.listen(port);
    logger.log(`Application ${configService.get('app.name')} is running on port ${port}`);
    logger.log(`Connected to RabbitMQ at ${configService.get('rabbitmq.host')}:${configService.get('rabbitmq.port')}`);
    logger.log(`Listening to queue: ${configService.get('queue.docs.name')}`);
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
        process.on(signal, async () => {
            logger.log(`Received ${signal}, gracefully shutting down...`);
            await app.close();
            process.exit(0);
        });
    });
}
bootstrap().catch(err => {
    console.error('Error during bootstrap:', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map