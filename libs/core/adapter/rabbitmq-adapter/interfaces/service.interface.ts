import { Channel, Connection, ConsumeMessage, Options } from 'amqplib';
import { AckMode } from './consumer.interface';

export interface IRabbitMQService {
  readonly connection: Connection;
  readonly channel: Channel;
  connect(): Promise<void>;
  createChannel(): Promise<void>;
  assertQueue(queue: string, options?: Options.AssertQueue): Promise<void>;
  assertExchange(exchange: string, type: string, options?: Options.AssertExchange): Promise<void>;
  bindQueue(queue: string, exchange: string, routingKey: string, options?: any): Promise<void>;
  consume(queue: string, callback: (msg: ConsumeMessage | null) => void, options?: Options.Consume, ackMode?: AckMode): Promise<string>;
  cancelConsumer(queue: string): Promise<void>;
  publish(exchange: string, routingKey: string, content: Buffer, options?: Options.Publish): Promise<boolean>;
  sendToQueue(queue: string, content: Buffer, options?: Options.Publish): Promise<boolean>;
  ack(msg: ConsumeMessage, allUpTo?: boolean): void;
  nack(msg: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
  setDefaultAckMode(mode: AckMode): void;
  close(): Promise<void>;
} 