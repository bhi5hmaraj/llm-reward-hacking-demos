import { Express, Request, Response } from 'express';
import experimentsApi from '../api/experiments.api';

export function registerApi(app: Express, port: number) {
  app.use('/warden_dilemma/api', experimentsApi);

  app.get('/warden_dilemma/api', (req: Request, res: Response) => {
    res.json({
      name: "Warden's Dilemma API",
      version: '0.1.0',
      endpoints: {
        experiments: {
          create: 'POST /warden_dilemma/api/experiments',
          list: 'GET /warden_dilemma/api/experiments',
          get: 'GET /warden_dilemma/api/experiments/:id',
          results: 'GET /warden_dilemma/api/experiments/:id/results',
          chats: 'GET /warden_dilemma/api/experiments/:id/chats',
          delete: 'DELETE /warden_dilemma/api/experiments/:id',
        },
        health: 'GET /warden_dilemma/health',
      },
      matchmaker: {
        info: 'Colyseus provides built-in matchmaker endpoints',
        docs: 'https://docs.colyseus.io/server/matchmaker/#built-in-http-endpoints',
        endpoints: {
          rooms: 'GET /matchmaker/rooms',
          join: 'POST /matchmaker/joinOrCreate/:roomName',
          availability: 'GET /matchmaker/availability/:roomName',
        },
      },
      websocket: {
        endpoint: `ws://localhost:${port}`,
        rooms: ['lobby', 'game'],
      },
    });
  });
}

