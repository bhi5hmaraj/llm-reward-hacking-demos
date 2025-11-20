import path from 'path';
import { existsSync } from 'fs';
import { Express, Request, Response } from 'express';
import express from 'express';
import { logger } from '../services/logger.service';

export function registerStatic(app: Express, isDevelopment: boolean) {
  const candidates = [
    path.resolve(__dirname, '../../../client/dist'), // from server/dist/http -> repo/client/dist
    path.resolve(__dirname, '../../client/dist'),    // from server/dist/http -> server/client/dist
    path.resolve(process.cwd(), 'client/dist'),      // from CWD
  ];

  const clientDistPath = candidates.find((p) => existsSync(p));
  const clientExists = !!clientDistPath;

  if (clientExists) {
    app.use('/warden_dilemma', express.static(clientDistPath!));
    app.get('/warden_dilemma/*', (req: Request, res: Response) => {
      res.sendFile(path.join(clientDistPath!, 'index.html'));
    });
    logger.info('Serving frontend from client/dist at /warden_dilemma');
  } else if (isDevelopment) {
    logger.warn('Client not built. Run "pnpm build:client" or use Vite dev server on http://localhost:5173/warden_dilemma');
  } else {
    logger.error('Client build not found. Run "pnpm build:client" before starting production server.');
  }

  // Root endpoint - list apps
  app.get('/', (req: Request, res: Response) => {
    res.json({
      message: 'LLM Reward Hacking Demos',
      apps: [
        {
          name: "Warden's Dilemma",
          description: "N-player iterated prisoner's dilemma platform",
          url: '/warden_dilemma',
          status: 'active',
        },
      ],
      endpoints: {
        wardenDilemma: {
          app: '/warden_dilemma',
          api: '/warden_dilemma/api',
          health: '/warden_dilemma/health',
          websocket: `ws://${req.get('host')}`,
        },
      },
    });
  });
}
