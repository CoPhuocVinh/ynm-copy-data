import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@libs/rabbitmq-adapter';
import { ProducerService } from './producer/producer.service';
import { ConsumerService } from './consumer/consumer.service';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), 'env.yaml'),
      load: [
        () => {
          const fs = require('fs');
          const yaml = require('js-yaml');
          try {
            return yaml.load(fs.readFileSync(path.resolve(process.cwd(), 'env.yaml'), 'utf8'));
          } catch (e) {
            console.error(e);
            return {};
          }
        },
      ],
    }),
    RabbitMQModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        return {
          config: {
            hostname: configService.get<string>('rabbitmq.host'),
            port: configService.get<number>('rabbitmq.port'),
            username: configService.get<string>('rabbitmq.username'),
            password: configService.get<string>('rabbitmq.password'),
            vhost: configService.get<string>('rabbitmq.vhost'),
            heartbeat: configService.get<number>('rabbitmq.heartbeat'),
            frameMax: configService.get<number>('rabbitmq.frameMax'),
          },
          queues: [
            {
              name: configService.get<string>('queue.docs.name'),
              options: {
                durable: configService.get<boolean>('queue.docs.durable'),
                autoDelete: configService.get<boolean>('queue.docs.autoDelete'),
                arguments: {
                  'x-queue-type': configService.get<string>('queue.docs.type')
                }
              },
            },
          ],
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [ProducerService, ConsumerService],
  exports: [ProducerService, ConsumerService],
})
export class AppModule {} 