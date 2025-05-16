import { Module, Global } from '@nestjs/common';
import { RabbitMQModule, RabbitMQService } from '@libs/rabbitmq-adapter';

/**
 * This module re-exports the RabbitMQModule and RabbitMQService from @libs/rabbitmq-adapter library.
 */
@Global()
@Module({
  imports: [RabbitMQModule],
  providers: [],
  exports: [RabbitMQModule],
})
export class SharedRabbitMQModule {} 