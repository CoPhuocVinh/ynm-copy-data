import { registerAs } from '@nestjs/config';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { RabbitMQConfig } from './interfaces';

export const loadConfig = (envFilePath: string = 'env.yaml'): Record<string, any> => {
  try {
    const yamlConfig = yaml.load(
      fs.readFileSync(path.resolve(process.cwd(), envFilePath), 'utf8'),
    ) as Record<string, any>;
    return yamlConfig;
  } catch (error) {
    console.error(`Error loading configuration from ${envFilePath}:`, error);
    return {};
  }
};

export const rabbitMQConfig = registerAs('rabbitmq', (): RabbitMQConfig => {
  const config = loadConfig();
  
  return {
    hostname: process.env.RABBITMQ_HOST || config.rabbitmq?.host || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || config.rabbitmq?.port || '5672', 10),
    username: process.env.RABBITMQ_USERNAME || config.rabbitmq?.username || 'guest',
    password: process.env.RABBITMQ_PASSWORD || config.rabbitmq?.password || 'guest',
    vhost: process.env.RABBITMQ_VHOST || config.rabbitmq?.vhost || '/',
    heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || config.rabbitmq?.heartbeat || '0', 10),
    frameMax: parseInt(process.env.RABBITMQ_FRAME_MAX || config.rabbitmq?.frameMax || '0', 10),
    channel: {
      prefetchCount: parseInt(process.env.RABBITMQ_PREFETCH || config.rabbitmq?.prefetch || '1', 10),
      enablePublisherConfirms: process.env.RABBITMQ_PUBLISHER_CONFIRMS === 'true' || 
                              config.rabbitmq?.publisherConfirms === true || false,
    },
    publisher: {
      retryFailedPublishes: process.env.RABBITMQ_RETRY_PUBLISHES === 'true' || 
                           config.rabbitmq?.retryPublishes === true || true,
      maxPublishRetries: parseInt(process.env.RABBITMQ_MAX_PUBLISH_RETRIES || 
                                 config.rabbitmq?.maxPublishRetries || '3', 10),
    },
    reconnect: {
      enabled: process.env.RABBITMQ_RECONNECT_ENABLED !== 'false' && 
               config.rabbitmq?.reconnect?.enabled !== false,
      maxAttempts: parseInt(process.env.RABBITMQ_RECONNECT_MAX_ATTEMPTS || 
                           config.rabbitmq?.reconnect?.maxAttempts || '30', 10),
    }
  };
}); 