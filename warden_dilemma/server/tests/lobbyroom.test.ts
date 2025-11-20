import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LobbyRoom } from '../src/rooms/LobbyRoom';

// Mock Redis service used by LobbyRoom
vi.mock('../src/services/redis.service', () => {
  return {
    getExperiment: vi.fn(async (experimentId: string) => ({
      id: experimentId,
      name: 'Test Experiment',
      status: 'SETUP',
      config: {
        numPlayers: 3,
        numRounds: 1,
        players: [
          { slot: 1, type: 'human', name: 'H1' },
          { slot: 2, type: 'human', name: 'H2' },
          { slot: 3, type: 'ai', name: 'Bot' },
        ],
        payoffGenerator: 'symmetric',
        payoffBounds: { min: -10, max: 10 },
      },
    })),
    saveExperiment: vi.fn(async () => {}),
  };
});

// Minimal Client stub compatible with Colyseus Client type
function makeClient(sessionId: string) {
  return {
    sessionId,
    send: vi.fn(),
  } as any;
}

describe('LobbyRoom', () => {
  let room: LobbyRoom;

  beforeEach(async () => {
    room = new LobbyRoom();
    await room.onCreate({ experimentId: 'exp-123' } as any);
  });

  it('sets requiredPlayers from config (humans only)', async () => {
    expect(room.state.requiredPlayers).toBe(2);
    expect(room.state.experimentName).toBe('Test Experiment');
    expect(room.state.waitingPlayers.length).toBe(0);
  });

  it('adds players to waiting list and assigns slots', async () => {
    const c1 = makeClient('s1');
    await room.onJoin(c1, { role: 'player', playerName: 'Alice' } as any);

    expect(room.state.waitingPlayers.length).toBe(1);
    expect(room.state.waitingPlayers.at(0)?.name).toBe('Alice');
    expect(room.state.waitingPlayers.at(0)?.slot).toBe('player_1');
    expect(c1.send).toHaveBeenCalledWith('player_assigned', expect.objectContaining({ playerId: 'player_1', slot: 1 }));

    const c2 = makeClient('s2');
    await room.onJoin(c2, { role: 'player', playerName: 'Bob' } as any);

    expect(room.state.waitingPlayers.length).toBe(2);
    expect(room.state.waitingPlayers.at(1)?.name).toBe('Bob');
    expect(room.state.waitingPlayers.at(1)?.slot).toBe('player_2');
  });

  it('marks lobby ready when required players have joined', async () => {
    expect(room.state.isReady).toBe(false);

    await room.onJoin(makeClient('s1'), { role: 'player', playerName: 'A' } as any);
    expect(room.state.isReady).toBe(false);

    await room.onJoin(makeClient('s2'), { role: 'player', playerName: 'B' } as any);
    expect(room.state.isReady).toBe(true);
  });
});
