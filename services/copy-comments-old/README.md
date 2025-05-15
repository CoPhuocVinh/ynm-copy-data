# Copy Comments Old Service

This service connects to RabbitMQ to copy old comments data. It demonstrates both producing messages to the queue and consuming messages from the queue.

## Configuration

The service is configured via the `env.yaml` file:

```yaml
app:
  name: copy-comments-old
  port: 3002

rabbitmq:
  host: '192.168.1.12'
  port: 5673
  username: 'nguyennp'
  password: 'nguyennpNguyenNP3579'
  vhost: /
  heartbeat: 60
  frameMax: 0

queue:
  comments:
    name: data_copy_queue
    durable: true
    autoDelete: false
```

## Running the Service

The service can be run using the provided `run.sh` script:

```bash
# Build the service
./run.sh build

# Start the service (this will run the consumer)
./run.sh start

# Start in development mode with hot reload
./run.sh start:dev

# Send test messages to the queue
./run.sh send 10  # Sends 10 messages
```

## How It Works

1. The service connects to the RabbitMQ server using the credentials in the config file
2. It sets up the queue `data_copy_queue` 
3. The consumer listens for messages on this queue and processes them
4. The producer can send messages to the queue using the `send` command

## Example Workflow

1. Start the service in one terminal:
   ```
   ./run.sh start
   ```

2. In another terminal, send some test messages:
   ```
   ./run.sh send 5
   ```

3. Watch the service process the messages in the first terminal

## Sample Message Format

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "commentId": "comment_123",
  "postId": "post_456",
  "shardId": 3,
  "source": "old_database",
  "destination": "new_database",
  "timestamp": 1621234567890,
  "metadata": {
    "priority": 2,
    "batchId": "batch_1"
  }
}
``` 