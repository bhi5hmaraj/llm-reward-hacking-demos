/**
 * Lobby State Schema
 *
 * Manages player waiting room before game starts.
 */

import { Schema, type, ArraySchema } from '@colyseus/schema';

/**
 * Waiting player information
 */
export class WaitingPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') name: string = '';
  @type('string') slot: string = ''; // Which player slot they'll occupy
  @type('number') joinedAt: number = 0;

  constructor(sessionId: string, name: string, slot: string) {
    super();
    this.sessionId = sessionId;
    this.name = name;
    this.slot = slot;
    this.joinedAt = Date.now();
  }
}

/**
 * Lobby state
 *
 * Tracks experiment info and waiting players.
 */
export class LobbyState extends Schema {
  @type('string') experimentId: string = '';
  @type('string') experimentName: string = '';
  @type('number') requiredPlayers: number = 0;
  @type('boolean') isReady: boolean = false;

  @type([WaitingPlayer]) waitingPlayers = new ArraySchema<WaitingPlayer>();

  constructor(experimentId: string, experimentName: string, requiredPlayers: number) {
    super();
    this.experimentId = experimentId;
    this.experimentName = experimentName;
    this.requiredPlayers = requiredPlayers;
  }
}
