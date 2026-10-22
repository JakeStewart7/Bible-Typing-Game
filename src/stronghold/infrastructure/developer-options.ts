import { AppStorage, decodeJson } from '../../persistence/storage.ts';
import { DEFAULT_MATCH_OPTIONS, isMatchOptions, validateMatchOptions } from '../domain/options.ts';
import { PLAYER_COLORS, type PlayerColor, type Season, type StrongholdMatchOptions } from '../domain/types.ts';
export const DEFAULT_MAP_ZOOM = 2;
export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 2;

export type DeveloperOptions = StrongholdMatchOptions & {
  playerColor: PlayerColor; season: Season | 'random'; period: 'day' | 'night'; tier: number;
};
export const DEFAULT_DEVELOPER_OPTIONS: Readonly<DeveloperOptions> = {
  ...DEFAULT_MATCH_OPTIONS, playerColor: PLAYER_COLORS.Red, season: 'random', period: 'day', tier: 0
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
      season: options.season ?? 'random', period: options.period ?? 'day', tier: options.tier ?? 0
    };
  }
};

export function validateDeveloperOptions(options: DeveloperOptions): void {
  validateMatchOptions(options);
}

export function readDeveloperOptions(storage: AppStorage): DeveloperOptions {
  return { ...storage.read(storedOptions, DEFAULT_DEVELOPER_OPTIONS) };
}
export function writeDeveloperOptions(storage: AppStorage, options: DeveloperOptions): void {
  validateDeveloperOptions(options);
  storage.write(storedOptions, options);
}
