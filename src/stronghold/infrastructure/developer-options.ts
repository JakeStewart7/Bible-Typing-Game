import { AppStorage, decodeJson } from '../../persistence/storage.ts';
import { DEFAULT_MATCH_OPTIONS, isMatchOptions, validateMatchOptions } from '../domain/options.ts';
import type { StrongholdMatchOptions } from '../domain/types.ts';
export const DEFAULT_MAP_ZOOM = 1.2;
export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 2;

export type DeveloperOptions = StrongholdMatchOptions & { mapZoom: number };
export const DEFAULT_DEVELOPER_OPTIONS: Readonly<DeveloperOptions> = { ...DEFAULT_MATCH_OPTIONS, mapZoom: DEFAULT_MAP_ZOOM };
function isStoredOptions(value: unknown): value is StrongholdMatchOptions & { mapZoom?: number } {
  return isMatchOptions(value) && (!('mapZoom' in value) || (typeof value.mapZoom === 'number'
    && Number.isFinite(value.mapZoom) && value.mapZoom >= MIN_MAP_ZOOM && value.mapZoom <= MAX_MAP_ZOOM));
}
const decodeOptions = decodeJson(isStoredOptions);
const storedOptions = {
  key: 'stronghold-developer-options',
  decode: (raw: string): DeveloperOptions | null => {
    const options = decodeOptions(raw);
    return options ? { ...options, mapZoom: options.mapZoom ?? DEFAULT_MAP_ZOOM } : null;
  }
};

export function validateDeveloperOptions(options: DeveloperOptions): void {
  validateMatchOptions(options);
  if (!Number.isFinite(options.mapZoom) || options.mapZoom < MIN_MAP_ZOOM || options.mapZoom > MAX_MAP_ZOOM) {
    throw new Error('Choose a starting map zoom between 100% and 200%.');
  }
}

export function readDeveloperOptions(storage: AppStorage): DeveloperOptions {
  return { ...storage.read(storedOptions, DEFAULT_DEVELOPER_OPTIONS) };
}
export function writeDeveloperOptions(storage: AppStorage, options: DeveloperOptions): void {
  validateDeveloperOptions(options);
  storage.write(storedOptions, options);
}
