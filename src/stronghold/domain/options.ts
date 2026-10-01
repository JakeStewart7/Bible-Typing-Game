import { PHRASE_LENGTHS, type StrongholdMatchOptions } from './types.ts';

export const DEFAULT_MATCH_OPTIONS: Readonly<StrongholdMatchOptions> = {
  resources: 50, length: 'medium', computersPaused: false
};
export const MAX_STARTING_RESOURCES = 10000;

export function isMatchOptions(value: unknown): value is StrongholdMatchOptions {
  return typeof value === 'object' && value !== null
    && 'resources' in value && typeof value.resources === 'number'
    && Number.isInteger(value.resources) && value.resources >= 0 && value.resources <= MAX_STARTING_RESOURCES
    && 'length' in value && PHRASE_LENGTHS.some(length => length === value.length)
    && 'computersPaused' in value && typeof value.computersPaused === 'boolean';
}

export function validateMatchOptions(options: StrongholdMatchOptions): void {
  if (!isMatchOptions(options)) throw new Error('Choose a valid text length, computer start state and 0-10000 starting supplies.');
}
