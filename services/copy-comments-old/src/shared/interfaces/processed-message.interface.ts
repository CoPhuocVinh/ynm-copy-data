/**
 * Interface describing the data structure for a processed message
 * Stored in cache to avoid reprocessing duplicate messages
 */
export interface ProcessedMessage {
  /**
   * ID of the processed message
   */
  id: string;

  /**
   * Processing timestamp
   * Used to manage the lifecycle of the record in the cache
   */
  timestamp: number;
}

/**
 * Interface describing message processing statistics
 */
export interface ProcessingStats {
  /**
   * Number of successfully processed messages
   */
  processed: number;

  /**
   * Number of failed message processing attempts
   */
  failed: number;

  /**
   * Timestamp of the most recently processed message
   */
  lastProcessedTime: Date | null;

  /**
   * Number of messages in the cache
   */
  cachedMessageCount?: number;
}
