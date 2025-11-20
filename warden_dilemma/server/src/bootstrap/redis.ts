import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { logger } from '../services/logger.service';

export function configureRedis() {
  let driver: RedisDriver | undefined;
  let presence: RedisPresence | undefined;

  if (process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_URL;
    console.log('[DEBUG] Creating Colyseus Redis drivers with URL:', redisUrl.replace(/:[^:@]+@/, ':****@'));

    try {
      driver = new RedisDriver(redisUrl as any);

      if (process.env.REDIS_PRESENCE_ENABLED === 'true') {
        presence = new RedisPresence(redisUrl as any);
        logger.info('Using Redis-backed Presence');
      } else {
        logger.info('Using Local Presence (REDIS_PRESENCE_ENABLED!=true)');
      }

      logger.info('Colyseus configured with Redis driver (will connect async)');
    } catch (error) {
      logger.warn('Failed to initialize Redis driver, using in-memory driver', error as Error);
    }
  } else {
    console.log('[DEBUG] REDIS_URL not set, using in-memory driver');
    logger.info('REDIS_URL not configured, using in-memory driver (no persistence)');
  }

  return { driver, presence };
}

