import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { existsSync } from 'fs';
import { logger } from '../services/logger.service';

export function createApp() {
  const app: Express = express();
  const isDevelopment = process.env.NODE_ENV === 'development';

  const candidates = [
    path.resolve(__dirname, '../../../client/dist'), // from server/dist/http
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
  ];
  const clientExists = !!candidates.find((p) => existsSync(p));

  if (isDevelopment && !clientExists) {
    app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
    logger.info('CORS enabled for development (separate Vite server)');
  }

  app.use(express.json());

  if (isDevelopment) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      logger.debug(`${req.method} ${req.path}`, {
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined,
      });
      next();
    });
  }

  return { app, isDevelopment, clientExists };
}
