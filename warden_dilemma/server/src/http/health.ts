import { Request, Response, Express } from 'express';
import { checkRedisHealth } from '../services/redis.service';

export function registerHealth(app: Express) {
  const handler = async (req: Request, res: Response) => {
    const redisHealthy = await checkRedisHealth();

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      redis: redisHealthy ? 'connected' : 'not_configured_or_disconnected',
      persistence: redisHealthy ? 'enabled' : 'in_memory_only',
      uptime: process.uptime(),
    };

    res.status(200).json(health);
  };

  app.get('/health', handler);
  app.get('/warden_dilemma/health', handler);
}

