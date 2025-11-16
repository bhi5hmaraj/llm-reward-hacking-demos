/**
 * Shared type definitions for Warden's Dilemma
 */

// ============================================================================
// Core Game Types
// ============================================================================

export type PlayerId = string;
export type UserId = string;

export type PlayerAction = 'C' | 'D' | 'OPT_OUT';
export type PlayerType = 'human' | 'ai' | 'scripted';
export type GamePhase = 'announcement' | 'communication' | 'action' | 'revelation';
export type ExperimentStatus = 'setup' | 'lobby' | 'in_progress' | 'completed' | 'aborted';

export type AIModel = 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-5-sonnet' | 'claude-3-haiku';
export type ScriptedStrategy = 'always_cooperate' | 'always_defect' | 'random' | 'tit_for_tat' | 'grim_trigger';

// ============================================================================
// Payoff Types
// ============================================================================

export interface PayoffMatrix {
  cooperate: number[];    // [0..N-1]: payoff when YOU cooperate, k others cooperate
  defect: number[];       // [0..N-1]: payoff when YOU defect, k others cooperate
  optOut: number;         // Fixed penalty for opting out

  // Metadata
  generatedBy?: 'preset' | 'custom';
  generatorParams?: Record<string, any>;
}

export interface PayoffOrdering {
  // Array of payoff variable names in descending order
  // Example: ["T₂", "R₃", "S₂", "T₁", "P₀", "S₁"]
  order: string[];

  // Optional: explicit constraints (Phase 2)
  // Example: "3*R₃ > T₂ + 2*S₂"
  constraints?: string[];
}

export type PayoffPreset = 'static' | 'random_walk' | 'adaptive_anti_coop' | 'escalating_stakes';

export interface PayoffGeneratorConfig {
  type: 'preset' | 'custom';

  // If preset
  preset?: PayoffPreset;
  presetParams?: Record<string, number>;

  // If custom
  customFunction?: string; // TypeScript code as string
}

// ============================================================================
// Experiment Configuration
// ============================================================================

export interface ExperimentConfig {
  // Basic settings
  numPlayers: number;           // N (2-10)
  numRounds: number;            // T
  maxRefusals: number;          // Default: 3

  // Timing (milliseconds)
  announcementDuration: number; // Default: 10000
  communicationDuration: number;// Default: 180000 (3 min)
  actionDuration: number;       // Default: 30000 (30 sec)
  revelationDuration: number;   // Default: 5000

  // Payoff configuration
  payoffOrdering: PayoffOrdering;
  payoffBounds: { min: number; max: number };
  payoffGenerator: PayoffGeneratorConfig;

  // Player configuration
  players: PlayerConfig[];
}

export interface PlayerConfig {
  slot: number;             // 0 to N-1
  type: PlayerType;

  // If AI
  aiModel?: AIModel;
  aiSystemPrompt?: string;

  // If scripted
  scriptedStrategy?: ScriptedStrategy;
}

export interface Hypothesis {
  null: string;
  alternative: string;
  predictedCooperationRate: [number, number]; // [min, max]
  predictedDominantStrategy?: string;
  notes?: string;
}

// ============================================================================
// Experiment & Game State
// ============================================================================

export interface Experiment {
  id: string;
  name: string;
  createdBy: UserId;
  createdAt: Date;
  status: ExperimentStatus;

  config: ExperimentConfig;
  hypothesis?: Hypothesis;

  // Runtime data
  currentRound: number;
  playerStates: Record<PlayerId, PlayerState>;
  history: RoundHistory[];
}

export interface PlayerState {
  id: PlayerId;
  sessionId: string;        // Colyseus session ID
  slot: number;
  type: PlayerType;

  // Game state
  isConnected: boolean;
  cumulativeScore: number;
  refusalsRemaining: number;

  // Per-round state
  currentAction?: PlayerAction;
  actionSubmittedAt?: Date;
}

// ============================================================================
// Round History
// ============================================================================

export interface RoundHistory {
  roundNumber: number;

  // Phase 1: Payoff announcement
  payoffMatrix: PayoffMatrix;
  announcedAt: Date;

  // Phase 2: Communication
  chatLogs: ChatMessage[];      // All messages in this round

