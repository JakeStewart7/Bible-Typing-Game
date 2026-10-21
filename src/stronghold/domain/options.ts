import { PHRASE_LENGTHS, PLAYER_COLORS, type PlayerColor, type StrongholdMatchOptions } from './types.ts';

export const DEFAULT_MATCH_OPTIONS: Readonly<StrongholdMatchOptions> = {
  resources: 50, length: 'medium', computersPaused: false
};
export const MAX_STARTING_RESOURCES = 10000;

export function isPlayerColor(value: unknown): value is PlayerColor {
  return Object.values(PLAYER_COLORS).some(color => color === value);
}

export function isMatchOptions(value: unknown): value is StrongholdMatchOptions {
  return typeof value === 'object' && value !== null
    && 'resources' in value && typeof value.resources === 'number'
    && Number.isInteger(value.resources) && value.resources >= 0 && value.resources <= MAX_STARTING_RESOURCES
    && 'length' in value && PHRASE_LENGTHS.some(length => length === value.length)
    && 'computersPaused' in value && typeof value.computersPaused === 'boolean'
    && (!('playerColor' in value) || isPlayerColor(value.playerColor));
}

export function validateMatchOptions(options: StrongholdMatchOptions): void {
  if (!isMatchOptions(options)) throw new Error('Choose a valid text length, computer start state, player color and 0-10000 starting supplies.');
}
