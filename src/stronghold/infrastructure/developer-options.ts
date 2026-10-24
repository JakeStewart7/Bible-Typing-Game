import { AppStorage, decodeJson } from '../../persistence/storage.ts';
import { DEFAULT_MATCH_OPTIONS, DEFAULT_STARTING_COUNTS, isMatchOptions, validateMatchOptions } from '../domain/options.ts';
import { PLAYER_COLORS, type PlayerColor, type Season, type StartingCounts, type StrongholdMatchOptions } from '../domain/types.ts';
export const DEFAULT_MAP_ZOOM = 2;
export const MAP_ZOOM_LEVELS = [1.75, 2, 2.25, 2.5] as const;
export const MIN_MAP_ZOOM = MAP_ZOOM_LEVELS[0];
export const MAX_MAP_ZOOM = MAP_ZOOM_LEVELS[MAP_ZOOM_LEVELS.length - 1]!;

export type DeveloperOptions = StrongholdMatchOptions & {
  playerColor: PlayerColor; season: Season | 'random'; period: 'day' | 'night'; tier: number; startingCounts: StartingCounts;
};
export const DEFAULT_DEVELOPER_OPTIONS: Readonly<DeveloperOptions> = {
  ...DEFAULT_MATCH_OPTIONS, playerColor: PLAYER_COLORS.Red, season: 'random', period: 'day', tier: 0, startingCounts: { ...DEFAULT_STARTING_COUNTS }
};
function isStoredOptions(value: unknown): value is StrongholdMatchOptions & { mapZoom?: unknown } {
  return isMatchOptions(value);
}
const decodeOptions = decodeJson(isStoredOptions);
const storedOptions = {
  key: 'stronghold-developer-options',
  decode: (raw: string): DeveloperOptions | null => {
    const stored = decodeOptions(raw);
    if (!stored) return null;
    const { mapZoom: _obsoleteZoom, ...options } = stored;
    return {
      ...options, playerColor: options.playerColor ?? PLAYER_COLORS.Red,
      season: options.season ?? 'random', period: options.period ?? 'day', tier: options.tier ?? 0,
      startingCounts: { ...DEFAULT_STARTING_COUNTS, ...options.startingCounts }
    };
  }
};

export function validateDeveloperOptions(options: DeveloperOptions): void {
  validateMatchOptions(options);
}

export function readDeveloperOptions(storage: AppStorage): DeveloperOptions {
  const options = storage.read(storedOptions, DEFAULT_DEVELOPER_OPTIONS);
  return { ...options, startingCounts: { ...options.startingCounts } };
}
export function writeDeveloperOptions(storage: AppStorage, options: DeveloperOptions): void {
  validateDeveloperOptions(options);
  storage.write(storedOptions, options);
}
