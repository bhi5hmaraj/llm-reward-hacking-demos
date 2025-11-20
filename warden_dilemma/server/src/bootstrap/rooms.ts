import { Server } from 'colyseus';
import { LobbyRoom } from '../rooms/LobbyRoom';
import { GameRoom } from '../rooms/GameRoom';
import { logger } from '../services/logger.service';

export function registerRooms(gameServer: Server) {
  gameServer.define('lobby', LobbyRoom).filterBy(['experimentId']);
  gameServer.define('game', GameRoom);

  logger.info('Colyseus rooms registered', { rooms: ['lobby', 'game'] });
}

