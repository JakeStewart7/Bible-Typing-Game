import { TIER_CHARACTER_GOAL } from './rules.ts';
import type { Participant } from './types.ts';

export function tierProgress(players: readonly Pick<Participant, 'contribution'>[]) {
  return {
    completed: Math.round(players.reduce((total, player) => total + player.contribution, 0) * 100) / 100,
    goal: TIER_CHARACTER_GOAL
  };
}
