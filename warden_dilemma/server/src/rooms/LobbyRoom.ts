/**
 * Lobby Room
 *
 * Manages pre-game matchmaking and player assignment.
 * Once all human players join, experimenter can start the game.
 *
 * Flow:
 * 1. Experimenter creates lobby with experiment ID
 * 2. Human players join with lobby code
 * 3. When ready, experimenter triggers game start
 * 4. LobbyRoom creates GameRoom and transfers players
 */

import { Room, Client } from 'colyseus';
import { LobbyState, WaitingPlayer } from './schemas/LobbyState';
import { logger } from '../services/logger.service';
import { getExperiment, saveExperiment } from '../services/redis.service';
import { ExperimentConfig } from '../types';

interface LobbyRoomOptions {
  experimentId: string;
}

interface JoinOptions {
  role: 'experimenter' | 'player';
  playerName?: string;
  playerId?: string; // For rejoining
}

export class LobbyRoom extends Room<LobbyState> {
  private experimentId!: string;
  private config!: ExperimentConfig;
  private experimenterSessionId?: string;
  private playerSlotAssignments: Map<string, number> = new Map(); // sessionId -> slot

  /**
   * Room creation
   */
  async onCreate(options: LobbyRoomOptions) {
    this.experimentId = options.experimentId;

    logger.info('LobbyRoom created', {
      roomId: this.roomId,
      experimentId: this.experimentId,
    });

    // Load experiment config from database
    await this.loadExperimentConfig();

    // Initialize lobby state
    this.setState(
      new LobbyState(
        this.experimentId,
        'Loading...', // Will be updated after config load
        this.countHumanPlayers()
      )
    );

    // Update experiment name
    const experiment = await getExperiment(this.experimentId);
    if (experiment) {
      this.state.experimentName = experiment.name;
    }

    // Register message handlers
    this.onMessage('start_game', this.handleStartGame.bind(this));
    this.onMessage('kick_player', this.handleKickPlayer.bind(this));

    // Set max clients (human players + experimenter + buffer)
    this.maxClients = this.countHumanPlayers() + 5;

    logger.info('LobbyRoom initialized', {
      roomId: this.roomId,
      requiredPlayers: this.state.requiredPlayers,
      maxClients: this.maxClients,
    });
  }

  /**
   * Load experiment configuration from Redis
   */
  private async loadExperimentConfig(): Promise<void> {
    const experiment = await getExperiment(this.experimentId);

    if (!experiment) {
      throw new Error(`Experiment not found: ${this.experimentId}`);
    }

    this.config = experiment.config as unknown as ExperimentConfig;
  }

  /**
   * Count number of human players from config
   */
  private countHumanPlayers(): number {
    if (!this.config) return 0;
    return this.config.players.filter((p) => p.type === 'human').length;
  }

  /**
   * Client joins lobby
   */
  async onJoin(client: Client, options: JoinOptions) {
    logger.info('Client joining lobby', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      role: options.role,
    });

    if (options.role === 'experimenter') {
      this.handleExperimenterJoin(client);
    } else if (options.role === 'player') {
      await this.handlePlayerJoin(client, options);
    }

