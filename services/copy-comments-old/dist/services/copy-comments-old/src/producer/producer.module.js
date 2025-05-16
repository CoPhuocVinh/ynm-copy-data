"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProducerModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const producer_service_1 = require("./producer.service");
const path = require("path");
const rabbitmq_adapter_1 = require("@libs/rabbitmq-adapter");
let ProducerModule = class ProducerModule {
};
exports.ProducerModule = ProducerModule;
exports.ProducerModule = ProducerModule = __decorate([
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
                        },
                        queues: [
                            {
                                name: configService.get('queue.comments.name'),
                                options: {
                                    durable: configService.get('queue.comments.durable'),
                                    autoDelete: configService.get('queue.comments.autoDelete'),
                                },
                            },
                        ],
                    };
                },
                inject: [config_1.ConfigService],
            }),
        ],
        providers: [producer_service_1.ProducerService],
        exports: [producer_service_1.ProducerService],
    })
], ProducerModule);
//# sourceMappingURL=producer.module.js.map