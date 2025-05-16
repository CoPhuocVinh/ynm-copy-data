"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rabbitmq_adapter_1 = require("../../../libs/rabbitmq-adapter");
const producer_service_1 = require("./producer/producer.service");
const consumer_service_1 = require("./consumer/consumer.service");
const path = require("path");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: path.resolve(process.cwd(), 'env.yaml'),
                load: [
                    () => {
                        const fs = require('fs');
                        const yaml = require('js-yaml');
                        try {
                            return yaml.load(fs.readFileSync(path.resolve(process.cwd(), 'env.yaml'), 'utf8'));
                        }
                        catch (e) {
                            console.error(e);
                            return {};
                        }
                    },
                ],
            }),
            rabbitmq_adapter_1.RabbitMQModule.registerAsync({
                useFactory: (configService) => {
                    return {
                        config: {
                            hostname: configService.get('rabbitmq.host'),
                            port: configService.get('rabbitmq.port'),
                            username: configService.get('rabbitmq.username'),
                            password: configService.get('rabbitmq.password'),
                            vhost: configService.get('rabbitmq.vhost'),
                            heartbeat: configService.get('rabbitmq.heartbeat'),
                            frameMax: configService.get('rabbitmq.frameMax'),
                        },
                        queues: [
                            {
                                name: configService.get('queue.docs.name'),
                                options: {
                                    durable: configService.get('queue.docs.durable'),
                                    autoDelete: configService.get('queue.docs.autoDelete'),
                                    arguments: {
                                        'x-queue-type': configService.get('queue.docs.type')
                                    }
                                },
                            },
                        ],
                    };
                },
                inject: [config_1.ConfigService],
            }),
        ],
        providers: [producer_service_1.ProducerService, consumer_service_1.ConsumerService],
        exports: [producer_service_1.ProducerService, consumer_service_1.ConsumerService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map