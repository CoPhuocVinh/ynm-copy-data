import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConsumerService } from './consumer.service';
import * as path from 'path';
import { LibRabbitMQModule } from '../shared/lib-rabbitmq.module';

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
    LibRabbitMQModule,
  ],
  providers: [ConsumerService],
  exports: [ConsumerService],
})
export class ConsumerModule {} 