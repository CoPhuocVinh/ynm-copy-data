/**
 * Definition of message types that can be processed
 */
export enum MessageType {
  /**
   * Comment copy message
   */
  COMMENT_COPY = 'comment_copy',
  
  /**
   * Comment delete message
   */
  COMMENT_DELETE = 'comment_delete',
  
  /**
   * Comment update message
   */
  COMMENT_UPDATE = 'comment_update',
}

/**
 * Definition of message processing status
 */
export enum MessageProcessingStatus {
  /**
   * Message is pending processing
   */
  PENDING = 'pending',
  
  /**
   * Message is being processed
   */
  PROCESSING = 'processing',
  
  /**
   * Message has been successfully processed
   */
  COMPLETED = 'completed',
  
  /**
   * Message processing failed
   */
  FAILED = 'failed',
}

/**
 * Interface describing RabbitMQ message information
 */
export interface RabbitMQMessageInfo {
  /**
   * Message ID
   */
  messageId: string;
  
  /**
   * Message receive time
   */
  receivedAt: Date;
  
  /**
   * Message type
   */
  type: MessageType;
  
  /**
   * Processing status
   */
  status: MessageProcessingStatus;
  
  /**
   * Retry count
   */
  retryCount?: number;
  
  /**
   * Processing time (ms)
   */
  processingTime?: number;
} 