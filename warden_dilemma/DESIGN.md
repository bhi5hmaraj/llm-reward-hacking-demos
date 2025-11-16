# Warden's Dilemma - Design Document

**Version**: 0.1.0
**Last Updated**: 2025-11-16

---

## Executive Summary

**Warden's Dilemma** is a web-based platform for studying strategic behavior in N-player iterated prisoner's dilemma games with private communication. The system supports mixed human-AI player populations, configurable payoff structures, and real-time analysis.

**Key Innovation**: Simultaneous private 1:1 communication channels enabling coalition formation, deception, and strategic signaling in a controlled experimental environment.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Game Mechanics](#game-mechanics)
3. [Data Models](#data-models)
4. [Colyseus Integration](#colyseus-integration)
5. [User Interfaces](#user-interfaces)
6. [AI Agent Integration](#ai-agent-integration)
7. [Analytics & Metrics](#analytics--metrics)
8. [Technical Stack](#technical-stack)
9. [Development Roadmap](#development-roadmap)

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Experimenter │  │    Player    │  │   Observer   │      │
│  │      UI      │  │      UI      │  │      UI      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                    WebSocket/HTTP                            │
│                            │                                 │
├────────────────────────────┼─────────────────────────────────┤
│                    SERVER LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │             Colyseus Server                          │   │
│  │  ┌────────────────┐  ┌────────────────┐             │   │
│  │  │  Lobby Room    │  │   Game Room    │             │   │
│  │  │  (Matchmaking) │  │  (Game State)  │             │   │
│  │  └────────────────┘  └────────────────┘             │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────┐  ┌────────┴─────────┐  ┌──────────────┐   │
│  │  Express    │  │  Payoff Engine   │  │  AI Service  │   │
│  │  REST API   │  │  (Generator)     │  │  (Agents)    │   │
│  └─────────────┘  └──────────────────┘  └──────────────┘   │
│                            │                                 │
├────────────────────────────┼─────────────────────────────────┤
│                    DATA LAYER                                │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │  File Store  │      │
│  │  (Game Data) │  │   (Cache)    │  │  (Exports)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Client Layer**:
- React TypeScript SPA
- Real-time UI updates via Colyseus client
- Monaco editor for custom payoff functions
- D3.js visualizations for analytics

**Server Layer**:
- **Colyseus Server**: Game state synchronization, room management
- **Express REST API**: Experiment CRUD, authentication, data export
- **Payoff Engine**: Executes payoff generation functions
- **AI Service**: Manages AI agent lifecycles, API calls

**Data Layer**:
- **PostgreSQL**: Persistent storage (experiments, results, chat logs)
- **Redis**: Session cache, real-time leaderboards
- **File Store**: Exported datasets (JSON/CSV)

---

## Game Mechanics

### Player Roles

| Role | Count | Capabilities |
|------|-------|-------------|
| **Experimenter** | 1 | Configure game, observe real-time, export data |
| **Player** | N (2-10) | Chat, choose actions, view history |
| **Observer** | 0-M | Spectate only (future feature) |

### Game Flow

```
SETUP PHASE (Experimenter)
  ↓
LOBBY PHASE (Player Join)
  ↓
[START GAME]
  ↓
┌─────────────────────────┐
│  ROUND t (1 to T)       │
├─────────────────────────┤
│ 1. Payoff Announcement  │ ← Game Master generates matrix
│    (PUBLIC, 10s)        │
│         ↓               │
│ 2. Communication Phase  │ ← N(N-1)/2 private DM channels
│    (configurable time)  │   All pairs chat simultaneously
│         ↓               │
│ 3. Action Selection     │ ← Each player chooses C/D/OPT-OUT
│    (configurable time)  │   Private, simultaneous
│         ↓               │
│ 4. Revelation & Scoring │ ← PUBLIC: Actions + payoffs shown
│    (5s pause)           │   Scores updated
└─────────────────────────┘
  ↓
[IF t < T, repeat]
  ↓
POST-GAME ANALYSIS
```

### Core Rules

#### Payoff Structure (N players)

Each outcome state defined by:
- **Your action**: C (cooperate), D (defect), or OPT-OUT
- **Number of others who cooperated**: k ∈ {0, 1, ..., N-1}

**Payoff Lookup Table**:
```typescript
type PayoffMatrix = {
  cooperate: number[],  // [0..N-1]: payoff when YOU cooperate, k others cooperate
  defect: number[],     // [0..N-1]: payoff when YOU defect, k others cooperate
  optOut: number        // Fixed penalty for opting out (usually 0)
}
```

**Example (N=3)**:
```javascript
{
  cooperate: [S₁, S₂, R₃],  // You C, 0/1/2 others C
  defect: [P₀, T₁, T₂],     // You D, 0/1/2 others C
  optOut: 0
}
```

#### Opt-Out Mechanic

- Each player has **max_refusals** tokens (configurable, default: 3)
- Opting out:
  - Consumes one token
  - Player receives `optOut` payoff (typically 0)
  - Does NOT affect other players' payoffs (treated as if player doesn't exist for that round)
- Once tokens exhausted, must participate

#### Minimum Player Rule

- Game requires **minimum 2 active players** per round
- If players disconnect/leave and < 2 remain: **Game ends immediately**
- Final round executes, then post-game analysis

#### Communication Rules

- **Cheap Talk**: Messages have no enforcement mechanism
- **Privacy**: 1:1 DMs only, no group chats
- **Opacity**: Players cannot see if others are chatting
- **History**: Chat history persists across rounds (per pair)

#### History & Transparency

Players can view:
- All past payoff matrices
- All past action outcomes (who played C/D/OPT-OUT)
- All past individual + cumulative scores
- Own chat history with each player

Players CANNOT view:
- Other players' chat logs
- Real-time experimenter analytics

---

## Data Models

### Core Entities

#### Experiment

```typescript
interface Experiment {
  id: string;
  name: string;
  createdBy: UserId;
  createdAt: Date;
  status: 'setup' | 'lobby' | 'in_progress' | 'completed' | 'aborted';

  config: ExperimentConfig;
  hypothesis?: Hypothesis;

  // Runtime data
  currentRound: number;
  playerStates: Record<PlayerId, PlayerState>;
  history: RoundHistory[];
}

interface ExperimentConfig {
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

interface PayoffOrdering {
  // Array of payoff variable names in descending order
  // Example: ["T₂", "R₃", "S₂", "T₁", "P₀", "S₁"]
  order: string[];

  // Optional: explicit constraints (Phase 2)
  // Example: "3*R₃ > T₂ + 2*S₂"
  constraints?: string[];
}

interface PayoffGeneratorConfig {
  type: 'preset' | 'custom';

  // If preset
  preset?: 'static' | 'random_walk' | 'adaptive_anti_coop' | 'escalating_stakes';
  presetParams?: Record<string, number>;

  // If custom
  customFunction?: string; // TypeScript code as string
}

interface PlayerConfig {
  slot: number;             // 0 to N-1
  type: 'human' | 'ai' | 'scripted';

  // If AI
  aiModel?: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-5-sonnet' | 'claude-3-haiku';
  aiSystemPrompt?: string;

  // If scripted
  scriptedStrategy?: 'always_cooperate' | 'always_defect' | 'random' | 'tit_for_tat' | 'grim_trigger';
}

interface Hypothesis {
  null: string;
  alternative: string;
  predictedCooperationRate: [number, number]; // [min, max]
  predictedDominantStrategy?: string;
  notes?: string;
}
```

#### Player State

```typescript
interface PlayerState {
  id: PlayerId;
  sessionId: string;        // Colyseus session ID
  slot: number;
  type: 'human' | 'ai' | 'scripted';

  // Game state
  isConnected: boolean;
  cumulativeScore: number;
  refusalsRemaining: number;

  // Per-round state
  currentAction?: 'C' | 'D' | 'OPT_OUT';
  actionSubmittedAt?: Date;
}
```

#### Round History

```typescript
interface RoundHistory {
  roundNumber: number;

  // Phase 1: Payoff announcement
  payoffMatrix: PayoffMatrix;
  announcedAt: Date;

  // Phase 2: Communication
  chatLogs: ChatMessage[];      // All messages in this round

  // Phase 3: Actions
  actions: Record<PlayerId, 'C' | 'D' | 'OPT_OUT'>;
  submittedAt: Record<PlayerId, Date>;

  // Phase 4: Outcomes
  payoffs: Record<PlayerId, number>;
  cumulativeScores: Record<PlayerId, number>;
  revealedAt: Date;

  // Metadata
  duration: number;             // Total round time (ms)
}

interface ChatMessage {
  id: string;
  fromPlayer: PlayerId;
  toPlayer: PlayerId;
  content: string;
  timestamp: Date;
  roundNumber: number;
}
```

#### Payoff Matrix

```typescript
interface PayoffMatrix {
  cooperate: number[];    // Length N
  defect: number[];       // Length N
  optOut: number;

  // Metadata
  generatedBy: 'preset' | 'custom';
  generatorParams?: Record<string, any>;
}

// Example for N=3:
const exampleMatrix: PayoffMatrix = {
  cooperate: [1, 3, 5],   // S₁, S₂, R₃
  defect: [2, 4, 6],       // P₀, T₁, T₂
  optOut: 0
};
```

### Database Schema (PostgreSQL)

```sql
-- Experiments table
CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  hypothesis JSONB,
  current_round INT DEFAULT 0,
  UNIQUE(id)
);

-- Game sessions (tracks active Colyseus room)
CREATE TABLE game_sessions (
  experiment_id UUID PRIMARY KEY REFERENCES experiments(id),
  room_id VARCHAR(255) NOT NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  player_states JSONB,
  UNIQUE(room_id)
);

-- Round history
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES experiments(id),
  round_number INT NOT NULL,
  payoff_matrix JSONB NOT NULL,
  actions JSONB NOT NULL,
  payoffs JSONB NOT NULL,
  cumulative_scores JSONB NOT NULL,
  announced_at TIMESTAMP,
  revealed_at TIMESTAMP,
  duration_ms INT,
  UNIQUE(experiment_id, round_number)
);

-- Chat logs
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES experiments(id),
  round_number INT NOT NULL,
  from_player VARCHAR(50) NOT NULL,
  to_player VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  INDEX(experiment_id, round_number),
  INDEX(from_player, to_player)
);

-- Users (experimenters)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Colyseus Integration

### Room Architecture

#### Lobby Room

**Purpose**: Matchmaking and experiment initialization

```typescript
import { Room, Client } from "colyseus";

class LobbyRoom extends Room {
  maxClients = 50;

  onCreate(options: { experimentId: string }) {
    this.setState({
      experiments: new Map(),
      waitingPlayers: []
    });
  }

  onJoin(client: Client, options: { role: 'experimenter' | 'player' }) {
    // Handle player queueing
    if (options.role === 'player') {
      this.state.waitingPlayers.push(client.sessionId);
    }
  }

  // Experimenter initiates game start
  onMessage(client: Client, message: any) {
    if (message.type === 'start_experiment') {
      this.createGameRoom(message.experimentId);
    }
  }

  private async createGameRoom(experimentId: string) {
    const gameRoom = await this.presence.create('game_room', {
      experimentId
    });

    // Transfer waiting players to game room
    this.broadcast('game_started', { roomId: gameRoom.roomId });
  }
}
```

#### Game Room

**Purpose**: Game state synchronization and round orchestration

```typescript
import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

class GameState extends Schema {
  @type("number") currentRound: number = 0;
  @type("string") phase: string = "announcement"; // announcement | communication | action | revelation
  @type("number") phaseEndsAt: number = 0; // Unix timestamp
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("string") currentPayoffMatrix: string = ""; // JSON string
  @type(["string"]) history: string[] = []; // Array of JSON strings
}

class PlayerState extends Schema {
  @type("string") id: string;
  @type("number") slot: number;
  @type("string") type: string;
  @type("boolean") isConnected: boolean = true;
  @type("number") cumulativeScore: number = 0;
  @type("number") refusalsRemaining: number;
  @type("string") currentAction?: string;
  @type("boolean") actionSubmitted: boolean = false;
}

class GameRoom extends Room<GameState> {
  maxClients = 20; // N players + experimenter + observers

  private experimentId: string;
  private config: ExperimentConfig;
  private phaseTimer?: NodeJS.Timeout;

  async onCreate(options: { experimentId: string }) {
    this.experimentId = options.experimentId;
    this.config = await this.loadExperimentConfig(options.experimentId);

    this.setState(new GameState());
    this.initializePlayers();

    // Register message handlers
    this.onMessage("submit_action", this.handleActionSubmit.bind(this));
    this.onMessage("send_chat", this.handleChatMessage.bind(this));
    this.onMessage("start_game", this.handleGameStart.bind(this));
  }

  private initializePlayers() {
    this.config.players.forEach((playerConfig) => {
      const playerState = new PlayerState();
      playerState.id = `player_${playerConfig.slot}`;
      playerState.slot = playerConfig.slot;
      playerState.type = playerConfig.type;
      playerState.refusalsRemaining = this.config.maxRefusals;

      this.state.players.set(playerState.id, playerState);
    });
  }

  onJoin(client: Client, options: { role: string; playerId?: string }) {
    console.log(`Client ${client.sessionId} joined as ${options.role}`);

    if (options.role === 'player' && options.playerId) {
      const playerState = this.state.players.get(options.playerId);
      if (playerState) {
        playerState.isConnected = true;
      }
    }
  }

  onLeave(client: Client, consented: boolean) {
    // Mark player as disconnected
    const player = Array.from(this.state.players.values())
      .find(p => p.isConnected && this.clients.find(c => c.sessionId === client.sessionId));

    if (player) {
      player.isConnected = false;

      // Check minimum player requirement
      const activePlayers = Array.from(this.state.players.values())
        .filter(p => p.isConnected && p.type === 'human');

      if (activePlayers.length < 2) {
        this.broadcast('game_aborted', { reason: 'insufficient_players' });
        this.disconnect();
      }
    }
  }

  private handleGameStart(client: Client) {
    // Only experimenter can start
    this.startNextRound();
  }

  private async startNextRound() {
    this.state.currentRound++;

    // Phase 1: Announcement
    await this.phaseAnnouncement();

    // Phase 2: Communication
    await this.phaseCommunication();

    // Phase 3: Action Selection
    await this.phaseActionSelection();

    // Phase 4: Revelation
    await this.phaseRevelation();

    // Check if game continues
    if (this.state.currentRound < this.config.numRounds) {
      this.startNextRound();
    } else {
      this.endGame();
    }
  }

  private async phaseAnnouncement() {
    this.state.phase = "announcement";

    // Generate payoff matrix
    const matrix = await this.generatePayoffMatrix();
    this.state.currentPayoffMatrix = JSON.stringify(matrix);

    this.state.phaseEndsAt = Date.now() + this.config.announcementDuration;

    this.broadcast('phase_start', {
      phase: 'announcement',
      payoffMatrix: matrix,
      duration: this.config.announcementDuration
    });

    await this.sleep(this.config.announcementDuration);
  }

  private async phaseCommunication() {
    this.state.phase = "communication";
    this.state.phaseEndsAt = Date.now() + this.config.communicationDuration;

    this.broadcast('phase_start', {
      phase: 'communication',
      duration: this.config.communicationDuration
    });

    await this.sleep(this.config.communicationDuration);
  }

  private async phaseActionSelection() {
    this.state.phase = "action";
    this.state.phaseEndsAt = Date.now() + this.config.actionDuration;

    // Reset action states
    this.state.players.forEach(player => {
      player.actionSubmitted = false;
      player.currentAction = undefined;
    });

    this.broadcast('phase_start', {
      phase: 'action',
      duration: this.config.actionDuration
    });

    // Wait for all actions or timeout
    await this.waitForActions();
  }

  private async waitForActions() {
    const deadline = Date.now() + this.config.actionDuration;

    while (Date.now() < deadline) {
      const allSubmitted = Array.from(this.state.players.values())
        .filter(p => p.isConnected)
        .every(p => p.actionSubmitted);

      if (allSubmitted) break;

      await this.sleep(100);
    }

    // Auto-submit OPT_OUT for non-submitted actions
    this.state.players.forEach(player => {
      if (player.isConnected && !player.actionSubmitted) {
        player.currentAction = 'OPT_OUT';
        player.actionSubmitted = true;
      }
    });
  }

  private async phaseRevelation() {
    this.state.phase = "revelation";

    // Calculate payoffs
    const actions = this.collectActions();
    const payoffs = this.calculatePayoffs(actions);

    // Update scores
    Object.entries(payoffs).forEach(([playerId, payoff]) => {
      const player = this.state.players.get(playerId);
      if (player) {
        player.cumulativeScore += payoff;
      }
    });

    // Save to history
    await this.saveRoundToHistory(actions, payoffs);

    // Broadcast results
    this.broadcast('phase_start', {
      phase: 'revelation',
      actions,
      payoffs,
      scores: this.getCurrentScores(),
      duration: this.config.revelationDuration
    });

    await this.sleep(this.config.revelationDuration);
  }

  private handleActionSubmit(client: Client, message: { action: 'C' | 'D' | 'OPT_OUT' }) {
    const player = Array.from(this.state.players.values())
      .find(p => p.isConnected && this.clients.find(c => c.sessionId === client.sessionId));

    if (!player || this.state.phase !== 'action') return;

    // Validate opt-out
    if (message.action === 'OPT_OUT' && player.refusalsRemaining <= 0) {
      client.send('error', { message: 'No refusals remaining' });
      return;
    }

    player.currentAction = message.action;
    player.actionSubmitted = true;

    if (message.action === 'OPT_OUT') {
      player.refusalsRemaining--;
    }
  }

  private handleChatMessage(client: Client, message: { to: string; content: string }) {
    const fromPlayer = Array.from(this.state.players.values())
      .find(p => this.clients.find(c => c.sessionId === client.sessionId));

    if (!fromPlayer) return;

    const chatMessage: ChatMessage = {
      id: generateId(),
      fromPlayer: fromPlayer.id,
      toPlayer: message.to,
      content: message.content,
      timestamp: new Date(),
      roundNumber: this.state.currentRound
    };

    // Save to database
    this.saveChatMessage(chatMessage);

    // Send to recipient only (and experimenter)
    const recipient = this.clients.find(c => {
      const player = Array.from(this.state.players.values())
        .find(p => p.id === message.to);
      return player && c.sessionId === player.id;
    });

    if (recipient) {
      recipient.send('chat_message', chatMessage);
    }

    // Also send to experimenter
    this.broadcast('chat_message', chatMessage, {
      except: client
    });
  }

  private collectActions(): Record<PlayerId, 'C' | 'D' | 'OPT_OUT'> {
    const actions: Record<string, 'C' | 'D' | 'OPT_OUT'> = {};

    this.state.players.forEach((player, id) => {
      if (player.currentAction) {
        actions[id] = player.currentAction;
      }
    });

    return actions;
  }

  private calculatePayoffs(actions: Record<PlayerId, 'C' | 'D' | 'OPT_OUT'>): Record<PlayerId, number> {
    const payoffs: Record<string, number> = {};
    const matrix: PayoffMatrix = JSON.parse(this.state.currentPayoffMatrix);

    // Count cooperators (excluding opt-outs)
    const activePlayers = Object.entries(actions)
      .filter(([_, action]) => action !== 'OPT_OUT');

    const numCooperators = activePlayers
      .filter(([_, action]) => action === 'C')
      .length;

    // Calculate each player's payoff
    Object.entries(actions).forEach(([playerId, action]) => {
      if (action === 'OPT_OUT') {
        payoffs[playerId] = matrix.optOut;
      } else {
        // k = number of OTHER players who cooperated
        const k = action === 'C'
          ? numCooperators - 1
          : numCooperators;

        const payoffArray = action === 'C' ? matrix.cooperate : matrix.defect;
        payoffs[playerId] = payoffArray[k] || 0;
      }
    });

    return payoffs;
  }

  private async generatePayoffMatrix(): Promise<PayoffMatrix> {
    // Implement payoff generation logic
    // Call PayoffEngine service
    return {
      cooperate: [1, 3, 5],
      defect: [2, 4, 6],
      optOut: 0
    };
  }

  private async saveRoundToHistory(actions: any, payoffs: any) {
    // Save to database via API
  }

  private async saveChatMessage(message: ChatMessage) {
    // Save to database
  }

  private getCurrentScores() {
    const scores: Record<string, number> = {};
    this.state.players.forEach((player, id) => {
      scores[id] = player.cumulativeScore;
    });
    return scores;
  }

  private async loadExperimentConfig(experimentId: string): Promise<ExperimentConfig> {
    // Load from database
    return {} as ExperimentConfig;
  }

  private endGame() {
    this.broadcast('game_ended', {
      finalScores: this.getCurrentScores(),
      totalRounds: this.state.currentRound
    });

    // Disconnect after delay
    setTimeout(() => this.disconnect(), 10000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { GameRoom };
```

---

## User Interfaces

### Experimenter Dashboard

**Route**: `/experiment/:id/dashboard`

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Warden's Dilemma  |  Experiment: "Trust Dynamics Study"    │
├─────────────────────────────────────────────────────────────┤
│  Round 5/10  |  Phase: Communication (1:23 remaining)       │
├───────────────────────────┬─────────────────────────────────┤
│                           │                                 │
│  PLAYER STATES            │  LIVE CHAT MONITOR              │
│  ┌────────────────────┐   │  ┌───────────────────────────┐ │
│  │ Alice  (Human)     │   │  │ [Alice → Bob]             │ │
│  │ Score: 45          │   │  │ 14:32 - Let's cooperate   │ │
│  │ Refusals: 2/3      │   │  │                           │ │
│  │ Status: Chatting   │   │  │ [Bob → Alice]             │ │
│  └────────────────────┘   │  │ 14:33 - Sounds good!      │ │
│                           │  │                           │ │
│  ┌────────────────────┐   │  │ [Alice → Carol]           │ │
│  │ Bob  (AI: GPT-4)   │   │  │ 14:34 - What's your plan? │ │
│  │ Score: 38          │   │  └───────────────────────────┘ │
│  │ Refusals: 3/3      │   │                                 │
│  │ Status: Typing...  │   │  Filter: [All Pairs ▾]          │
│  └────────────────────┘   │                                 │
│                           │                                 │
│  ┌────────────────────┐   │                                 │
│  │ Carol  (Human)     │   │                                 │
│  │ Score: 52          │   │                                 │
│  │ Refusals: 1/3      │   │                                 │
│  │ Status: Idle       │   │                                 │
│  └────────────────────┘   │                                 │
├───────────────────────────┴─────────────────────────────────┤
│  PAYOFF MATRIX (Current Round)                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  You \ Others  │  0C    │  1C    │  2C    │           │   │
│  │  ─────────────────────────────────────────            │   │
│  │  Cooperate     │  S₁=1  │  S₂=3  │  R₃=5  │           │   │
│  │  Defect        │  P₀=2  │  T₁=4  │  T₂=6  │           │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ROUND HISTORY                                              │
│  [Graph: Cooperation rate over time]                        │
│  [Table: Recent rounds with actions and payoffs]            │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Real-time player status updates
- Live chat monitoring (all pairs visible)
- Payoff matrix display
- Round progression tracker
- Pause/abort controls
- Export data button

---

### Player Interface

**Route**: `/game/:roomId/player/:playerId`

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Warden's Dilemma  |  Round 5/10  |  Your Score: 45         │
├─────────────────────────────────────────────────────────────┤
│  Phase: Communication (1:23 remaining)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PAYOFF MATRIX (This Round)                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  You \ Others  │  0C    │  1C    │  2C    │          │  │
│  │  ─────────────────────────────────────────           │  │
│  │  Cooperate     │  1     │  3     │  5     │          │  │
│  │  Defect        │  2     │  4     │  6     │          │  │
│  │  Opt-Out       │  0     │  0     │  0     │          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
├──────────────────────────┬──────────────────────────────────┤
│  CHAT                    │  GAME INFO                       │
│                          │                                  │
│  ┌───────────────────┐   │  Leaderboard:                    │
│  │ 📧 Bob            │   │  1. Carol  - 52                  │
│  ├───────────────────┤   │  2. You    - 45                  │
│  │ Bob: Hey!         │   │  3. Bob    - 38                  │
│  │ You: Let's C?     │   │                                  │
│  │ Bob: Sure!        │   │  Refusals remaining: 2           │
│  │                   │   │                                  │
│  │ [Type here...]    │   │  Round History:                  │
│  └───────────────────┘   │  [Expandable table]              │
│                          │                                  │
│  ┌───────────────────┐   │                                  │
│  │ 📧 Carol          │   │                                  │
│  ├───────────────────┤   │                                  │
│  │ Carol: Hi!        │   │                                  │
│  │ You: What's up?   │   │                                  │
│  │                   │   │                                  │
│  │ [Type here...]    │   │                                  │
│  └───────────────────┘   │                                  │
└──────────────────────────┴──────────────────────────────────┘

[During Action Phase, this appears instead:]

┌─────────────────────────────────────────────────────────────┐
│  SELECT YOUR ACTION                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  COOPERATE  │  │   DEFECT    │  │  OPT-OUT    │         │
│  │             │  │             │  │  (2 left)   │         │
│  │   [  C  ]   │  │   [  D  ]   │  │   [ --- ]   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  Timer: 0:25 remaining                                      │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Tabbed chat interface (one tab per other player)
- Real-time updates via Colyseus
- Payoff matrix always visible
- Leaderboard with current standings
- Round history viewer
- Action selection with countdown timer
- Visual feedback on submission

---

### Setup Wizard (Experimenter)

**Route**: `/experiment/new`

**Multi-step form**:

1. **Basic Info** (name, description)
2. **Game Parameters** (N, T, timings, max refusals)
3. **Payoff Ordering** (drag-and-drop interface)
4. **Payoff Generator** (preset selection or custom code editor)
5. **Player Configuration** (assign slots to human/AI/scripted)
6. **Hypothesis** (optional)
7. **Review & Launch**

---

## AI Agent Integration

### AI Service Architecture

```typescript
// services/ai-agent-service.ts

interface AIAgentContext {
  playerId: string;
  currentRound: number;
  payoffMatrix: PayoffMatrix;
  myScore: number;
  leaderboard: Record<PlayerId, number>;
  chatHistory: Record<PlayerId, ChatMessage[]>;
  roundHistory: RoundHistory[];
}

interface AIAgentDecision {
  messages: Array<{ to: PlayerId; content: string }>;
  action: 'C' | 'D' | 'OPT_OUT';
  reasoning?: string; // For logging/analysis
}

class AIAgentService {
  private clients: Record<string, OpenAI | Anthropic> = {};

  async initialize(config: ExperimentConfig) {
    config.players
      .filter(p => p.type === 'ai')
      .forEach(p => {
        if (p.aiModel?.startsWith('gpt')) {
          this.clients[p.slot] = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        } else if (p.aiModel?.startsWith('claude')) {
          this.clients[p.slot] = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }
      });
  }

  async getCommunicationDecision(
    playerId: string,
    context: AIAgentContext
  ): Promise<{ to: PlayerId; content: string }[]> {
    const client = this.clients[playerId];
    const prompt = this.buildCommunicationPrompt(context);

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: this.getSystemPrompt(context) },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8
    });

    return this.parseMessages(response.choices[0].message.content);
  }

  async getActionDecision(
    playerId: string,
    context: AIAgentContext
  ): Promise<AIAgentDecision> {
    const client = this.clients[playerId];
    const prompt = this.buildActionPrompt(context);

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: this.getSystemPrompt(context) },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    return JSON.parse(response.choices[0].message.content);
  }

  private getSystemPrompt(context: AIAgentContext): string {
    return `You are Player ${context.playerId} in a ${context.playoffMatrix.cooperate.length}-player iterated prisoner's dilemma game.

OBJECTIVE: Maximize your cumulative score over ${context.currentRound} rounds.

RULES:
- Each round, you can send private messages to other players, then choose an action (C=cooperate, D=defect, or OPT_OUT).
- Your payoff depends on YOUR action and the NUMBER of others who cooperate.
- Messages are private (1:1 only). Other players cannot see your conversations.
- You can lie, form alliances, or betray others. There is no enforcement.

STRATEGY CONSIDERATIONS:
- Short-term: Defecting when others cooperate maximizes immediate payoff (temptation).
- Long-term: Mutual cooperation may yield higher cumulative scores if trust is built.
- Reputation: Your actions are publicly revealed after each round.
- Deception: You can promise cooperation but defect (though this may harm future trust).

Be strategic, adaptive, and consider both immediate gains and long-term reputation effects.`;
  }

  private buildCommunicationPrompt(context: AIAgentContext): string {
    return `ROUND ${context.currentRound}

PAYOFF MATRIX:
${this.formatPayoffMatrix(context.payoffMatrix)}

YOUR CURRENT SCORE: ${context.myScore}

LEADERBOARD:
${this.formatLeaderboard(context.leaderboard)}

RECENT CHAT HISTORY:
${this.formatChatHistory(context.chatHistory)}

ROUND HISTORY:
${this.formatRoundHistory(context.roundHistory)}

You have 3 minutes to send messages to other players. What do you want to say?

Respond with a JSON array of messages:
[
  { "to": "player_1", "content": "Your message here" },
  { "to": "player_2", "content": "Another message" }
]`;
  }

  private buildActionPrompt(context: AIAgentContext): string {
    return `Now you must choose your action: COOPERATE (C), DEFECT (D), or OPT-OUT.

Based on:
- The payoff matrix
- Your chat conversations
- Other players' past actions
- Your current strategic position

Respond with JSON:
{
  "action": "C" | "D" | "OPT_OUT",
  "reasoning": "Brief explanation of your choice"
}`;
  }

  // Helper formatting methods...
}
```

### AI Agent Behavior Modes (Future)

Could implement different "personalities":

- **Rational**: Purely utility-maximizing
- **Trusting**: Cooperates until betrayed (Tit-for-Tat)
- **Deceptive**: Builds trust then exploits
- **Chaotic**: Unpredictable behavior
- **Researcher**: Explicitly tests hypotheses about opponent behavior

---

## Analytics & Metrics

### Computed Metrics (Real-time & Post-game)

```typescript
interface GameMetrics {
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
  aiVsHumanCooperationRates: { ai: number; human: number };
  aiPerformanceAdvantage: number; // AI avg score / human avg score
}

interface Coalition {
  members: PlayerId[];
  strength: number; // 0-1, based on action correlation
  duration: number; // Number of consecutive rounds
  betrayals: number;
}

interface DeceptionEvent {
  round: number;
  deceiver: PlayerId;
  victim: PlayerId;
  promisedAction: 'C' | 'D';
  actualAction: 'C' | 'D';
  chatEvidence: string; // Extracted message
}
```

### Deception Detection Algorithm

```typescript
function detectDeception(
  chatLogs: ChatMessage[],
  actions: Record<PlayerId, 'C' | 'D'>
): DeceptionEvent[] {
  const deceptions: DeceptionEvent[] = [];

  // Simple NLP: look for commitment keywords
  const cooperateKeywords = ['cooperate', 'work together', "let's C", 'trust me'];
  const defectKeywords = ['defect', 'betray', "I'm going D"];

  chatLogs.forEach(msg => {
    const lowerContent = msg.content.toLowerCase();

    let promisedAction: 'C' | 'D' | null = null;
    if (cooperateKeywords.some(kw => lowerContent.includes(kw))) {
      promisedAction = 'C';
    } else if (defectKeywords.some(kw => lowerContent.includes(kw))) {
      promisedAction = 'D';
    }

    if (promisedAction && actions[msg.fromPlayer] !== promisedAction) {
      deceptions.push({
        round: msg.roundNumber,
        deceiver: msg.fromPlayer,
        victim: msg.toPlayer,
        promisedAction,
        actualAction: actions[msg.fromPlayer],
        chatEvidence: msg.content
      });
    }
  });

  return deceptions;
}
```

### Hypothesis Testing

```typescript
interface HypothesisTestResult {
  hypothesis: Hypothesis;
  actualCooperationRate: number;
  predicted: [number, number];
  testStatistic: number;
  pValue: number;
  conclusion: 'accept' | 'reject' | 'inconclusive';
  visualizations: {
    cooperationOverTime: ChartData;
    payoffDistribution: ChartData;
  };
}

function testHypothesis(
  hypothesis: Hypothesis,
  results: GameMetrics
): HypothesisTestResult {
  const actual = results.overallCooperationRate;
  const [min, max] = hypothesis.predictedCooperationRate;

  // Simple range test (could use more sophisticated stats)
  const inRange = actual >= min && actual <= max;

  return {
    hypothesis,
    actualCooperationRate: actual,
    predicted: [min, max],
    testStatistic: 0, // TODO: Implement proper test
    pValue: 0,
    conclusion: inRange ? 'accept' : 'reject',
    visualizations: generateVisualizations(results)
  };
}
```

---

## Technical Stack

### Frontend

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "colyseus.js": "^0.15.0",
    "@monaco-editor/react": "^4.6.0",
    "d3": "^7.8.5",
    "recharts": "^2.10.0",
    "zustand": "^4.4.0",
    "tailwindcss": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

### Backend

```json
{
  "dependencies": {
    "colyseus": "^0.15.0",
    "express": "^4.18.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    "openai": "^4.20.0",
    "anthropic-sdk": "^0.9.0",
    "zod": "^3.22.0",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.6.0",
    "prisma": "^5.7.0"
  }
}
```

### Infrastructure

- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Web Server**: Nginx (production)
- **Process Manager**: PM2 (Node.js)

---

## Development Roadmap

### Phase 1: MVP (Weeks 1-3)

**Week 1**: Core infrastructure
- ✅ Project setup (folder structure, dependencies)
- ✅ Database schema + migrations
- ✅ Colyseus room scaffolding (Lobby + Game rooms)
- ✅ Basic Express API (CRUD for experiments)

**Week 2**: Game logic
- ✅ Payoff matrix generation (static preset)
- ✅ Round orchestration (4 phases)
- ✅ Action validation + payoff calculation
- ✅ Chat message routing
- ✅ Basic player UI (React components)

**Week 3**: Integration & polish
- ✅ Experimenter dashboard
- ✅ Player interface with chat
- ✅ Real-time state sync via Colyseus
- ✅ End-to-end testing (1 experiment with 3 human players)
- ✅ Data export (JSON)

**Deliverable**: Functional 3-player game with human players only, static payoff matrix, basic analytics.

---

### Phase 2: Flexibility (Weeks 4-5)

**Week 4**: Payoff customization
- Custom generator TypeScript editor (Monaco)
- Preset library (4 generators)
- Payoff ordering validation UI
- Min/max bounds enforcement

**Week 5**: AI integration
- AI agent service (OpenAI API)
- GPT-4 + Claude support
- Configurable system prompts
- AI vs. human metrics

**Deliverable**: Experimenter can configure custom payoff generators and add AI players.

---

### Phase 3: Advanced Analytics (Weeks 6-7)

**Week 6**: Metrics & hypothesis testing
- Coalition detection algorithm
- Deception detection (NLP-based)
- Pareto efficiency analysis
- Hypothesis comparison UI

**Week 7**: Visualizations
- D3.js charts (cooperation over time, heatmaps)
- Replay mode (step through rounds)
- Export improvements (CSV, formatted reports)

**Deliverable**: Rich post-game analysis with visualizations and hypothesis testing.

---

### Phase 4: Scale & Polish (Week 8+)

- Scripted bots (Tit-for-Tat, Always Defect, etc.)
- N-player support (up to 10)
- Observer role
- Authentication (experimenter accounts)
- Cloud deployment (AWS/GCP)
- Performance testing (concurrent experiments)

---

## Open Questions & Decisions Needed

1. **Payoff ordering validation**: Should we enforce strict PD constraints (e.g., T > R > P > S) or allow arbitrary orderings?

2. **Chat NLP**: How sophisticated should deception detection be? Simple keyword matching or full LLM-based intent classification?

3. **AI agent memory**: Should AI agents have persistent memory across experiments (learn from past games)?

4. **Real-time vs. turn-based**: Current design is semi-real-time (timed phases). Should we support fully asynchronous play (players join/leave)?

5. **Payoff generator sandboxing**: Custom TypeScript functions pose security risks. Use VM2, isolated workers, or restrict to JSON configs?

6. **Scaling**: Target concurrent experiments? Single server or distributed?

7. **Authentication**: Simple username or full OAuth (Google, GitHub)?

8. **Mobile support**: Should player UI be mobile-responsive, or desktop-only?

---

## Next Steps

1. **Review this design doc** - Get feedback on architecture decisions
2. **Set up project scaffold** - Initialize repo, install dependencies, configure tooling
3. **Implement database schema** - Prisma migrations for core tables
4. **Build Colyseus rooms** - Start with LobbyRoom + basic GameRoom
5. **Create basic UI** - React components for experimenter setup wizard

**Ready to proceed with implementation?** Let me know if any part of the design needs adjustment!
