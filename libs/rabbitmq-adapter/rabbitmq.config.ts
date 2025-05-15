import { registerAs } from '@nestjs/config';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { RabbitMQConfig } from './rabbitmq.interface';

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
  };
}); 