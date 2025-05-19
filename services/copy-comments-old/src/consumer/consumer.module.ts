import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsumerService } from './consumer.service';
import * as path from 'path';
import { RabbitMQModule } from '@libs/core/adapter/rabbitmq-adapter';

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
          },
          queues: [
            {
              name: configService.get<string>('queue.comments.name'),
              options: {
                durable: configService.get<boolean>('queue.comments.durable'),
                autoDelete: configService.get<boolean>('queue.comments.autoDelete'),
              },
              prefetchCount: configService.get<number>('queue.comments.prefetchCount') || 1,
            },
          ],
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [ConsumerService],
  exports: [ConsumerService],
})
export class ConsumerModule {}
