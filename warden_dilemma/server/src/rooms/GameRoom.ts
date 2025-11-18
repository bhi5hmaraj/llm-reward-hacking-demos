/**
 * Game Room
 *
 * Main game orchestration room. Manages:
 * - 4-phase round progression (announcement, communication, action, revelation)
 * - Player state synchronization
 * - Chat message routing
 * - Payoff calculation
 * - Database persistence
 *
 * Game Flow:
 * 1. onCreate: Initialize from experiment config
 * 2. onJoin: Connect players to their assigned slots
 * 3. Round loop:
 *    a. Announcement phase: Generate + broadcast payoff matrix
 *    b. Communication phase: Route private 1:1 messages
 *    c. Action phase: Collect player actions (C/D/OPT_OUT)
 *    d. Revelation phase: Calculate payoffs, update scores, reveal results
 * 4. Game end: Save final state, show results
 */

import { Room, Client } from 'colyseus';
import { GameState, PlayerState, ChatMessageState, RoundHistoryState } from './schemas/GameState';
import { logger } from '../services/logger.service';
import { prisma } from '../services/database.service';
import { PayoffEngine } from '../services/payoff-engine.service';
import {
  ExperimentConfig,
  PayoffMatrix,
  PlayerAction,
  RoundHistory,
} from '../types';
import { v4 as uuid } from 'uuid';

interface GameRoomOptions {
  experimentId: string;
  playerAssignments: Record<string, number>; // sessionId -> slot
}

interface JoinOptions {
  role: 'experimenter' | 'player';
  playerId?: string;
}

export class GameRoom extends Room<GameState> {
  private experimentId!: string;
  private config!: ExperimentConfig;
  private payoffEngine!: PayoffEngine;

  // Session tracking
  private experimenterSessionId?: string;
  private playerSessions: Map<string, string> = new Map(); // playerId -> sessionId
  private sessionToPlayerId: Map<string, string> = new Map(); // sessionId -> playerId

  // Current round payoff matrix (cached)
  private currentMatrix?: PayoffMatrix;

  // Phase management
  private phaseTimer?: NodeJS.Timeout;
  private isProcessingPhase: boolean = false;

  /**
   * Room creation
   */
  async onCreate(options: GameRoomOptions) {
    this.experimentId = options.experimentId;

    logger.info('GameRoom created', {
      roomId: this.roomId,
      experimentId: this.experimentId,
    });

    // Load configuration
    await this.loadExperimentConfig();

    // Initialize payoff engine
    this.payoffEngine = new PayoffEngine(this.config);

    // Initialize game state
    const experiment = await prisma.experiment.findUnique({
      where: { id: this.experimentId },
    });

    this.setState(
      new GameState(
        this.experimentId,
        experiment?.name || 'Unknown',
        this.config.numRounds
      )
    );

    // Initialize players
    this.initializePlayers();

    // Register message handlers
    this.onMessage('submit_action', this.handleSubmitAction.bind(this));
    this.onMessage('send_chat', this.handleSendChat.bind(this));
    this.onMessage('experimenter_start', this.handleExperimenterStart.bind(this));

    // Set max clients
    this.maxClients = this.config.numPlayers + 5; // Players + experimenter + buffer

    // Create game session record
    await this.createGameSession();

    logger.info('GameRoom initialized', {
      roomId: this.roomId,
      totalRounds: this.config.numRounds,
      numPlayers: this.config.numPlayers,
    });
  }

  /**
   * Load experiment configuration from database
   */
  private async loadExperimentConfig(): Promise<void> {
    const experiment = await prisma.experiment.findUnique({
      where: { id: this.experimentId },
    });

    if (!experiment) {
      throw new Error(`Experiment not found: ${this.experimentId}`);
    }

    this.config = experiment.config as unknown as ExperimentConfig;
  }

