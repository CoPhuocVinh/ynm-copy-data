const amqp = require('amqplib');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// Load configuration from env.yaml
function loadConfig() {
  try {
    const configPath = path.resolve(__dirname, '../../env.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    return yaml.load(fileContents);
  } catch (err) {
    console.error('Error loading config:', err);
    process.exit(1);
  }
}

// Create a connection to RabbitMQ
async function connectToRabbitMQ(config) {
  const { host, port, username, password, vhost } = config.rabbitmq;
  const connectionString = `amqp://${username}:${password}@${host}:${port}${vhost}`;
  
  console.log(`Connecting to RabbitMQ at ${host}:${port}...`);
  return await amqp.connect(connectionString);
}

// Check queue status
async function checkQueue() {
  const config = loadConfig();
  const queueName = config.queue.comments.name;
  
  let connection;
  let channel;
  
  try {
    // Connect to RabbitMQ
    connection = await connectToRabbitMQ(config);
    channel = await connection.createChannel();
    
    // Check queue info
    const queueInfo = await channel.assertQueue(queueName, {
      durable: config.queue.comments.durable,
      autoDelete: config.queue.comments.autoDelete,
    });
    
    console.log(`\nQueue ${queueName} status:`);
    console.log(`- Messages in queue: ${queueInfo.messageCount}`);
    console.log(`- Consumers connected: ${queueInfo.consumerCount}`);
    
    if (queueInfo.consumerCount === 0) {
      console.log(`\nWARNING: No consumers are connected to the queue!`);
    } else {
      console.log(`\nGood! ${queueInfo.consumerCount} consumer(s) connected and processing messages.`);
    }
    
    if (queueInfo.messageCount > 0) {
      console.log(`\nThere are still ${queueInfo.messageCount} messages waiting to be processed.`);
    } else {
      console.log(`\nAll messages have been processed!`);
    }
    
  } catch (error) {
    console.error(`Error checking queue: ${error.message}`);
  } finally {
    // Close connection
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('\nConnection closed');
  }
}

// Run the function
checkQueue().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 