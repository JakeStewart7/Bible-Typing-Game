import { TIER_QUOTA } from './rules.ts';
import type { Participant } from './types.ts';

export function tierProgress(players: readonly Pick<Participant, 'contribution'>[]) {
  return {
    completed: players.reduce((total, player) => total + player.contribution, 0),
    goal: players.length * TIER_QUOTA
  };
}
