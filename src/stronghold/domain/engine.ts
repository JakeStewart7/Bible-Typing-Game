import { executeCommand } from './actions.ts';
import { createStronghold } from './state.ts';
import { advanceStronghold } from './simulation.ts';
import { getValidatedTypingLength } from '../../game/input.ts';
import type { StrongholdCommand, StrongholdMatchOptions, StrongholdSnapshot, StrongholdState } from './types.ts';
import { DEFAULT_MATCH_OPTIONS } from './options.ts';

export class StrongholdEngine {
  private state: StrongholdState;
  private options: StrongholdMatchOptions;

  constructor(options: StrongholdMatchOptions = DEFAULT_MATCH_OPTIONS) {
    this.state = createStronghold(options);
    this.options = { ...options };
  }

  send(playerId: string, command: StrongholdCommand): void {
    const player = this.state.players.find(candidate => candidate.id === playerId);
    if (!player) throw new Error('Unknown Stronghold player.');
    executeCommand(this.state, player, command);
  }
  advance(seconds: number): void {
    advanceStronghold(this.state, seconds);
  }
  restart(options: StrongholdMatchOptions = this.options): void {
    const state = createStronghold(options);
    this.options = { ...options };
    this.state = state;
  }
  snapshot(playerId: string): StrongholdSnapshot {
    if (!this.state.players.some(player => player.id === playerId)) throw new Error('Unknown Stronghold player.');
    const { nextId: _nextId, players, ...world } = this.state;
    return structuredClone({
      ...world, selfId: playerId,
      players: players.map(({ typingCredit: _credit, ...player }) => ({
        ...player, progress: getValidatedTypingLength(player.phrase, player.typed) / player.phrase.length,
        phrase: player.id === playerId ? player.phrase : ''
      }))
    });
  }
}
