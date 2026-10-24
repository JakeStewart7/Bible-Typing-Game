import { executeCommand } from './actions.ts';
import { createStronghold } from './state.ts';
import { advanceStronghold } from './simulation.ts';
import { getValidatedTypingLength } from '../../game/input.ts';
import type { StrongholdCommand, StrongholdMatchOptions, StrongholdSnapshot, StrongholdState } from './types.ts';
import { DEFAULT_MATCH_OPTIONS } from './options.ts';
import { inVision, updateFog } from './fog.ts';

export class StrongholdEngine {
  private state: StrongholdState;
  private options: StrongholdMatchOptions;

  constructor(options: StrongholdMatchOptions = DEFAULT_MATCH_OPTIONS) {
    this.state = createStronghold(options);
    this.options = structuredClone(options);
  }

  send(playerId: string, command: StrongholdCommand): void {
    const player = this.state.players.find(candidate => candidate.id === playerId);
    if (!player) throw new Error('Unknown Stronghold player.');
    executeCommand(this.state, player, command);
    updateFog(this.state);
  }
  advance(seconds: number): void {
    advanceStronghold(this.state, seconds);
  }
  restart(options: StrongholdMatchOptions = this.options): void {
    const state = createStronghold(options);
    this.options = structuredClone(options);
    this.state = state;
  }
  snapshot(playerId: string): StrongholdSnapshot {
    if (!this.state.players.some(player => player.id === playerId)) throw new Error('Unknown Stronghold player.');
    const { nextId: _nextId, players, fog, units, buildings, nodes, chunks, ...world } = this.state;
    const visible = (point: { x: number; y: number }) => inVision(fog.sources, point);
    return structuredClone({
      ...world, selfId: playerId,
      units: units.filter(unit => unit.kind !== 'invader' || visible(unit)).map(unit => ({
        ...unit, attackTarget: unit.attackTarget && visible(unit.attackTarget) ? unit.attackTarget : null
      })),
      buildings: buildings.filter(building => !building.enemy || visible(building)).map(building => ({
        ...building, attackTarget: building.attackTarget && visible(building.attackTarget) ? building.attackTarget : null
      })),
      nodes: nodes.filter(visible), chunks: chunks.filter(visible),
      fog: { ...fog, units: fog.units.filter(unit => !visible(unit)), buildings: fog.buildings.filter(building => !visible(building)),
        nodes: fog.nodes.filter(node => !visible(node)) },
      players: players.map(({ typingCredit: _credit, ...player }) => ({
        ...player, progress: getValidatedTypingLength(player.phrase, player.typed) / player.phrase.length,
        phrase: player.id === playerId ? player.phrase : ''
      }))
    });
  }
}
