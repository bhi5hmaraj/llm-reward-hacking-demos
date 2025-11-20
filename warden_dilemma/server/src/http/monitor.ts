import { Express } from 'express';
import { logger } from '../services/logger.service';

export function registerMonitor(app: Express) {
  if (process.env.MONITOR_ENABLED === 'true') {
    try {
      const { monitor } = require('@colyseus/monitor');
      app.use('/colyseus', monitor());
      logger.info('Colyseus Monitor enabled at /colyseus');
    } catch (error) {
      logger.warn('Colyseus Monitor not available (install @colyseus/monitor)');
    }
  }
}

