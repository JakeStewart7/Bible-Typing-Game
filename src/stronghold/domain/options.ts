import { PHRASE_LENGTHS, PLAYER_COLORS, SEASONS, STARTING_ENTITIES, type PlayerColor, type StartingCounts, type StrongholdMatchOptions } from './types.ts';
import { BUILDING_CAPS, UNIT_CAPS } from './rules.ts';

export const DEFAULT_MATCH_OPTIONS: Readonly<StrongholdMatchOptions> = {
  resources: 50, length: 'medium', computersPaused: false
};
export const MAX_STARTING_RESOURCES = 10000;
export const DEFAULT_STARTING_COUNTS: Readonly<StartingCounts> = { worker: 2, builder: 1, warrior: 2, tower: 0, archer: 0, catapult: 0 };
export const STARTING_LIMITS: Readonly<StartingCounts> = {
  worker: UNIT_CAPS.worker, builder: UNIT_CAPS.builder, warrior: UNIT_CAPS.warrior,
  tower: BUILDING_CAPS.tower, archer: UNIT_CAPS.archer, catapult: UNIT_CAPS.catapult
};

function isStartingCounts(value: unknown): value is Partial<StartingCounts> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.entries(value).every(([key, count]) => {
      const kind = STARTING_ENTITIES.find(kind => kind === key);
      return kind !== undefined && typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= STARTING_LIMITS[kind];
    });
}

export function isPlayerColor(value: unknown): value is PlayerColor {
  return Object.values(PLAYER_COLORS).some(color => color === value);
}

export function isMatchOptions(value: unknown): value is StrongholdMatchOptions {
  return typeof value === 'object' && value !== null
    && 'resources' in value && typeof value.resources === 'number'
    && Number.isInteger(value.resources) && value.resources >= 0 && value.resources <= MAX_STARTING_RESOURCES
    && 'length' in value && PHRASE_LENGTHS.some(length => length === value.length)
    && 'computersPaused' in value && typeof value.computersPaused === 'boolean'
    && (!('playerColor' in value) || isPlayerColor(value.playerColor))
    && (!('season' in value) || value.season === 'random' || SEASONS.some(season => season === value.season))
    && (!('period' in value) || value.period === 'day' || value.period === 'night')
    && (!('tier' in value) || (typeof value.tier === 'number' && Number.isInteger(value.tier) && value.tier >= 0 && value.tier <= 3))
    && (!('startingCounts' in value) || isStartingCounts(value.startingCounts));
}

export function validateMatchOptions(options: StrongholdMatchOptions): void {
  if (!isMatchOptions(options)) throw new Error('Choose a valid text length, computer start state, player color, season, day/night, tier 0-3, 0-10000 starting supplies and counts within population limits.');
}
