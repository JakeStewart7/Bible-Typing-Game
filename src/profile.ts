const STORAGE_KEYS = {
  xp: 'verseTypeXp',
  bestWpm: 'verseTypeBest',
  sessions: 'verseTypeWpmSessions'
} as const;

export type PlayerProfile = {
  xp: number;
  level: number;
  bestWpm: number;
  lifetimeWpm: number;
  recentWpm: number;
};

export function readProfile(): PlayerProfile {
  const xp = readNumber(STORAGE_KEYS.xp);
  const sessions = readSessions();
  return {
    xp,
    level: Math.floor(xp / 500) + 1,
    bestWpm: readNumber(STORAGE_KEYS.bestWpm),
    lifetimeWpm: average(sessions),
    recentWpm: average(sessions.slice(-10))
  };
}

export function recordSession(wpm: number, earnedXp: number): PlayerProfile {
  const profile = readProfile();
  localStorage.setItem(STORAGE_KEYS.xp, String(profile.xp + earnedXp));
  if (wpm > profile.bestWpm) localStorage.setItem(STORAGE_KEYS.bestWpm, String(wpm));
  localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify([...readSessions(), wpm]));
  return readProfile();
}

function readNumber(key: string): number {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function readSessions(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessions) ?? '[]');
    return Array.isArray(value) ? value.filter(item => Number.isFinite(item) && item >= 0) : [];
  } catch {
    return [];
  }
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;
}
