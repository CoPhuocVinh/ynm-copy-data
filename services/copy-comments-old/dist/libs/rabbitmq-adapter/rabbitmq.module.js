"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RabbitMQModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rabbitmq_service_1 = require("./rabbitmq.service");
const rabbitmq_config_1 = require("./rabbitmq.config");
let RabbitMQModule = RabbitMQModule_1 = class RabbitMQModule {
    static register(options) {
        return {
            module: RabbitMQModule_1,
            providers: [
                {
                    provide: rabbitmq_service_1.RabbitMQService,
                    useFactory: (configService) => {
                        return new rabbitmq_service_1.RabbitMQService(configService, options);
                    },
                    inject: [config_1.ConfigService],
                },
            ],
            exports: [rabbitmq_service_1.RabbitMQService],
        };
    }
    static registerAsync(options) {
        const provider = {
            provide: rabbitmq_service_1.RabbitMQService,
            useFactory: async (configService, ...args) => {
                const moduleOptions = await options.useFactory(...args);
                return new rabbitmq_service_1.RabbitMQService(configService, moduleOptions);
            },
            inject: [config_1.ConfigService, ...(options.inject || [])],
        };
        return {
            module: RabbitMQModule_1,
            providers: [provider],
            exports: [rabbitmq_service_1.RabbitMQService],
        };
    }
};
exports.RabbitMQModule = RabbitMQModule;
exports.RabbitMQModule = RabbitMQModule = RabbitMQModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forFeature(rabbitmq_config_1.rabbitMQConfig),
        ],
        providers: [rabbitmq_service_1.RabbitMQService],
        exports: [rabbitmq_service_1.RabbitMQService],
    })
], RabbitMQModule);
//# sourceMappingURL=rabbitmq.module.js.map