import { Injectable, Logger } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { IRabbitMQConnectionManager, RabbitMQConnectionConfig, RabbitMQReconnectPolicy } from '../interfaces/connection.interface';

@Injectable()
export class RabbitMQConnectionManager implements IRabbitMQConnectionManager {
  private readonly logger = new Logger(RabbitMQConnectionManager.name);
  private _connection: any; // Using 'any' for amqplib Connection to avoid TypeScript errors
  private connectionString: string;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private eventListeners: Map<string, ((...args: any[]) => void)[]> = new Map();
  
  // Default reconnect policy
  private reconnectPolicy: Required<RabbitMQReconnectPolicy> = {
    enabled: true,
    maxAttempts: 30,
    initialTimeout: 1000,
    maxTimeout: 30000,
    backoffFactor: 2
  };

  constructor(private readonly config: RabbitMQConnectionConfig) {
    this.prepareConnectionString();
    
    // Apply custom reconnect policy if provided
    if (config.reconnect) {
      this.reconnectPolicy = {
        ...this.reconnectPolicy,
        ...config.reconnect
      };
    }
  }

  get connection(): amqplib.Connection {
    return this._connection;
  }

  private prepareConnectionString(): void {
    const { hostname, port, username, password, vhost } = this.config;
    this.connectionString = `amqp://${username}:${password}@${hostname}:${port}/${encodeURIComponent(vhost || '/')}`;
  }

  async initialize(): Promise<void> {
    await this.connect();
  }

  async connect(): Promise<amqplib.Connection> {
    try {
      const { hostname, port, username, vhost } = this.config;
      
      this.logger.log(`Connecting to RabbitMQ at ${hostname}:${port} with username ${username} and vhost ${vhost || '/'}`);
      
      this._connection = await amqplib.connect(this.connectionString);
      this.reconnectAttempts = 0;
      this.bindConnectionListeners();
      this.logger.log('Successfully connected to RabbitMQ');
      
      return this._connection;
    } catch (error) {
      this.logger.error(`RabbitMQ connection error: ${error.message}`);
      
      // Handle specific connection errors with helpful messages
      if (error.message.includes('ECONNREFUSED')) {
        this.logger.error(`RabbitMQ connection refused - check if the RabbitMQ server is running at ${this.config.hostname}:${this.config.port}`);
      } else if (error.message.includes('ETIMEDOUT')) {
        this.logger.error(`RabbitMQ connection timeout - check network connectivity to ${this.config.hostname}:${this.config.port}`);
      } else if (error.message.includes('auth')) {
        this.logger.error('RabbitMQ authentication failed - check username and password');
      }
      
      if (this.reconnectPolicy.enabled) {
        await this.handleReconnect();
      }
      
      throw error;
    }
  }

  private bindConnectionListeners(): void {
    this._connection.on('error', (err) => {
      this.logger.error(`RabbitMQ connection error: ${err.message}`);
      this.notifyEventListeners('error', err);
      
      if (err.message !== 'Connection closing' && this.reconnectPolicy.enabled) {
        this.handleReconnect();
      }
    });

    this._connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.notifyEventListeners('close');
      
      if (this.reconnectPolicy.enabled) {
        this.handleReconnect();
      }
    });
    
    this._connection.on('blocked', (reason) => {
      this.logger.warn(`RabbitMQ connection blocked: ${reason}`);
      this.notifyEventListeners('blocked', reason);
    });
    
    this._connection.on('unblocked', () => {
      this.logger.log('RabbitMQ connection unblocked');
      this.notifyEventListeners('unblocked');
    });
  }

  private async handleReconnect(): Promise<void> {
    if (this.isReconnecting) {
      return;
    }
    
    if (this.reconnectAttempts >= this.reconnectPolicy.maxAttempts) {
      this.logger.error(`Max reconnect attempts (${this.reconnectPolicy.maxAttempts}) reached. Giving up.`);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const timeout = Math.min(
      this.reconnectPolicy.initialTimeout * Math.pow(
        this.reconnectPolicy.backoffFactor,
        Math.min(this.reconnectAttempts - 1, 10)
      ),
      this.reconnectPolicy.maxTimeout
    );
    
    this.logger.log(`Attempting to reconnect in ${timeout}ms (attempt ${this.reconnectAttempts}/${this.reconnectPolicy.maxAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
        this.notifyEventListeners('reconnected', this._connection);
        this.isReconnecting = false;
      } catch (error) {
        this.logger.error(`Error during reconnect: ${error.message}`);
        this.isReconnecting = false;
        
        // Schedule another reconnect attempt if needed
        if (this.reconnectAttempts < this.reconnectPolicy.maxAttempts && this.reconnectPolicy.enabled) {
          this.handleReconnect();
        }
      }
    }, timeout);
  }

  isConnected(): boolean {
    // Use a type-safe check that doesn't rely on the Connection.connection property
    return Boolean(this._connection);
  }

  async close(): Promise<void> {
    if (this._connection) {
      try {
        // Using the close method directly without type checking
        await this._connection.close();
        this._connection = null;
        this.logger.log('RabbitMQ connection closed');
      } catch (error) {
        this.logger.error(`Error closing RabbitMQ connection: ${error.message}`);
        throw error;
      }
    }
  }

  onConnectionEvent(event: 'close' | 'error' | 'blocked' | 'unblocked' | 'reconnected', listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event).push(listener);
  }
  
  private notifyEventListeners(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event) || [];
    
    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (error) {
        this.logger.error(`Error in connection event listener for event '${event}': ${error.message}`);
      }
    }
  }
} 