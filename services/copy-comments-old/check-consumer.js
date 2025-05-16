const amqp = require('amqplib');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

async function checkRabbitMQ() {
  try {
    // Read config
    const configPath = path.resolve(process.cwd(), 'env.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    console.log('Config loaded:', JSON.stringify(config, null, 2));
    
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
    
    // Check if queue exists
    const queueInfo = await channel.assertQueue(queueName, { 
      durable: true,
      autoDelete: false 
    });
    console.log(`Queue ${queueName} exists with ${queueInfo.messageCount} messages`);
    
    // Try to get one message but don't consume it
    console.log(`Trying to check a message from queue ${queueName}...`);
    const message = await channel.get(queueName, { noAck: true });
    
    if (message) {
      console.log('Got a message:');
      const content = message.content.toString();
      console.log(content);
    } else {
      console.log('No messages in queue');
    }
    
    // Close connection
    await channel.close();
    await connection.close();
    console.log('Connection closed');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

checkRabbitMQ(); 