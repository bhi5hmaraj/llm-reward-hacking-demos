/**
 * Client-side type definitions
 *
 * Mirrors server types for type safety across the stack.
 */

// Re-export server types (would normally import from shared package)
export type PlayerId = string;
export type PlayerAction = 'C' | 'D' | 'OPT_OUT';
export type PlayerType = 'human' | 'ai' | 'scripted';
export type GamePhase = 'waiting' | 'announcement' | 'communication' | 'action' | 'revelation' | 'ended';

export interface PayoffMatrix {
  cooperate: number[];
  defect: number[];
  optOut: number;
  generatedBy?: 'preset' | 'custom';
  generatorParams?: Record<string, any>;
}

export interface PlayerState {
  id: PlayerId;
  slot: number;
  type: PlayerType;
  name: string;
  isConnected: boolean;
  cumulativeScore: number;
  refusalsRemaining: number;
  currentAction?: PlayerAction;
  actionSubmitted: boolean;
}

export interface ChatMessage {
  id: string;
  from: PlayerId;
  to?: PlayerId; // undefined for experimenter view (sees all)
  content: string;
  timestamp: number;
}

export interface RoundHistory {
  roundNumber: number;
  payoffMatrix: string; // JSON
  actions: string; // JSON
  payoffs: string; // JSON
  scores: string; // JSON
  revealedAt: number;
}

export interface GameState {
  experimentId: string;
  experimentName: string;
  currentRound: number;
  totalRounds: number;
  phase: GamePhase;
  phaseEndsAt: number;
  currentPayoffMatrix: string; // JSON
  players: Map<PlayerId, PlayerState>;
  chatHistory: ChatMessage[];
  roundHistory: RoundHistory[];
  startedAt: number;
  endedAt: number;
}

// API types
export interface ExperimentConfig {
  numPlayers: number;
  numRounds: number;
  maxRefusals: number;
  announcementDuration: number;
  communicationDuration: number;
  actionDuration: number;
  revelationDuration: number;
  payoffOrdering: {
    order: string[];
    constraints?: string[];
  };
  payoffBounds: { min: number; max: number };
  payoffGenerator: {
    type: 'preset' | 'custom';
    preset?: string;
    presetParams?: Record<string, number>;
    customFunction?: string;
  };
  players: Array<{
    slot: number;
    type: PlayerType;
    aiModel?: string;
    aiSystemPrompt?: string;
    scriptedStrategy?: string;
  }>;
}

export interface CreateExperimentRequest {
  name: string;
  config: ExperimentConfig;
  hypothesis?: {
    null: string;
    alternative: string;
    predictedCooperationRate: [number, number];
    predictedDominantStrategy?: string;
    notes?: string;
  };
}

export interface CreateExperimentResponse {
  experimentId: string;
  lobbyCode: string;
}
