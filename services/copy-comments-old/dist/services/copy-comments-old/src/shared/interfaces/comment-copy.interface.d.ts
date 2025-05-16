export interface CommentCopyPayload {
    id: string;
    commentId: string;
    postId?: string;
    shardId?: number;
    source: string;
    destination: string;
    timestamp: number;
    metadata?: Record<string, any>;
}
export type CommentCopyRequestDto = Omit<CommentCopyPayload, 'id' | 'timestamp'>;
