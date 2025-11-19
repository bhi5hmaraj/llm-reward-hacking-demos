/**
 * Redis Storage Service
 *
 * Simple key-value storage using Upstash Redis.
 * Replaces PostgreSQL for experiment configs and results.
 */

import { Redis } from '@upstash/redis';
import { logger } from './logger.service';

/**
 * Upstash Redis client
 */
let redis: Redis | null = null;

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<void> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      logger.warn('Upstash Redis not configured. Using in-memory storage only.');
      logger.warn('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable persistence.');
      return;
    }

    redis = new Redis({
      url,
      token,
    });

    // Test connection
    await redis.ping();

    logger.info('✅ Redis connected (Upstash)');
  } catch (error) {
    logger.error('❌ Redis connection failed:', error as Error);
    logger.warn('Falling back to in-memory storage');
    redis = null;
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.ping();
    return true;
  } catch (error) {
    logger.error('❌ Redis health check failed:', error as Error);
    return false;
  }
}

/**
 * Get Redis client (may be null if not configured)
 */
export function getRedis(): Redis | null {
  return redis;
}

// ============================================================================
// Storage Helpers
// ============================================================================

/**
 * Save experiment config
 */
export async function saveExperiment(experimentId: string, data: any): Promise<void> {
  if (!redis) {
    logger.warn('Redis not available, experiment not persisted');
    return;
  }

  try {
    await redis.set(`experiment:${experimentId}`, JSON.stringify(data));
    logger.debug('Experiment saved to Redis', { experimentId });
  } catch (error) {
    logger.error('Failed to save experiment', error as Error, { experimentId });
  }
}

/**
 * Get experiment config
 */
export async function getExperiment(experimentId: string): Promise<any | null> {
  if (!redis) return null;

  try {
    const data = await redis.get(`experiment:${experimentId}`);
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  } catch (error) {
    logger.error('Failed to get experiment', error as Error, { experimentId });
    return null;
  }
}

/**
 * List all experiments
 */
export async function listExperiments(): Promise<any[]> {
  if (!redis) return [];

  try {
    const keys = await redis.keys('experiment:*');
    const experiments = await Promise.all(
      keys.map(async (key) => {
        const data = await redis!.get(key);
        return typeof data === 'string' ? JSON.parse(data) : data;
      })
    );
    return experiments.filter(Boolean);
  } catch (error) {
    logger.error('Failed to list experiments', error as Error);
    return [];
  }
}

/**
 * Delete experiment
 */
export async function deleteExperiment(experimentId: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(`experiment:${experimentId}`);
    logger.debug('Experiment deleted from Redis', { experimentId });
  } catch (error) {
    logger.error('Failed to delete experiment', error as Error, { experimentId });
  }
}

/**
 * Save game result
 */
export async function saveGameResult(experimentId: string, result: any): Promise<void> {
  if (!redis) {
    logger.warn('Redis not available, game result not persisted');
    return;
  }

  try {
    await redis.set(`result:${experimentId}`, JSON.stringify(result));
    logger.debug('Game result saved to Redis', { experimentId });
  } catch (error) {
    logger.error('Failed to save game result', error as Error, { experimentId });
  }
}

/**
 * Get game result
 */
export async function getGameResult(experimentId: string): Promise<any | null> {
  if (!redis) return null;

  try {
    const data = await redis.get(`result:${experimentId}`);
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  } catch (error) {
    logger.error('Failed to get game result', error as Error, { experimentId });
    return null;
  }
}
