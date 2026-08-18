import { ProfileRepository } from './persistence/profile-repository';

export type PlayerProfile = {
  xp: number;
  level: number;
  bestWpm: number;
  lifetimeWpm: number;
  recentWpm: number;
};

export function readProfile(repository: ProfileRepository): PlayerProfile {
  const { xp, bestWpm, sessions } = repository.read();
  return {
    xp,
    level: Math.floor(xp / 500) + 1,
    bestWpm,
    lifetimeWpm: average(sessions),
    recentWpm: average(sessions.slice(-10))
  };
}

export function recordSession(
  wpm: number,
  earnedXp: number,
  repository: ProfileRepository
): PlayerProfile {
  repository.recordSession(wpm, earnedXp);
  return readProfile(repository);
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;
}