    this.checkIfReady();
  }

  /**
   * Handle experimenter joining
   */
  private handleExperimenterJoin(client: Client): void {
    this.experimenterSessionId = client.sessionId;
    logger.info('Experimenter joined lobby', {
      roomId: this.roomId,
      sessionId: client.sessionId,
    });
  }

  /**
   * Handle player joining
   */
  private async handlePlayerJoin(client: Client, options: JoinOptions): Promise<void> {
    const playerName = options.playerName || `Player ${this.state.waitingPlayers.length + 1}`;

    // Assign to next available slot
    const slot = this.findNextAvailableSlot();

    if (slot === -1) {
      logger.warn('Lobby full, rejecting player', {
        roomId: this.roomId,
        sessionId: client.sessionId,
      });
      throw new Error('Lobby is full');
    }

    this.playerSlotAssignments.set(client.sessionId, slot);

    const waitingPlayer = new WaitingPlayer(
      client.sessionId,
      playerName,
      `player_${slot}`
    );

    this.state.waitingPlayers.push(waitingPlayer);

    logger.info('Player joined lobby', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      playerName,
      slot,
      waitingCount: this.state.waitingPlayers.length,
    });

    // Send player their assigned ID
    client.send('player_assigned', {
      playerId: `player_${slot}`,
      slot,
    });
  }

  /**
   * Find next available player slot
   */
  private findNextAvailableSlot(): number {
    const humanSlots = this.config.players
      .filter((p) => p.type === 'human')
      .map((p) => p.slot)
      .sort((a, b) => a - b);

    const assignedSlots = new Set(this.playerSlotAssignments.values());

    for (const slot of humanSlots) {
      if (!assignedSlots.has(slot)) {
        return slot;
      }
    }

    return -1; // No slots available
  }

  /**
   * Check if all players ready to start
   */
  private checkIfReady(): void {
    const humanPlayersNeeded = this.countHumanPlayers();
    const currentCount = this.state.waitingPlayers.length;

    this.state.isReady = currentCount >= humanPlayersNeeded;

    if (this.state.isReady) {
      logger.info('Lobby ready to start', {
        roomId: this.roomId,
        playerCount: currentCount,
      });

      this.broadcast('lobby_ready', {
        message: 'All players joined. Experimenter can start the game.',
      });
    }
  }

  /**
   * Handle game start request (from experimenter)
   */
  private async handleStartGame(client: Client): Promise<void> {
    // Verify it's the experimenter
    if (client.sessionId !== this.experimenterSessionId) {
      logger.warn('Non-experimenter tried to start game', {
        roomId: this.roomId,
        sessionId: client.sessionId,
      });
      client.send('error', { message: 'Only experimenter can start game' });
      return;
    }

    if (!this.state.isReady) {
      client.send('error', { message: 'Not enough players' });
      return;
    }

    logger.info('Starting game', {
      roomId: this.roomId,
      experimentId: this.experimentId,
    });

    try {
      // Create GameRoom using matchmaker
      const gameRoom = await (this.presence as any).create('game', {
        experimentId: this.experimentId,
        playerAssignments: Object.fromEntries(this.playerSlotAssignments),
      });

      logger.info('GameRoom created', {
        lobbyRoomId: this.roomId,
        gameRoomId: gameRoom.roomId,
      });

      // Notify all clients to join game room
      this.broadcast('game_started', {
        gameRoomId: gameRoom.roomId,
      });

      // Update experiment status in Redis
      const experiment = await getExperiment(this.experimentId);
      if (experiment) {
        experiment.status = 'IN_PROGRESS';
        await saveExperiment(this.experimentId, experiment);
      }

      // Disconnect lobby after short delay (allows clients to receive message)
      setTimeout(() => {
        this.disconnect();
      }, 2000);
    } catch (error) {
      logger.error('Failed to start game', error as Error, {
        roomId: this.roomId,
        experimentId: this.experimentId,
      });

      client.send('error', {
        message: 'Failed to create game room',
      });
    }
  }

  /**
   * Handle kick player request (from experimenter)
   */
  private handleKickPlayer(client: Client, message: { sessionId: string }): void {
    if (client.sessionId !== this.experimenterSessionId) {
      return;
    }

    const targetClient = this.clients.find((c) => c.sessionId === message.sessionId);
    if (targetClient) {
      logger.info('Kicking player from lobby', {
        roomId: this.roomId,
        targetSessionId: message.sessionId,
      });

      targetClient.leave();
    }
  }

  /**
   * Client leaves lobby
   */
  async onLeave(client: Client, consented: boolean) {
    logger.info('Client leaving lobby', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      consented,
    });

    // Remove from waiting players
    const index = this.state.waitingPlayers.findIndex(
      (p) => p.sessionId === client.sessionId
    );

    if (index !== -1) {
      this.state.waitingPlayers.splice(index, 1);
      this.playerSlotAssignments.delete(client.sessionId);
    }

    // If experimenter leaves, end lobby
    if (client.sessionId === this.experimenterSessionId) {
      logger.info('Experimenter left, closing lobby', {
        roomId: this.roomId,
      });

      this.broadcast('lobby_closed', {
        reason: 'Experimenter disconnected',
      });

      setTimeout(() => this.disconnect(), 1000);
    }

    this.checkIfReady();
  }

  /**
   * Room disposal
   */
  async onDispose() {
    logger.info('LobbyRoom disposed', {
      roomId: this.roomId,
      experimentId: this.experimentId,
    });
  }
}
