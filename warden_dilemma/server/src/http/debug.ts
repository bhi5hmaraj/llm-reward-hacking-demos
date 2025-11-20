import { Express, Request, Response } from 'express';
import { matchMaker } from 'colyseus';

export function registerDebug(app: Express) {
  // List rooms by name (default: lobby)
  app.get('/warden_dilemma/debug/rooms', async (req: Request, res: Response) => {
    const name = (req.query.name as string) || 'lobby';
    const rooms = await matchMaker.query({ name });
    res.json({
      name,
      count: rooms.length,
      rooms: rooms.map((r: any) => ({
        roomId: r.roomId,
        name: r.name,
        clients: r.clients,
        maxClients: r.maxClients,
        processId: r.processId,
        metadata: r.metadata,
        experimentId: (r as any).experimentId, // if present
      })),
    });
  });

  // Find one available room by name + experimentId
  app.get('/warden_dilemma/debug/findOne', async (req: Request, res: Response) => {
    const name = (req.query.name as string) || 'lobby';
    const experimentId = req.query.experimentId as string;
    const rooms = await matchMaker.query({ name });
    const found = rooms.find((r: any) => (r as any).experimentId === experimentId);
    res.json({ name, experimentId, found: !!found, roomId: found?.roomId, clients: found?.clients });
  });
}

