/**
 * Colyseus State Schemas
 *
 * Defines the synchronized state structure for the GameRoom.
 * These schemas are automatically synchronized to all connected clients.
 */

import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

/**
 * Player state within a game
 *
 * Tracks individual player progress, connection status, and current action.
 */
export class PlayerState extends Schema {
  @type('string') id: string = '';
  @type('number') slot: number = 0;
  @type('string') type: string = 'human'; // 'human' | 'ai' | 'scripted'
  @type('string') name: string = '';

  // Connection status
  @type('boolean') isConnected: boolean = true;

  // Game progress
  @type('number') cumulativeScore: number = 0;
  @type('number') refusalsRemaining: number = 3;

  // Current round state
  @type('string') currentAction?: string; // 'C' | 'D' | 'OPT_OUT' | undefined
  @type('boolean') actionSubmitted: boolean = false;

  constructor(
    id: string,
    slot: number,
    type: string,
    name: string,
    maxRefusals: number
  ) {
    super();
    this.id = id;
    this.slot = slot;
    this.type = type;
    this.name = name;
    this.refusalsRemaining = maxRefusals;
  }
}

/**
 * Chat message structure
 *
 * Represents a single message in the chat history.
 */
export class ChatMessageState extends Schema {
  @type('string') id: string = '';
  @type('string') fromPlayer: string = '';
  @type('string') toPlayer: string = '';
  @type('string') content: string = '';
  @type('number') timestamp: number = 0;
  @type('number') roundNumber: number = 0;

  constructor(
    id: string,
    fromPlayer: string,
    toPlayer: string,
    content: string,
    roundNumber: number
  ) {
    super();
    this.id = id;
    this.fromPlayer = fromPlayer;
    this.toPlayer = toPlayer;
    this.content = content;
    this.timestamp = Date.now();
    this.roundNumber = roundNumber;
  }
}

/**
 * Round history entry
 *
 * Stores the results of a completed round.
 */
export class RoundHistoryState extends Schema {
  @type('number') roundNumber: number = 0;
  @type('string') payoffMatrix: string = '{}'; // JSON string
  @type('string') actions: string = '{}'; // JSON string: Record<PlayerId, Action>
  @type('string') payoffs: string = '{}'; // JSON string: Record<PlayerId, number>
  @type('string') scores: string = '{}'; // JSON string: Record<PlayerId, number>
  @type('number') revealedAt: number = 0;

  constructor(
    roundNumber: number,
    payoffMatrix: string,
    actions: string,
    payoffs: string,
    scores: string
  ) {
    super();
    this.roundNumber = roundNumber;
    this.payoffMatrix = payoffMatrix;
    this.actions = actions;
    this.payoffs = payoffs;
    this.scores = scores;
    this.revealedAt = Date.now();
  }
}

/**
 * Main game state
 *
 * Root state object synchronized across all clients.
 * Contains all game progression, player states, and history.
 */
export class GameState extends Schema {
  // Experiment metadata
  @type('string') experimentId: string = '';
  @type('string') experimentName: string = '';

  // Game progression
  @type('number') currentRound: number = 0;
  @type('number') totalRounds: number = 0;
  @type('string') phase: string = 'waiting'; // 'waiting' | 'announcement' | 'communication' | 'action' | 'revelation'
  @type('number') phaseEndsAt: number = 0; // Unix timestamp (ms)

  // Current round data
  @type('string') currentPayoffMatrix: string = ''; // JSON string

  // Player states
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  // Chat history (entire game)
  @type([ChatMessageState]) chatHistory = new ArraySchema<ChatMessageState>();

  // Round history
  @type([RoundHistoryState]) roundHistory = new ArraySchema<RoundHistoryState>();

  // Metadata
  @type('number') startedAt: number = 0;
  @type('number') endedAt: number = 0;

  constructor(experimentId: string, experimentName: string, totalRounds: number) {
    super();
    this.experimentId = experimentId;
    this.experimentName = experimentName;
    this.totalRounds = totalRounds;
  }
}
