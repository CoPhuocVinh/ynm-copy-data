/**
 * Delay between message sends (ms)
 */
export const MESSAGE_SEND_DELAY = 100;

/**
 * Maximum timeout when sending a message (ms)
 */
export const MESSAGE_SEND_TIMEOUT = 5000;

/**
 * Maximum number of retries when sending a message fails
 */
export const MAX_SEND_RETRIES = 3;

/**
 * Maximum number of retries when processing a message fails
 */
export const MAX_PROCESS_RETRIES = 5;

/**
 * Delay between retry attempts (ms)
 */
export const RETRY_DELAY = 1000;

/**
 * Percentage rate of simulated random failures when processing messages
 */
export const SIMULATED_FAILURE_RATE = 5; // 5%

/**
 * Minimum simulated processing time (ms)
 */
export const MIN_PROCESSING_TIME = 500;

/**
 * Maximum simulated processing time (ms)
 */
export const MAX_PROCESSING_TIME = 2000;