  /**
   * Initialize player states
   */
  private initializePlayers(): void {
    this.config.players.forEach((playerConfig) => {
      const playerId = `player_${playerConfig.slot}`;
      const playerName = playerConfig.type === 'human'
        ? `Player ${playerConfig.slot + 1}`
        : `AI ${playerConfig.slot + 1}`;

      const playerState = new PlayerState(
        playerId,
        playerConfig.slot,
        playerConfig.type,
        playerName,
        this.config.maxRefusals
      );

      // AI and scripted players are "auto-connected"
      if (playerConfig.type !== 'human') {
        playerState.isConnected = true;
      } else {
        playerState.isConnected = false; // Wait for real connection
      }

      this.state.players.set(playerId, playerState);

      logger.debug('Player initialized', {
        playerId,
        slot: playerConfig.slot,
        type: playerConfig.type,
      });
    });
  }

  /**
   * Create game session record in database
   */
  private async createGameSession(): Promise<void> {
    await prisma.gameSession.create({
      data: {
        experimentId: this.experimentId,
        roomId: this.roomId,
        playerStates: {},
        startedAt: null, // Will be set when game actually starts
      },
    });

    logger.info('Game session created', {
      roomId: this.roomId,
      experimentId: this.experimentId,
    });
  }

  /**
   * Client joins game
   */
  async onJoin(client: Client, options: JoinOptions) {
    logger.info('Client joining game', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      role: options.role,
      playerId: options.playerId,
    });

