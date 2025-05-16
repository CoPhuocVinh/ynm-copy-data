/**
 * Interface describing the data structure for a comment copy request
 */
export interface CommentCopyPayload {
  /**
   * Unique ID of the copy request
   */
  id: string;

  /**
   * ID of the comment to be copied
   */
  commentId: string;

  /**
   * ID of the post containing the comment (optional)
   */
  postId?: string;

  /**
   * ID of the shard containing the data (optional)
   */
  shardId?: number;

  /**
   * Source of the data (database or service)
   */
  source: string;

  /**
   * Destination of the data
   */
  destination: string;

  /**
   * Request creation timestamp
   */
  timestamp: number;

  /**
   * Additional metadata (optional)
   */
  metadata?: Record<string, any>;
}

/**
 * Interface describing the input data for a comment copy request
 * Omits fields that will be automatically generated (id, timestamp)
 */
export type CommentCopyRequestDto = Omit<CommentCopyPayload, 'id' | 'timestamp'>; 