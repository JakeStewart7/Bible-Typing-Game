import { AppStorage, decodeJson } from '../../persistence/storage.ts';
import { DEFAULT_MATCH_OPTIONS, isMatchOptions, validateMatchOptions } from '../domain/options.ts';
import type { StrongholdMatchOptions } from '../domain/types.ts';

export type DeveloperOptions = StrongholdMatchOptions;
export const DEFAULT_DEVELOPER_OPTIONS: Readonly<DeveloperOptions> = DEFAULT_MATCH_OPTIONS;
const storedOptions = { key: 'stronghold-developer-options', decode: decodeJson(isMatchOptions) };

export function readDeveloperOptions(storage: AppStorage): DeveloperOptions {
  return { ...storage.read(storedOptions, DEFAULT_DEVELOPER_OPTIONS) };
}
export function writeDeveloperOptions(storage: AppStorage, options: DeveloperOptions): void {
  validateMatchOptions(options);
  storage.write(storedOptions, options);
}
