import type { BuildingKind, Participant, StrongholdState, UnitKind } from './types.ts';

export const ENTITY_LABELS: Record<UnitKind | BuildingKind, string> = {
  worker: 'Gatherer', builder: 'Builder', warrior: 'Warrior', archer: 'Archer', catapult: 'Catapult',
  invader: 'Invader', castle: 'Home base', 'enemy-base': 'Enemy base', relay: 'Relay', barracks: 'Barracks', tower: 'Tower', wall: 'Wall'
};

export function recordEvent(state: StrongholdState, text: string, playerId: string | null = null): void {
  state.events.push({ id: state.events.length + 1, elapsed: state.elapsed, playerId, text });
}

export function playerEvent(state: StrongholdState, player: Participant, text: string): void {
  recordEvent(state, `Player ${state.players.indexOf(player) + 1} ${text}`, player.id);
}
