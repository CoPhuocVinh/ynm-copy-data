import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQWrapperService } from './rabbitmq-wrapper.service';

@Global()
@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    RabbitMQWrapperService,
  ],
  exports: [
    RabbitMQWrapperService,
  ],
})
export class SharedRabbitMQModule {} 