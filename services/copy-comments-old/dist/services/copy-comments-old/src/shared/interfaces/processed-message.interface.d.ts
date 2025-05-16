export interface ProcessedMessage {
    id: string;
    timestamp: number;
}
export interface ProcessingStats {
    processed: number;
    failed: number;
    lastProcessedTime: Date | null;
    cachedMessageCount?: number;
}
