/**
 * Colyseus Client Service
 *
 * Manages WebSocket connections to Colyseus rooms.
 * Provides type-safe wrappers around Colyseus client.
 */

import { Client, Room } from 'colyseus.js';
import { PlayerAction } from '../types';

// Auto-detect WebSocket URL
// If VITE_COLYSEUS_URL is set, use it (separate dev server)
// Otherwise, use same-origin WebSocket (production/built)
const getColyseusURL = () => {
  const envURL = import.meta.env.VITE_COLYSEUS_URL;
  if (envURL) return envURL;

  // Same-origin WebSocket
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

const COLYSEUS_URL = getColyseusURL();

/**
 * Singleton Colyseus client
 */
class ColyseusService {
  private client: Client;
  private lobbyRoom?: Room;
  private gameRoom?: Room;
  private myPlayerId?: string;
  private joinTokenByExperiment: Map<string, string> = new Map();
  private roleByExperiment: Map<string, 'experimenter' | 'player'> = new Map();

  constructor() {
    this.client = new Client(COLYSEUS_URL);
    console.log('[Colyseus] Client initialized', { url: COLYSEUS_URL });
  }

  setPlayerId(playerId: string, experimentId?: string) {
    this.myPlayerId = playerId;
    if (experimentId) {
      try { sessionStorage.setItem(`playerId:${experimentId}`, playerId); } catch {}
    }
  }

  getPlayerId(experimentId?: string): string | undefined {
    if (this.myPlayerId) return this.myPlayerId;
    if (experimentId) {
      try { return sessionStorage.getItem(`playerId:${experimentId}`) || undefined; } catch { return undefined; }
    }
    return undefined;
  }

  setJoinToken(experimentId: string, token: string) {
    this.joinTokenByExperiment.set(experimentId, token);
    try { sessionStorage.setItem(`joinToken:${experimentId}`, token); } catch {}
  }

  getJoinToken(experimentId: string): string | undefined {
    const mem = this.joinTokenByExperiment.get(experimentId);
    if (mem) return mem;
    try { return sessionStorage.getItem(`joinToken:${experimentId}`) || undefined; } catch { return undefined; }
  }

  setRole(experimentId: string, role: 'experimenter' | 'player') {
    this.roleByExperiment.set(experimentId, role);
    try { sessionStorage.setItem(`role:${experimentId}`, role); } catch {}
  }

  getRole(experimentId: string): 'experimenter' | 'player' | undefined {
    const mem = this.roleByExperiment.get(experimentId);
    if (mem) return mem;
    try { return (sessionStorage.getItem(`role:${experimentId}`) as any) || undefined; } catch { return undefined; }
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

      // Look up experimentId from URL params; fetch stored join token
      const url = new URL(window.location.href);
      const experimentId = url.searchParams.get('experimentId') || undefined;
      const joinToken = experimentId ? this.getJoinToken(experimentId) : undefined;

      this.gameRoom = await this.client.joinById(gameRoomId, {
        // role and playerId are ignored by server (token-based auth); still sent for compatibility
        role,
        playerId,
        joinToken,
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