    if (options.role === 'experimenter') {
      this.experimenterSessionId = client.sessionId;
      logger.info('Experimenter joined', { sessionId: client.sessionId });

      // Send current game state
      client.send('game_state', {
        phase: this.state.phase,
        currentRound: this.state.currentRound,
      });
    } else if (options.role === 'player' && options.playerId) {
      await this.handlePlayerJoin(client, options.playerId);
    }
  }

  /**
   * Handle player joining
   */
  private async handlePlayerJoin(client: Client, playerId: string): Promise<void> {
    const playerState = this.state.players.get(playerId);

    if (!playerState) {
      logger.error('Player not found in game state', { playerId });
      throw new Error(`Player ${playerId} not found`);
    }

    if (playerState.type !== 'human') {
      logger.error('Attempted to join non-human player slot', { playerId });
      throw new Error('This player slot is not for humans');
    }

    // Mark as connected
    playerState.isConnected = true;

    // Track session
    this.playerSessions.set(playerId, client.sessionId);
    this.sessionToPlayerId.set(client.sessionId, playerId);

    logger.info('Player joined and connected', {
      playerId,
      sessionId: client.sessionId,
      slot: playerState.slot,
    });

    // Send player their ID
    client.send('player_connected', {
      playerId,
      slot: playerState.slot,
    });

    // Check if all human players connected
    this.checkIfAllPlayersReady();
  }

  /**
   * Check if all human players are connected
   */
  private checkIfAllPlayersReady(): void {
    const allHumansConnected = Array.from(this.state.players.values())
      .filter((p) => p.type === 'human')
      .every((p) => p.isConnected);

    if (allHumansConnected && this.state.phase === 'waiting') {
      logger.info('All human players connected', { roomId: this.roomId });

      this.broadcast('all_players_ready', {
        message: 'All players connected. Waiting for experimenter to start.',
      });
    }
  }

  /**
   * Handle experimenter start command
   */
  private async handleExperimenterStart(client: Client): Promise<void> {
    if (client.sessionId !== this.experimenterSessionId) {
      logger.warn('Non-experimenter tried to start game', {
        sessionId: client.sessionId,
      });
      return;
    }

    if (this.state.phase !== 'waiting') {
      logger.warn('Game already started', { phase: this.state.phase });
      return;
    }

    logger.info('Experimenter starting game', { roomId: this.roomId });

    this.state.startedAt = Date.now();

    // Update database
    await prisma.gameSession.update({
      where: { experimentId: this.experimentId },
      data: { startedAt: new Date() },
    });

    await prisma.experiment.update({
      where: { id: this.experimentId },
      data: { status: 'IN_PROGRESS' },
    });

    // Start round loop
    this.startNextRound();
  }

  /**
   * Start next round
   */
  private async startNextRound(): Promise<void> {
    if (this.isProcessingPhase) {
      logger.warn('Already processing a phase', { roomId: this.roomId });
      return;
    }

    this.state.currentRound++;

    logger.info('Starting round', {
      roomId: this.roomId,
      round: this.state.currentRound,
    });

    logger.gameEvent('round_start', {
      experimentId: this.experimentId,
      round: this.state.currentRound,
    });

    // Reset player action states
    this.state.players.forEach((player) => {
      player.currentAction = undefined;
      player.actionSubmitted = false;
    });

    // Run 4 phases sequentially
    await this.phaseAnnouncement();
    await this.phaseCommunication();
    await this.phaseActionSelection();
    await this.phaseRevelation();

    // Check if game should continue
    if (this.state.currentRound < this.config.numRounds) {
      // Continue to next round
      this.startNextRound();
    } else {
      // Game over
      await this.endGame();
    }
  }

  /**
   * Phase 1: Announcement
   *
   * Generate and broadcast payoff matrix for this round.
   */
  private async phaseAnnouncement(): Promise<void> {
    this.isProcessingPhase = true;
    this.state.phase = 'announcement';

    const duration = this.config.announcementDuration;
    this.state.phaseEndsAt = Date.now() + duration;

    logger.info('Phase: Announcement', {
      roomId: this.roomId,
      round: this.state.currentRound,
      duration,
    });

    // Generate payoff matrix
    const history = this.buildRoundHistory();
    this.currentMatrix = await this.payoffEngine.generateMatrix(
      this.state.currentRound,
      history
    );

    this.state.currentPayoffMatrix = JSON.stringify(this.currentMatrix);

    logger.debug('Payoff matrix generated', {
      round: this.state.currentRound,
      matrix: this.currentMatrix,
    });

    // Broadcast to all clients
    this.broadcast('phase_start', {
      phase: 'announcement',
      duration,
      payoffMatrix: this.currentMatrix,
    });

    // Wait for phase duration
    await this.sleep(duration);

    this.isProcessingPhase = false;
  }

  /**
   * Phase 2: Communication
   *
   * Allow private 1:1 chat between players.
   */
  private async phaseCommunication(): Promise<void> {
    this.isProcessingPhase = true;
    this.state.phase = 'communication';

    const duration = this.config.communicationDuration;
    this.state.phaseEndsAt = Date.now() + duration;

    logger.info('Phase: Communication', {
      roomId: this.roomId,
      round: this.state.currentRound,
      duration,
    });

    this.broadcast('phase_start', {
      phase: 'communication',
      duration,
    });

    // Chat messages handled by handleSendChat()
    await this.sleep(duration);

    this.isProcessingPhase = false;
  }

  /**
   * Phase 3: Action Selection
   *
   * Collect actions from all players.
   */
  private async phaseActionSelection(): Promise<void> {
    this.isProcessingPhase = true;
    this.state.phase = 'action';

    const duration = this.config.actionDuration;
    this.state.phaseEndsAt = Date.now() + duration;

    logger.info('Phase: Action Selection', {
      roomId: this.roomId,
      round: this.state.currentRound,
      duration,
    });

    this.broadcast('phase_start', {
      phase: 'action',
      duration,
    });

    // Wait for all actions or timeout
    await this.waitForAllActions(duration);

    // Auto-submit for players who didn't act
    this.autoSubmitMissingActions();

    this.isProcessingPhase = false;
  }

  /**
   * Wait for all players to submit actions
   */
  private async waitForAllActions(maxDuration: number): Promise<void> {
    const deadline = Date.now() + maxDuration;
    const checkInterval = 100; // Check every 100ms

    while (Date.now() < deadline) {
      const allSubmitted = this.checkAllActionsSubmitted();

      if (allSubmitted) {
        logger.info('All actions submitted early', {
          roomId: this.roomId,
          round: this.state.currentRound,
        });
        break;
      }

      await this.sleep(checkInterval);
    }
  }

  /**
   * Check if all connected players submitted actions
   */
  private checkAllActionsSubmitted(): boolean {
    return Array.from(this.state.players.values())
      .filter((p) => p.isConnected)
      .every((p) => p.actionSubmitted);
  }

  /**
   * Auto-submit OPT_OUT for players who didn't act
   */
  private autoSubmitMissingActions(): void {
    this.state.players.forEach((player) => {
      if (player.isConnected && !player.actionSubmitted) {
        logger.warn('Auto-submitting OPT_OUT for inactive player', {
          playerId: player.id,
          round: this.state.currentRound,
        });

        player.currentAction = 'OPT_OUT';
        player.actionSubmitted = true;

        // Note: This does NOT consume a refusal token (punishment for inaction)
      }
    });
  }

  /**
   * Phase 4: Revelation
   *
   * Calculate payoffs, update scores, broadcast results, save to database.
   */
  private async phaseRevelation(): Promise<void> {
    this.isProcessingPhase = true;
    this.state.phase = 'revelation';

    const duration = this.config.revelationDuration;
    this.state.phaseEndsAt = Date.now() + duration;

    logger.info('Phase: Revelation', {
      roomId: this.roomId,
      round: this.state.currentRound,
    });

    // Collect actions
    const actions = this.collectActions();

    // Calculate payoffs
    const payoffs = this.calculatePayoffs(actions);

    // Update scores
    this.updateScores(payoffs);

    // Get current scores
    const scores = this.getCurrentScores();

    logger.gameEvent('round_complete', {
      experimentId: this.experimentId,
      round: this.state.currentRound,
      actions,
      payoffs,
      scores,
    });

    // Save to database
    await this.saveRoundToDatabase(actions, payoffs, scores);

    // Add to round history (state)
    const historyEntry = new RoundHistoryState(
      this.state.currentRound,
      JSON.stringify(this.currentMatrix),
      JSON.stringify(actions),
      JSON.stringify(payoffs),
      JSON.stringify(scores)
    );
    this.state.roundHistory.push(historyEntry);

    // Broadcast results
    this.broadcast('phase_start', {
      phase: 'revelation',
      duration,
      actions,
      payoffs,
      scores,
    });

    await this.sleep(duration);

    this.isProcessingPhase = false;
  }

  /**
   * Collect actions from all players
   */
  private collectActions(): Record<string, PlayerAction> {
    const actions: Record<string, PlayerAction> = {};

    this.state.players.forEach((player) => {
      if (player.currentAction) {
        actions[player.id] = player.currentAction as PlayerAction;
      }
    });

    return actions;
  }

  /**
   * Calculate payoffs based on actions
   *
   * Algorithm:
   * 1. Count total cooperators (excluding opt-outs)
   * 2. For each player:
   *    - If OPT_OUT: get optOut payoff
   *    - If C or D: get payoff[k] where k = number of OTHER cooperators
   */
  private calculatePayoffs(actions: Record<string, PlayerAction>): Record<string, number> {
    if (!this.currentMatrix) {
      throw new Error('No payoff matrix available');
    }

    const payoffs: Record<string, number> = {};

    // Filter out opt-outs
    const activePlayers = Object.entries(actions).filter(
      ([_, action]) => action !== 'OPT_OUT'
    );

    // Count cooperators
    const totalCooperators = activePlayers.filter(
      ([_, action]) => action === 'C'
    ).length;

    // Calculate each player's payoff
    Object.entries(actions).forEach(([playerId, action]) => {
      if (action === 'OPT_OUT') {
        payoffs[playerId] = this.currentMatrix!.optOut;
      } else {
        // k = number of OTHER players who cooperated
        const k = action === 'C' ? totalCooperators - 1 : totalCooperators;

        const payoffArray = action === 'C'
          ? this.currentMatrix!.cooperate
          : this.currentMatrix!.defect;

        payoffs[playerId] = payoffArray[k] || 0;
      }
    });

    logger.debug('Payoffs calculated', {
      round: this.state.currentRound,
      totalCooperators,
      payoffs,
    });

    return payoffs;
  }

  /**
   * Update cumulative scores
   */
  private updateScores(payoffs: Record<string, number>): void {
    Object.entries(payoffs).forEach(([playerId, payoff]) => {
      const player = this.state.players.get(playerId);
      if (player) {
        player.cumulativeScore += payoff;
      }
    });
  }

  /**
   * Get current scores as plain object
   */
  private getCurrentScores(): Record<string, number> {
    const scores: Record<string, number> = {};

    this.state.players.forEach((player, playerId) => {
      scores[playerId] = player.cumulativeScore;
    });

    return scores;
  }

  /**
   * Save round results to database
   */
  private async saveRoundToDatabase(
    actions: Record<string, PlayerAction>,
    payoffs: Record<string, number>,
    scores: Record<string, number>
  ): Promise<void> {
    try {
      await prisma.round.create({
        data: {
          experimentId: this.experimentId,
          roundNumber: this.state.currentRound,
          payoffMatrix: this.currentMatrix as any,
          actions: actions as any,
          payoffs: payoffs as any,
          cumulativeScores: scores as any,
          announcedAt: new Date(Date.now() - this.config.announcementDuration),
          revealedAt: new Date(),
          durationMs:
            this.config.announcementDuration +
            this.config.communicationDuration +
            this.config.actionDuration +
            this.config.revelationDuration,
        },
      });

      logger.debug('Round saved to database', {
        experimentId: this.experimentId,
        round: this.state.currentRound,
      });
    } catch (error) {
      logger.error('Failed to save round to database', error as Error, {
        experimentId: this.experimentId,
        round: this.state.currentRound,
      });
    }
  }

  /**
   * Handle action submission from player
   */
  private handleSubmitAction(
    client: Client,
    message: { action: PlayerAction }
  ): void {
    const playerId = this.sessionToPlayerId.get(client.sessionId);

    if (!playerId) {
      logger.warn('Unknown session tried to submit action', {
        sessionId: client.sessionId,
      });
      return;
    }

    const player = this.state.players.get(playerId);

    if (!player) {
      logger.error('Player state not found', { playerId });
      return;
    }

    // Validate phase
    if (this.state.phase !== 'action') {
      client.send('error', { message: 'Not in action phase' });
      return;
    }

    // Validate action
    if (!['C', 'D', 'OPT_OUT'].includes(message.action)) {
      client.send('error', { message: 'Invalid action' });
      return;
    }

    // Check refusals
    if (message.action === 'OPT_OUT' && player.refusalsRemaining <= 0) {
      client.send('error', { message: 'No refusals remaining' });
      return;
    }

    // Submit action
    player.currentAction = message.action;
    player.actionSubmitted = true;

    if (message.action === 'OPT_OUT') {
      player.refusalsRemaining--;
    }

    logger.info('Action submitted', {
      playerId,
      action: message.action,
      round: this.state.currentRound,
    });

    logger.gameEvent('action_submitted', {
      experimentId: this.experimentId,
      playerId,
      action: message.action,
      round: this.state.currentRound,
    });

    // Confirm to player
    client.send('action_confirmed', {
      action: message.action,
    });
  }

  /**
   * Handle chat message
   */
  private async handleSendChat(
    client: Client,
    message: { to: string; content: string }
  ): Promise<void> {
    const fromPlayerId = this.sessionToPlayerId.get(client.sessionId);

    if (!fromPlayerId) {
      logger.warn('Unknown session tried to send chat', {
        sessionId: client.sessionId,
      });
      return;
    }

    // Validate phase
    if (this.state.phase !== 'communication') {
      client.send('error', { message: 'Not in communication phase' });
      return;
    }

    // Validate recipient
    const toPlayer = this.state.players.get(message.to);
    if (!toPlayer) {
      client.send('error', { message: 'Invalid recipient' });
      return;
    }

    // Create chat message
    const chatMessage = new ChatMessageState(
      uuid(),
      fromPlayerId,
      message.to,
      message.content,
      this.state.currentRound
    );

    this.state.chatHistory.push(chatMessage);

    logger.info('Chat message sent', {
      from: fromPlayerId,
      to: message.to,
      round: this.state.currentRound,
    });

    logger.gameEvent('chat_sent', {
      experimentId: this.experimentId,
      from: fromPlayerId,
      to: message.to,
      round: this.state.currentRound,
      length: message.content.length,
    });

    // Save to database
    await this.saveChatToDatabase(chatMessage);

    // Send to recipient (if connected)
    const recipientSessionId = this.playerSessions.get(message.to);
    if (recipientSessionId) {
      const recipientClient = this.clients.find(
        (c) => c.sessionId === recipientSessionId
      );

      if (recipientClient) {
        recipientClient.send('chat_message', {
          id: chatMessage.id,
          from: fromPlayerId,
          content: message.content,
          timestamp: chatMessage.timestamp,
        });
      }
    }

    // Send to experimenter
    if (this.experimenterSessionId) {
      const experimenterClient = this.clients.find(
        (c) => c.sessionId === this.experimenterSessionId
      );

      if (experimenterClient) {
        experimenterClient.send('chat_message', {
          id: chatMessage.id,
          from: fromPlayerId,
          to: message.to,
          content: message.content,
          timestamp: chatMessage.timestamp,
        });
      }
    }
  }

  /**
   * Save chat message to database
   */
  private async saveChatToDatabase(chatMessage: ChatMessageState): Promise<void> {
    try {
      await prisma.chatMessage.create({
        data: {
          id: chatMessage.id,
          experimentId: this.experimentId,
          roundNumber: chatMessage.roundNumber,
          fromPlayer: chatMessage.fromPlayer,
          toPlayer: chatMessage.toPlayer,
          content: chatMessage.content,
          timestamp: new Date(chatMessage.timestamp),
        },
      });
    } catch (error) {
      logger.error('Failed to save chat to database', error as Error, {
        experimentId: this.experimentId,
        chatId: chatMessage.id,
      });
    }
  }

  /**
   * Build round history array from state
   */
  private buildRoundHistory(): RoundHistory[] {
    return this.state.roundHistory.map((entry) => ({
      roundNumber: entry.roundNumber,
      payoffMatrix: JSON.parse(entry.payoffMatrix),
      actions: JSON.parse(entry.actions),
      payoffs: JSON.parse(entry.payoffs),
      cumulativeScores: JSON.parse(entry.scores),
      announcedAt: new Date(0), // Not stored in state
      revealedAt: new Date(entry.revealedAt),
      submittedAt: {},
      chatLogs: [],
      duration: 0,
    }));
  }

  /**
   * End game
   */
  private async endGame(): Promise<void> {
    this.state.phase = 'ended';
    this.state.endedAt = Date.now();

    logger.info('Game ended', {
      roomId: this.roomId,
      experimentId: this.experimentId,
      totalRounds: this.state.currentRound,
    });

    logger.gameEvent('game_end', {
      experimentId: this.experimentId,
      totalRounds: this.state.currentRound,
      finalScores: this.getCurrentScores(),
    });

    const finalScores = this.getCurrentScores();

    this.broadcast('game_ended', {
      finalScores,
      totalRounds: this.state.currentRound,
    });

    // Update database
    await prisma.experiment.update({
      where: { id: this.experimentId },
      data: { status: 'COMPLETED' },
    });

    await prisma.gameSession.update({
      where: { experimentId: this.experimentId },
      data: { endedAt: new Date() },
    });

    // Disconnect after delay
    setTimeout(() => {
      this.disconnect();
    }, 10000);
  }

  /**
   * Client leaves
   */
  async onLeave(client: Client, consented: boolean) {
    const playerId = this.sessionToPlayerId.get(client.sessionId);

    if (playerId) {
      const player = this.state.players.get(playerId);

      if (player) {
        player.isConnected = false;

        logger.warn('Player disconnected', {
          playerId,
          sessionId: client.sessionId,
          consented,
        });

        // Check minimum player requirement
        const connectedCount = Array.from(this.state.players.values()).filter(
          (p) => p.isConnected
        ).length;

        if (connectedCount < 2) {
          logger.error('Insufficient players, aborting game', {
            connectedCount,
          });

          this.broadcast('game_aborted', {
            reason: 'Insufficient players (< 2)',
          });

          await prisma.experiment.update({
            where: { id: this.experimentId },
            data: { status: 'ABORTED' },
          });

          setTimeout(() => this.disconnect(), 2000);
        }
      }
    }

    // If experimenter leaves
    if (client.sessionId === this.experimenterSessionId) {
      logger.warn('Experimenter disconnected', {
        sessionId: client.sessionId,
      });

      // Game can continue, but note this in logs
      this.broadcast('experimenter_disconnected', {
        message: 'Experimenter disconnected. Game continues.',
      });
    }
  }

  /**
   * Room disposal
   */
  async onDispose() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
    }

    logger.info('GameRoom disposed', {
      roomId: this.roomId,
      experimentId: this.experimentId,
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.phaseTimer = setTimeout(resolve, ms);
    });
  }
}
