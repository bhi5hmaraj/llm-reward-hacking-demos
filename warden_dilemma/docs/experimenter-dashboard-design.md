# Experimenter Dashboard Design Document

**Version**: 1.0
**Date**: January 20, 2025
**Status**: Design Phase

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Design Goals](#design-goals)
4. [Feature Requirements](#feature-requirements)
5. [UI/UX Design](#uiux-design)
6. [Technical Implementation](#technical-implementation)
7. [Chat UI Improvements](#chat-ui-improvements)
8. [Implementation Plan](#implementation-plan)

---

## Executive Summary

This document outlines the design for an enhanced experimenter dashboard and improved chat UI for the Warden's Dilemma game. The experimenter needs real-time visibility into game dynamics, historical round data, and the ability to adjust game parameters (especially payoff matrices) between rounds.

**Key Improvements:**
- Real-time game statistics dashboard
- Aggregated round history view
- Chat message monitoring (all player conversations)
- Dynamic payoff matrix editor
- Player behavior analytics
- Improved player chat UI (DM-style interface)

---

## Current State Analysis

### What Exists Today

**Server (GameRoom.ts)**:
- ✅ 4-phase game loop (announcement, communication, action, revelation)
- ✅ Chat message routing (1:1 private messages)
- ✅ Payoff calculation engine
- ✅ Round history tracking (`RoundHistoryState` in schema)
- ✅ Chat history tracking (`ChatMessageState` in schema)
- ✅ Experimenter can start the game
- ✅ Experimenter receives all chat messages (lines 838-852)

**Client (GamePage.tsx)**:
- ✅ Basic player view with payoff matrix display
- ✅ Chat interface (dropdown + text input)
- ✅ Action selection buttons
- ✅ Player list sidebar
- ⚠️ **NO EXPERIMENTER-SPECIFIC VIEW** - experimenter sees same view as players

### Current Limitations

1. **No Experimenter Dashboard**: Experimenter joins as passive observer with no specialized UI
2. **No Historical View**: Can't review past rounds easily
3. **Chat Monitoring**: Experimenter receives messages but no organized view
4. **No Dynamic Controls**: Can't adjust payoff matrix between rounds
5. **Limited Analytics**: No aggregated statistics on cooperation rates, payoffs, etc.
6. **Poor Chat UX**: Dropdown-based chat is clunky compared to modern DM interfaces

---

## Design Goals

### Primary Goals

1. **Provide Real-Time Insight**: Experimenter can monitor game dynamics as they unfold
2. **Enable Dynamic Adjustment**: Allow payoff matrix changes between rounds
3. **Simplify Historical Analysis**: Easy access to past round data and trends
4. **Improve Communication Transparency**: Show all player conversations in organized view
5. **Enhance Player Experience**: Modern chat interface for better communication

### Non-Goals (Out of Scope for v1)

- Player AI/bot management
- Experiment template library
- Multi-game experiment tracking
- Export to CSV/analysis tools (manual copy sufficient for now)
- Video/audio chat

---

## Feature Requirements

### FR-1: Experimenter Dashboard Layout

**Priority**: P0 (Critical)

**Requirements**:
- Separate view for `role=experimenter` (different from player view)
- Multi-panel layout showing:
  - Game status (current round, phase, timer)
  - Live player statistics
  - Round history table
  - Chat monitor (all conversations)
  - Payoff matrix controls (visible during inter-round periods)

**Acceptance Criteria**:
- Experimenter sees dashboard when joining with `role=experimenter`
- Dashboard updates in real-time as game progresses
- All panels visible without scrolling on 1920x1080 screen

---

### FR-2: Live Game Statistics

**Priority**: P0 (Critical)

**Requirements**:
- **Current Round Panel**:
  - Round number (e.g., "Round 3 / 10")
  - Current phase with countdown timer
  - Phase progress indicator

- **Player Stats Panel**:
  - Table with columns: `Name | Score | Opt-Outs Left | Current Action | Status`
  - Real-time updates as actions are submitted
  - Visual indicators for action submission (✓ = submitted, ⏳ = pending)

- **Aggregate Stats Panel**:
  - Total cooperation rate across all rounds
  - Average payoff per round
  - Opt-out usage rate

**Acceptance Criteria**:
- Stats update within 500ms of state change
- Action submission shows immediate visual feedback
- Aggregate stats recalculate after each revelation phase

---

### FR-3: Round History View

**Priority**: P0 (Critical)

**Requirements**:
- **Round History Table**:
  - Columns: `Round | Phase | Actions | Payoffs | Cumulative Scores`
  - Expandable rows showing detailed data:
    - Payoff matrix for that round
    - Individual player actions (C/D/OPT_OUT)
    - Payoff received by each player
    - Chat messages from that round
  - Click row to expand details
  - Sorted by round (newest first)

- **Visual Indicators**:
  - Color-code actions: Green (C), Red (D), Gray (OPT_OUT)
  - Highlight rounds with high cooperation
  - Show trends (increasing/decreasing cooperation)

**Data Source**:
- `GameState.roundHistory` (already exists)
- `GameState.chatHistory` (filter by `roundNumber`)

**Acceptance Criteria**:
- All completed rounds visible in table
- Expanding row shows full round details
- History persists across page reloads (via Colyseus state sync)

---

### FR-4: Chat Monitoring Dashboard

**Priority**: P0 (Critical)

**Requirements**:
- **Chat Monitor Panel**:
  - Show ALL player-to-player messages (experimenter is passive observer)
  - Format: `[Round X] Player A → Player B: "message text"`
  - Group by round with collapsible sections
  - Timestamp for each message
  - Real-time updates as messages are sent

- **Filtering Options**:
  - Filter by round number
  - Filter by sender/recipient
  - Search by keyword

**Privacy Note**:
- Players know experimenter can see messages (stated in consent form)
- No anonymization needed

**Acceptance Criteria**:
- All chat messages visible to experimenter
- Messages appear within 500ms of being sent
- Filter/search works correctly

---

### FR-5: Dynamic Payoff Matrix Editor

**Priority**: P1 (High)

**Requirements**:
- **Editor UI**:
  - Modal/panel showing current payoff matrix as editable table
  - Inputs for `cooperate[k]`, `defect[k]`, `optOut` values
  - Validate that matrix values are numbers
  - Preview how matrix affects incentives (optional: show Nash equilibrium)

- **Timing**:
  - Editor available **ONLY** between rounds (after revelation, before next announcement)
  - Show "Edit Matrix for Next Round" button
  - Changes apply to upcoming round, not current round

- **Server Integration**:
  - Send `update_payoff_matrix` message to server
  - Server validates and stores override for next round
  - If no override, server uses PayoffEngine to generate matrix

**Message Protocol**:
```typescript
// Client → Server
{
  type: 'update_payoff_matrix',
  matrix: {
    cooperate: [number, number, ...],
    defect: [number, number, ...],
    optOut: number
  }
}

// Server → Client (confirmation)
{
  type: 'matrix_updated',
  nextRound: number,
  matrix: PayoffMatrix
}
```

**Acceptance Criteria**:
- Experimenter can edit matrix between rounds
- Changes apply to next round only
- Invalid inputs show error message
- Matrix persists in `roundHistory` for that round

---

### FR-6: Player Behavior Analytics

**Priority**: P2 (Nice to Have)

**Requirements**:
- **Per-Player Stats**:
  - Cooperation rate (% of rounds cooperated)
  - Average payoff per round
  - Opt-out usage
  - Chat activity (messages sent)

- **Trends Over Time**:
  - Line chart: cooperation rate by round
  - Identify inflection points (when behavior changed)

**Acceptance Criteria**:
- Stats accurate for each player
- Charts render correctly

---

## UI/UX Design

### Experimenter Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  WARDEN'S DILEMMA - EXPERIMENTER DASHBOARD                      │
│  Experiment: "Test Run 2025-01-20" | Room: abc123               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────┬───────────────────────────────────────────┐
│  CURRENT ROUND      │  PLAYER STATS                             │
│  Round 3 / 10       │                                           │
│  Phase: ACTION      │  Name      Score  Opts  Action  Status    │
│  ⏱️ 45s remaining    │  Player 1    12    2     C      ✓        │
│                     │  Player 2     8    3     ?      ⏳        │
│  [Edit Matrix]      │  Player 3    15    1     D      ✓        │
│  (available after   │  Player 4    10    3     ?      ⏳        │
│   revelation)       │                                           │
└─────────────────────┴───────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ROUND HISTORY                                    [Expand All]   │
├─────────────────────────────────────────────────────────────────┤
│  ▼ Round 2 | Revealed 2 min ago                                 │
│     Actions: Player 1 (C), Player 2 (D), Player 3 (C), P4 (C)   │
│     Payoffs: +5, +8, +5, +5 | Cumulative: 7, 8, 10, 5           │
│     Cooperation Rate: 75% | 3 messages exchanged                │
│                                                                  │
│  ▶ Round 1 | Revealed 5 min ago                                 │
│     Actions: Player 1 (C), Player 2 (C), Player 3 (C), P4 (D)   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CHAT MONITOR                                   [Filter ▼]       │
├─────────────────────────────────────────────────────────────────┤
│  [Round 2 - Communication Phase]                                │
│  14:32:15 - Player 1 → Player 2: "Let's both cooperate"         │
│  14:32:28 - Player 2 → Player 1: "Ok, I agree"                  │
│  14:32:40 - Player 3 → Player 4: "Defect this round?"           │
│                                                                  │
│  [Round 1 - Communication Phase]                                │
│  14:25:10 - Player 1 → Player 3: "Hi, what's your strategy?"    │
└─────────────────────────────────────────────────────────────────┘
```

---

### Payoff Matrix Editor Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  EDIT PAYOFF MATRIX - ROUND 4                          [Close X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Configure payoffs for the next round. Changes will apply to    │
│  Round 4 only.                                                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Your Action  │  0 others C  │  1 other C  │  2 others C  │ │
│  ├───────────────┼──────────────┼─────────────┼──────────────┤ │
│  │  Cooperate    │  [  2  ]     │  [  5  ]    │  [  8  ]     │ │
│  │  Defect       │  [  3  ]     │  [  6  ]    │  [  9  ]     │ │
│  │  Opt-Out      │              [  1  ]                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  💡 Nash Equilibrium: All Defect (payoff: 3 each)               │
│  💡 Social Optimum: All Cooperate (payoff: 8 each)              │
│                                                                  │
│  [ Reset to Default ]              [ Cancel ]  [ Apply Changes ] │
└─────────────────────────────────────────────────────────────────┘
```

---

### Player Chat UI (Improved DM-Style)

**Current**: Dropdown + text input (clunky)

**Proposed**: Sidebar with conversation threads (like Slack/Discord)

```
┌─────────────────────────────────────────────────────────────────┐
│  GAME VIEW                                                       │
├───────────────────────────────┬─────────────────────────────────┤
│  [Payoff Matrix]              │  CHAT                           │
│  [Action Buttons]             │  ┌───────────────────────────┐ │
│                               │  │ Conversations             │ │
│                               │  ├───────────────────────────┤ │
│                               │  │ ● Player 2 (3 new)        │ │
│                               │  │   "Let's cooperate..."    │ │
│                               │  ├───────────────────────────┤ │
│                               │  │ ○ Player 3                │ │
│                               │  │   "What do you think?"    │ │
│                               │  ├───────────────────────────┤ │
│                               │  │ ○ Player 4                │ │
│                               │  │   "Hi there"              │ │
│                               │  └───────────────────────────┘ │
│                               │                                 │
│                               │  [Active Conversation: Player 2]│
│                               │  ┌───────────────────────────┐ │
│                               │  │ Player 2: Let's cooperate │ │
│                               │  │   this round              │ │
│                               │  │                  14:32:15 │ │
│                               │  │ You: Ok, sounds good      │ │
│                               │  │                  14:32:28 │ │
│                               │  └───────────────────────────┘ │
│                               │                                 │
│                               │  [Type message...]    [Send]    │
└───────────────────────────────┴─────────────────────────────────┘
```

**Benefits**:
- See all conversations at a glance
- Visual indicators for unread messages
- Switch between conversations easily
- More intuitive than dropdown

---

## Technical Implementation

### State Schema Updates

**Add to `GameState.ts`**:

```typescript
/**
 * Experimenter override for payoff matrix
 */
export class MatrixOverride extends Schema {
  @type('number') forRound: number = 0;
  @type('string') matrix: string = '{}'; // JSON PayoffMatrix
  @type('number') createdAt: number = 0;

  constructor(forRound: number, matrix: PayoffMatrix) {
    super();
    this.forRound = forRound;
    this.matrix = JSON.stringify(matrix);
    this.createdAt = Date.now();
  }
}

// In GameState class, add:
@type([MatrixOverride]) matrixOverrides = new ArraySchema<MatrixOverride>();
```

**Rationale**: Track experimenter-set matrices separately from generated ones.

---

### Server Message Handlers

**Add to `GameRoom.ts`**:

```typescript
// In onCreate(), register handler:
this.onMessage('update_payoff_matrix', this.handleUpdateMatrix.bind(this));

// Handler implementation:
private async handleUpdateMatrix(
  client: Client,
  message: { matrix: PayoffMatrix }
): Promise<void> {
  // Verify experimenter
  if (client.sessionId !== this.experimenterSessionId) {
    client.send('error', { message: 'Only experimenter can edit matrix' });
    return;
  }

  // Verify timing (must be between rounds)
  if (!['waiting', 'revelation'].includes(this.state.phase)) {
    client.send('error', {
      message: 'Can only edit matrix between rounds'
    });
    return;
  }

  // Validate matrix structure
  if (!this.validatePayoffMatrix(message.matrix)) {
    client.send('error', { message: 'Invalid matrix format' });
    return;
  }

  // Store override for next round
  const override = new MatrixOverride(
    this.state.currentRound + 1,
    message.matrix
  );
  this.state.matrixOverrides.push(override);

  logger.info('Payoff matrix updated by experimenter', {
    round: this.state.currentRound + 1,
    matrix: message.matrix,
  });

  // Confirm to experimenter
  client.send('matrix_updated', {
    nextRound: this.state.currentRound + 1,
    matrix: message.matrix,
  });

  // Broadcast to all players (optional)
  this.broadcast('matrix_changed', {
    message: 'Experimenter has updated the payoff matrix for the next round',
  });
}

private validatePayoffMatrix(matrix: any): boolean {
  if (!matrix || typeof matrix !== 'object') return false;
  if (!Array.isArray(matrix.cooperate) || !Array.isArray(matrix.defect)) {
    return false;
  }
  if (matrix.cooperate.length !== this.config.numPlayers - 1) return false;
  if (matrix.defect.length !== this.config.numPlayers - 1) return false;
  if (typeof matrix.optOut !== 'number') return false;

  // All values must be numbers
  const allNumbers = [
    ...matrix.cooperate,
    ...matrix.defect,
    matrix.optOut
  ].every((v: any) => typeof v === 'number' && !isNaN(v));

  return allNumbers;
}
```

---

### Client Components

**New Files to Create**:

1. **`client/src/pages/ExperimenterDashboard.tsx`**
   - Main experimenter view
   - Replaces GamePage.tsx when `role=experimenter`
   - Panels: CurrentRound, PlayerStats, RoundHistory, ChatMonitor

2. **`client/src/components/PayoffMatrixEditor.tsx`**
   - Modal with editable matrix table
   - Validation and submit logic
   - Preview of Nash equilibrium (optional)

3. **`client/src/components/ChatMonitor.tsx`**
   - Display all chat messages grouped by round
   - Filtering by round/player
   - Real-time updates

4. **`client/src/components/RoundHistoryTable.tsx`**
   - Expandable rows for each round
   - Show actions, payoffs, scores, chat logs

5. **`client/src/components/ConversationList.tsx`** (for players)
   - DM-style conversation sidebar
   - Replaces dropdown selector

6. **`client/src/components/ChatThread.tsx`** (for players)
   - Message thread view for active conversation
   - Input box for sending messages

---

### Routing Update

**`client/src/App.tsx`**:

```typescript
// In GamePage route, add conditional rendering:
{role === 'experimenter' ? (
  <ExperimenterDashboard />
) : (
  <GamePage />
)}
```

Or create separate route:
```typescript
<Route path="/game/:roomId/experimenter" element={<ExperimenterDashboard />} />
```

---

### Data Flow for Matrix Updates

```
┌─────────────────┐
│  Experimenter   │
│  Clicks "Edit   │
│  Matrix"        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  PayoffMatrixEditor (Modal)     │
│  - User edits cooperate[k]      │
│  - User edits defect[k]         │
│  - User edits optOut            │
│  - Validates inputs             │
└────────┬────────────────────────┘
         │
         ▼ (on submit)
┌──────────────────────────────────┐
│  colyseusService.updateMatrix()  │
│  room.send('update_payoff_matrix'│
│              , { matrix })       │
└────────┬─────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  GameRoom.handleUpdateMatrix()  │
│  - Verify experimenter          │
│  - Validate matrix              │
│  - Store in matrixOverrides     │
│  - Broadcast confirmation       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  phaseAnnouncement() - Next Rnd │
│  - Check for override           │
│  - Use override if exists       │
│  - Else generate via engine     │
└─────────────────────────────────┘
```

---

## Chat UI Improvements

### Player Chat Interface

**Problem**: Current dropdown-based chat is unintuitive.

**Solution**: Implement conversation-based UI (like modern messaging apps).

**Features**:
1. **Conversation List** (left sidebar):
   - Show all other players as conversation threads
   - Unread message indicator (dot or count)
   - Last message preview
   - Click to open conversation

2. **Chat Thread** (main area):
   - Message bubbles (sent vs received)
   - Timestamps
   - Scrollable history
   - Input box at bottom

3. **Persistent Across Rounds**:
   - Conversations persist throughout game
   - Can scroll back to previous rounds' messages
   - Clear indicator of which round messages were sent in

**Implementation**:

```typescript
// client/src/components/ConversationList.tsx
interface Conversation {
  playerId: string;
  playerName: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
}

export function ConversationList({
  players,
  myPlayerId,
  chatMessages,
  onSelectConversation
}: {
  players: Map<string, PlayerState>;
  myPlayerId: string;
  chatMessages: ChatMessage[];
  onSelectConversation: (playerId: string) => void;
}) {
  const conversations = useMemo(() => {
    // Build conversation objects from players and messages
    const convos: Conversation[] = [];

    players.forEach((player, playerId) => {
      if (playerId === myPlayerId) return;

      // Find last message in thread
      const threadMessages = chatMessages.filter(
        (msg) =>
          (msg.from === myPlayerId && msg.to === playerId) ||
          (msg.from === playerId && msg.to === myPlayerId)
      );

      const lastMsg = threadMessages[threadMessages.length - 1];
      const unread = threadMessages.filter(
        (msg) => msg.from === playerId && !msg.read
      ).length;

      convos.push({
        playerId,
        playerName: player.name,
        lastMessage: lastMsg?.content || '',
        lastMessageTime: lastMsg?.timestamp || 0,
        unreadCount: unread,
      });
    });

    // Sort by most recent message
    return convos.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  }, [players, chatMessages, myPlayerId]);

  return (
    <div className="conversation-list">
      <h3>Conversations</h3>
      {conversations.map((convo) => (
        <div
          key={convo.playerId}
          className="conversation-item"
          onClick={() => onSelectConversation(convo.playerId)}
        >
          <div className="conversation-header">
            <span className="player-name">{convo.playerName}</span>
            {convo.unreadCount > 0 && (
              <span className="unread-badge">{convo.unreadCount}</span>
            )}
          </div>
          <div className="conversation-preview">
            {convo.lastMessage.slice(0, 40)}...
          </div>
        </div>
      ))}
    </div>
  );
}
```

```typescript
// client/src/components/ChatThread.tsx
export function ChatThread({
  otherPlayerId,
  otherPlayerName,
  myPlayerId,
  messages,
  onSendMessage,
}: {
  otherPlayerId: string;
  otherPlayerName: string;
  myPlayerId: string;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="chat-thread">
      <div className="chat-header">
        <h3>{otherPlayerName}</h3>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.from === myPlayerId ? 'sent' : 'received'}`}
          >
            <div className="message-bubble">
              {msg.content}
            </div>
            <div className="message-time">
              {formatTime(msg.timestamp)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder={`Message ${otherPlayerName}...`}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
```

**CSS Styling** (add to `client/src/index.css`):

```css
.conversation-list {
  border-right: 1px solid #ddd;
  overflow-y: auto;
  max-height: 500px;
}

.conversation-item {
  padding: 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background 0.2s;
}

.conversation-item:hover {
  background: #f5f5f5;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.player-name {
  font-weight: bold;
  font-size: 0.95rem;
}

.unread-badge {
  background: #2196F3;
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: bold;
}

.conversation-preview {
  color: #666;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-thread {
  display: flex;
  flex-direction: column;
  height: 500px;
}

.chat-header {
  padding: 12px;
  border-bottom: 1px solid #ddd;
  background: #fafafa;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #f9f9f9;
}

.message {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
}

.message.sent {
  align-items: flex-end;
}

.message.received {
  align-items: flex-start;
}

.message-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 18px;
  word-wrap: break-word;
}

.message.sent .message-bubble {
  background: #2196F3;
  color: white;
}

.message.received .message-bubble {
  background: #e0e0e0;
  color: black;
}

.message-time {
  font-size: 0.7rem;
  color: #999;
  margin-top: 2px;
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #ddd;
  background: white;
}

.chat-input input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 20px;
  outline: none;
}

.chat-input input:focus {
  border-color: #2196F3;
}

.chat-input button {
  padding: 10px 20px;
  border-radius: 20px;
  border: none;
  background: #2196F3;
  color: white;
  cursor: pointer;
  font-weight: bold;
}

.chat-input button:hover {
  background: #1976D2;
}

.chat-input button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

---

## Implementation Plan

### Phase 1: Core Dashboard (Week 1)

**Tasks**:
1. Create `ExperimenterDashboard.tsx` component
2. Implement current round panel
3. Implement player stats table with real-time updates
4. Add routing logic (if `role=experimenter`, show dashboard)
5. Test with 2 players + experimenter

**Deliverables**:
- Experimenter can see live game state
- Player stats update in real-time

---

### Phase 2: Round History & Chat Monitor (Week 1-2)

**Tasks**:
1. Create `RoundHistoryTable.tsx` component
2. Create `ChatMonitor.tsx` component
3. Add expand/collapse functionality for round details
4. Add filtering for chat messages
5. Test with multiple rounds

**Deliverables**:
- Experimenter can review past rounds
- Experimenter can monitor all chat messages

---

### Phase 3: Payoff Matrix Editor (Week 2)

**Tasks**:
1. Create `PayoffMatrixEditor.tsx` modal component
2. Add `update_payoff_matrix` message handler in GameRoom
3. Update `MatrixOverride` schema
4. Modify `phaseAnnouncement()` to check for overrides
5. Add validation for matrix inputs
6. Test matrix update flow

**Deliverables**:
- Experimenter can edit payoff matrix between rounds
- Changes apply correctly to next round

---

### Phase 4: Improved Player Chat (Week 2-3)

**Tasks**:
1. Create `ConversationList.tsx` component
2. Create `ChatThread.tsx` component
3. Update GamePage.tsx to use new chat components
4. Add CSS styling for modern chat UI
5. Add unread message tracking
6. Test chat experience with multiple players

**Deliverables**:
- Players have modern DM-style chat interface
- Conversations persist across rounds

---

### Phase 5: Analytics & Polish (Week 3)

**Tasks**:
1. Add aggregate statistics panel
2. Add cooperation rate trends
3. Add per-player analytics
4. Polish UI/UX (colors, spacing, responsive design)
5. Add loading states and error handling
6. Write documentation

**Deliverables**:
- Full-featured experimenter dashboard
- Polished player experience
- Documentation complete

---

## Open Questions

1. **Matrix Editor Timing**: Should experimenter be able to edit matrix during revelation phase, or only after revelation ends?
   - **Recommendation**: Allow during revelation (experimenter can plan ahead)

2. **Matrix Preview**: Should we calculate and show Nash equilibrium when editing matrix?
   - **Recommendation**: Nice to have, but not critical for v1

3. **Chat History Persistence**: Should chat persist if player leaves and rejoins?
   - **Recommendation**: Yes, use Colyseus state (already implemented via `chatHistory`)

4. **Player Anonymity**: Should players be anonymized in experimenter view?
   - **Recommendation**: No, experimenter needs to track individuals

5. **Real-Time Updates**: Should experimenter see actions as they're submitted, or only after action phase ends?
   - **Recommendation**: Real-time (shows who's dragging their feet)

---

## Success Metrics

**Usability**:
- Experimenter can find any round's data in < 10 seconds
- Experimenter can edit matrix in < 30 seconds
- Players find chat interface intuitive (subjective feedback)

**Performance**:
- Dashboard updates within 500ms of state change
- No lag when scrolling through round history
- Chat messages appear instantly

**Completeness**:
- All chat messages visible to experimenter
- All round data accessible in dashboard
- Matrix changes apply correctly

---

## Appendix: Example Data

### Sample Round History Entry

```typescript
{
  roundNumber: 3,
  payoffMatrix: {
    cooperate: [2, 5, 8],
    defect: [3, 6, 9],
    optOut: 1
  },
  actions: {
    'player_0': 'C',
    'player_1': 'D',
    'player_2': 'C',
    'player_3': 'OPT_OUT'
  },
  payoffs: {
    'player_0': 5,  // 1 other cooperated
    'player_1': 6,  // 2 others cooperated
    'player_2': 5,  // 1 other cooperated
    'player_3': 1   // opted out
  },
  scores: {
    'player_0': 15,
    'player_1': 18,
    'player_2': 12,
    'player_3': 8
  },
  revealedAt: 1737379200000
}
```

### Sample Chat Message

```typescript
{
  id: 'msg_abc123',
  fromPlayer: 'player_0',
  toPlayer: 'player_1',
  content: 'Let's both cooperate this round',
  timestamp: 1737379150000,
  roundNumber: 3
}
```

---

## References

- [Colyseus Schema Documentation](https://docs.colyseus.io/state/schema/)
- [React TypeScript Best Practices](https://react-typescript-cheatsheet.netlify.app/)
- [Warden's Dilemma Game Rules](../README.md)

---

**End of Document**
