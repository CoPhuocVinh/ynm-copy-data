import { Connection } from 'amqplib';

/**
 * Configuration for RabbitMQ connection
 */
export interface RabbitMQConnectionConfig {
  /**
   * RabbitMQ server hostname
   * @default 'localhost'
   */
  hostname: string;
  
  /**
   * RabbitMQ server port
   * @default 5672
   */
  port: number;
  
  /**
   * RabbitMQ username
   * @default 'guest'
   */
  username: string;
  
  /**
   * RabbitMQ password
   * @default 'guest'
   */
  password: string;
  
  /**
   * RabbitMQ virtual host
   * @default '/'
   */
  vhost?: string;
  
  /**
   * Heartbeat interval in seconds
   * @default 60
   */
  heartbeat?: number;
  
  /**
   * Maximum frame size
   * @default 0 (unlimited)
   */
  frameMax?: number;

  /**
   * Automatic reconnection policy
   */
  reconnect?: RabbitMQReconnectPolicy;
}

/**
 * Reconnection policy for RabbitMQ
 */
export interface RabbitMQReconnectPolicy {
  /**
   * Whether to enable automatic reconnection
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Maximum number of reconnection attempts
   * @default 30
   */
  maxAttempts?: number;
  
  /**
   * Initial reconnection timeout in milliseconds
   * @default 1000
   */
  initialTimeout?: number;
  
  /**
   * Maximum reconnection timeout in milliseconds
   * @default 30000
   */
  maxTimeout?: number;
  
  /**
   * Backoff factor for reconnection attempts
   * @default 2
   */
  backoffFactor?: number;
}

/**
 * Interface for RabbitMQ connection manager
 */
export interface IRabbitMQConnectionManager {
  /**
   * Get the current connection instance
   */
  readonly connection: Connection;
  
  /**
   * Connect to RabbitMQ server
   */
  connect(): Promise<Connection>;
  
  /**
   * Close the connection
   */
  close(): Promise<void>;
  
  /**
   * Check if the connection is established
   */
  isConnected(): boolean;
  
  /**
   * Initialize the connection
   */
  initialize(): Promise<void>;
  
  /**
   * Register a connection event listener
   */
  onConnectionEvent(event: 'close' | 'error' | 'blocked' | 'unblocked', listener: (...args: any[]) => void): void;
} 