const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
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

// Send test messages to the queue
async function sendMessages() {
  // Get message count from command line
  const count = process.argv.length > 2 ? parseInt(process.argv[2], 10) : 5;
  
  console.log(`Preparing to send ${count} test messages...`);
  
  const config = loadConfig();
  const queueName = config.queue.comments.name;
  
  let connection;
  let channel;
  
  try {
    // Connect to RabbitMQ
    connection = await connectToRabbitMQ(config);
    channel = await connection.createChannel();
    
    // Assert the queue
    await channel.assertQueue(queueName, {
      durable: config.queue.comments.durable,
      autoDelete: config.queue.comments.autoDelete,
    });
    
    console.log(`Queue ${queueName} asserted successfully`);
    
    // Send messages
    const messageIds = [];
    
    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      const payload = {
        id,
        commentId: `comment_${Math.floor(Math.random() * 1000)}`,
        postId: `post_${Math.floor(Math.random() * 100)}`,
        shardId: Math.floor(Math.random() * 10),
        source: 'old_database',
        destination: 'new_database',
        timestamp: Date.now(),
        metadata: {
          priority: Math.floor(Math.random() * 3) + 1,
          batchId: `batch_${Math.floor(Math.random() * 5)}`,
        },
      };
      
      const messageBuffer = Buffer.from(JSON.stringify(payload));
      
      await channel.sendToQueue(queueName, messageBuffer, {
        contentType: 'application/json',
        persistent: true,
        messageId: id,
      });
      
      messageIds.push(id);
      console.log(`Sent message with ID: ${id}`);
      
      // Add a small delay between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\nSuccessfully sent ${messageIds.length} messages.`);
    
  } catch (error) {
    console.error(`Error sending messages: ${error.message}`);
  } finally {
    // Close connection
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('Connection closed');
  }
}

// Run the function
sendMessages().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 