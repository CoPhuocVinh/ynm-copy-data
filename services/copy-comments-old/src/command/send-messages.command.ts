import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { ProducerService } from '../producer/producer.service';
import { ConsumerService } from '../consumer/consumer.service';

interface SendMessagesCommandOptions {
  count: number;
}

@Injectable()
@Command({ name: 'send-messages', description: 'Send test messages to the queue' })
export class SendMessagesCommand extends CommandRunner {
  constructor(
    private readonly producerService: ProducerService,
    private readonly consumerService: ConsumerService,
  ) {
    super();
  }

  async run(
    passedParams: string[],
    options?: SendMessagesCommandOptions,
  ): Promise<void> {
    const count = options?.count || 5;
    console.log(`Sending ${count} test messages to the queue...`);
    
    try {
      const messageIds = await this.producerService.sendSampleBatchRequests(count);
      console.log(`Successfully sent ${messageIds.length} messages with IDs:`);
      messageIds.forEach(id => console.log(`- ${id}`));
      
      // Display consumer stats
      const stats = this.consumerService.getProcessingStats();
      console.log(`\nConsumer stats:`);
      console.log(`- Processed: ${stats.processed}`);
      console.log(`- Failed: ${stats.failed}`);
      console.log(`- Last processed: ${stats.lastProcessedTime}`);
      
    } catch (error) {
      console.error(`Failed to send messages: ${error.message}`);
    }
  }

  @Option({
    flags: '-c, --count [number]',
    description: 'Number of messages to send',
  })
  parseCount(val: string): number {
    return Number(val);
  }
} 