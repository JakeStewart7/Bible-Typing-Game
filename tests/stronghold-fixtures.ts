import { createStronghold as createSeasonalStronghold } from '../src/stronghold/domain/state.ts';
import type { Season, StrongholdMatchOptions } from '../src/stronghold/domain/types.ts';

export { addBuilding, addUnit } from '../src/stronghold/domain/state.ts';

// Summer leaves typing and resource values unchanged; movement tests choose fall explicitly.
export function createStronghold(options?: StrongholdMatchOptions, season: Season = 'summer') {
  return createSeasonalStronghold(options, season);
}
