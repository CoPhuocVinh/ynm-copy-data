const amqp = require('amqplib');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

async function sendTestMessage() {
  try {
    // Read config
    const configPath = path.resolve(process.cwd(), 'env.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    // Extract RabbitMQ config
    const host = config.rabbitmq.host;
    const port = config.rabbitmq.port;
    const username = config.rabbitmq.username;
    const password = config.rabbitmq.password;
    const vhost = config.rabbitmq.vhost || '/';
    const queueName = config.queue.comments.name;
    
    console.log(`Connecting to RabbitMQ at ${host}:${port}...`);
    
    // Connect to RabbitMQ
    const connectionUrl = `amqp://${username}:${password}@${host}:${port}/${encodeURIComponent(vhost)}`;
    const connection = await amqp.connect(connectionUrl);
    console.log('Connected to RabbitMQ successfully');
    
    // Create a channel
    const channel = await connection.createChannel();
    console.log('Created channel successfully');
    
    // Ensure queue exists
    await channel.assertQueue(queueName, { 
      durable: true,
      autoDelete: false 
    });
    
    // Create a test message
    const testMessage = {
      id: `test-${Date.now()}`,
      commentId: 'comment_test_123',
      postId: 'post_456',
      shardId: 1,
      source: 'test_source',
      destination: 'test_destination',
      timestamp: Date.now(),
      metadata: {
        testRun: true,
        createdBy: 'test-script'
      }
    };
    
    // Send the message
    const messageContent = Buffer.from(JSON.stringify(testMessage));
    const sent = await channel.sendToQueue(queueName, messageContent, {
      persistent: true,
      messageId: `msg-${Date.now()}`
    });
    
    console.log(`Message sent: ${sent}`);
    console.log('Message content:', JSON.stringify(testMessage, null, 2));
    
    // Close connection
    await channel.close();
    await connection.close();
    console.log('Connection closed');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

sendTestMessage(); 