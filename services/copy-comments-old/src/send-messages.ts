import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ProducerService } from './producer/producer.service';
import { Logger } from '@nestjs/common';

async function sendMessages() {
  const logger = new Logger('MessageSender');
  
  // Number of messages to send (default: 5, can be overridden by command line)
  const count = process.argv.length > 2 ? parseInt(process.argv[2], 10) : 5;
  
  logger.log(`Preparing to send ${count} test messages...`);
  
  // Create a standalone application context
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Get the ProducerService
    const producerService = app.get(ProducerService);
    
    // Send batch of test messages
    logger.log(`Sending ${count} test messages...`);
    const messageIds = await producerService.sendSampleBatchRequests(count);
    
    // Log the results
    logger.log(`Successfully sent ${messageIds.length} messages with IDs:`);
    messageIds.forEach(id => logger.log(`- ${id}`));
    
  } catch (error) {
    logger.error(`Failed to send messages: ${error.message}`);
  } finally {
    // Close the application context
    await app.close();
  }
}

// Run the function
sendMessages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 