  // Phase 3: Actions
  actions: Record<PlayerId, PlayerAction>;
  submittedAt: Record<PlayerId, Date>;

  // Phase 4: Outcomes
  payoffs: Record<PlayerId, number>;
  cumulativeScores: Record<PlayerId, number>;
  revealedAt: Date;

  // Metadata
  duration: number;             // Total round time (ms)
}

export interface ChatMessage {
  id: string;
  fromPlayer: PlayerId;
  toPlayer: PlayerId;
  content: string;
  timestamp: Date;
  roundNumber: number;
}

// ============================================================================
// AI Agent Types
// ============================================================================

export interface AIAgentContext {
  playerId: PlayerId;
  currentRound: number;
  payoffMatrix: PayoffMatrix;
  myScore: number;
  leaderboard: Record<PlayerId, number>;
  chatHistory: Record<PlayerId, ChatMessage[]>;
  roundHistory: RoundHistory[];
  refusalsRemaining: number;
}

export interface AIAgentDecision {
  messages: Array<{ to: PlayerId; content: string }>;
  action: PlayerAction;
  reasoning?: string; // For logging/analysis
}

// ============================================================================
// Analytics & Metrics
// ============================================================================

export interface GameMetrics {
  // Aggregate statistics
  overallCooperationRate: number;
  cooperationRateByRound: number[];

  // Per-player statistics
  playerCooperationRates: Record<PlayerId, number>;
  playerAveragePayoffs: Record<PlayerId, number>;
  playerOptOutCounts: Record<PlayerId, number>;

  // Coalition analysis
  pairwiseCooperationMatrix: number[][]; // N x N matrix
  detectedCoalitions: Coalition[];

  // Deception metrics
  deceptionInstances: DeceptionEvent[];
  promiseKeepingRate: Record<PlayerId, number>;

  // Efficiency
  paretoEfficiencyRate: number; // % of rounds achieving Pareto optimal outcome
  socialWelfareByRound: number[]; // Sum of all payoffs per round

  // AI-specific (if applicable)
  aiVsHumanCooperationRates?: { ai: number; human: number };
  aiPerformanceAdvantage?: number; // AI avg score / human avg score
}

export interface Coalition {
  members: PlayerId[];
  strength: number; // 0-1, based on action correlation
  duration: number; // Number of consecutive rounds
  betrayals: number;
}

export interface DeceptionEvent {
  round: number;
  deceiver: PlayerId;
  victim: PlayerId;
  promisedAction: PlayerAction;
  actualAction: PlayerAction;
  chatEvidence: string; // Extracted message
}

export interface HypothesisTestResult {
  hypothesis: Hypothesis;
  actualCooperationRate: number;
  predicted: [number, number];
  testStatistic: number;
  pValue: number;
  conclusion: 'accept' | 'reject' | 'inconclusive';
  visualizations?: {
    cooperationOverTime: any;
    payoffDistribution: any;
  };
}

// ============================================================================
// Payoff Generator Function Type
// ============================================================================

export type PayoffGeneratorFunction = (
  roundNum: number,
  history: RoundHistory[],
  config: ExperimentConfig
) => PayoffMatrix;

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateExperimentRequest {
  name: string;
  config: ExperimentConfig;
  hypothesis?: Hypothesis;
}

export interface CreateExperimentResponse {
  experimentId: string;
  lobbyCode: string;
}

export interface JoinLobbyRequest {
  lobbyCode: string;
  playerName?: string;
}

export interface JoinLobbyResponse {
  experimentId: string;
  playerId: PlayerId;
  roomId: string;
}

// ============================================================================
// Colyseus Message Types
// ============================================================================

export interface SubmitActionMessage {
  action: PlayerAction;
}

export interface SendChatMessage {
  to: PlayerId;
  content: string;
}

export interface PhaseStartMessage {
  phase: GamePhase;
  duration: number;
  payoffMatrix?: PayoffMatrix;
  actions?: Record<PlayerId, PlayerAction>;
  payoffs?: Record<PlayerId, number>;
  scores?: Record<PlayerId, number>;
}

export interface GameEndedMessage {
  finalScores: Record<PlayerId, number>;
  totalRounds: number;
}

export interface GameAbortedMessage {
  reason: 'insufficient_players' | 'experimenter_abort' | 'error';
}
