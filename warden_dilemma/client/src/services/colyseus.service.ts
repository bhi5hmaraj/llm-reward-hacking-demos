/**
 * Colyseus Client Service
 *
 * Manages WebSocket connections to Colyseus rooms.
 * Provides type-safe wrappers around Colyseus client.
 */

import { Client, Room } from 'colyseus.js';
import { GameState, ChatMessage, PlayerAction } from '../types';

const COLYSEUS_URL = import.meta.env.VITE_COLYSEUS_URL || 'ws://localhost:3000';

/**
 * Singleton Colyseus client
 */
class ColyseusService {
  private client: Client;
  private lobbyRoom?: Room;
  private gameRoom?: Room;

  constructor() {
    this.client = new Client(COLYSEUS_URL);
    console.log('[Colyseus] Client initialized', { url: COLYSEUS_URL });
  }

  /**
   * Join lobby room
   */
  async joinLobby(
    experimentId: string,
    role: 'experimenter' | 'player',
    playerName?: string
  ): Promise<Room> {
    try {
      console.log('[Colyseus] Joining lobby', { experimentId, role, playerName });

      this.lobbyRoom = await this.client.joinOrCreate('lobby', {
        experimentId,
        role,
        playerName,
      });

      console.log('[Colyseus] Joined lobby', { roomId: this.lobbyRoom.id });

      return this.lobbyRoom;
    } catch (error) {
      console.error('[Colyseus] Failed to join lobby', error);
      throw error;
    }
  }

  /**
   * Join game room
   */
  async joinGame(
    gameRoomId: string,
    role: 'experimenter' | 'player',
    playerId?: string
  ): Promise<Room> {
    try {
      console.log('[Colyseus] Joining game', { gameRoomId, role, playerId });

      this.gameRoom = await this.client.joinById(gameRoomId, {
        role,
        playerId,
      });

      console.log('[Colyseus] Joined game', { roomId: this.gameRoom.id });

      return this.gameRoom;
    } catch (error) {
      console.error('[Colyseus] Failed to join game', error);
      throw error;
    }
  }

  /**
   * Send experimenter start command
   */
  sendExperimenterStart(): void {
    if (this.gameRoom) {
      this.gameRoom.send('experimenter_start');
      console.log('[Colyseus] Sent experimenter_start');
    }
  }

  /**
   * Submit player action
   */
  submitAction(action: PlayerAction): void {
    if (this.gameRoom) {
      this.gameRoom.send('submit_action', { action });
      console.log('[Colyseus] Submitted action', { action });
    }
  }

  /**
   * Send chat message
   */
  sendChat(to: string, content: string): void {
    if (this.gameRoom) {
      this.gameRoom.send('send_chat', { to, content });
      console.log('[Colyseus] Sent chat', { to, length: content.length });
    }
  }

  /**
   * Request game start from lobby (experimenter only)
   */
  requestGameStart(): void {
    if (this.lobbyRoom) {
      this.lobbyRoom.send('start_game');
      console.log('[Colyseus] Requested game start');
    }
  }

  /**
   * Leave current room
   */
  leaveRoom(): void {
    if (this.gameRoom) {
      this.gameRoom.leave();
      this.gameRoom = undefined;
      console.log('[Colyseus] Left game room');
    }

    if (this.lobbyRoom) {
      this.lobbyRoom.leave();
      this.lobbyRoom = undefined;
      console.log('[Colyseus] Left lobby room');
    }
  }

  /**
   * Get current lobby room
   */
  getLobbyRoom(): Room | undefined {
    return this.lobbyRoom;
  }

  /**
   * Get current game room
   */
  getGameRoom(): Room | undefined {
    return this.gameRoom;
  }
}

// Singleton instance
export const colyseusService = new ColyseusService();
