import { Module } from '@nestjs/common';
import { SendMessagesCommand } from './send-messages.command';
import { ProducerService } from '../producer/producer.service';
import { ConsumerService } from '../consumer/consumer.service';

@Module({
  providers: [SendMessagesCommand, ProducerService, ConsumerService],
  exports: [SendMessagesCommand],
})
export class CommandModule {} 