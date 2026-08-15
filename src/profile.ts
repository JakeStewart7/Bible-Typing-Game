const STORAGE_KEYS = {
  xp: 'verseTypeXp',
  bestWpm: 'verseTypeBest',
  streak: 'verseTypeStreak',
  lastPlayed: 'verseTypeLastPlayed'
} as const;

export type PlayerProfile = {
  xp: number;
  level: number;
  bestWpm: number;
  streak: number;
};

export function readProfile(): PlayerProfile {
  const xp = readNumber(STORAGE_KEYS.xp);
  return {
    xp,
    level: Math.floor(xp / 500) + 1,
    bestWpm: readNumber(STORAGE_KEYS.bestWpm),
    streak: readNumber(STORAGE_KEYS.streak)
  };
}

export function recordSession(wpm: number, earnedXp: number, now = new Date()): PlayerProfile {
  const profile = readProfile();
  localStorage.setItem(STORAGE_KEYS.xp, String(profile.xp + earnedXp));
  if (wpm > profile.bestWpm) localStorage.setItem(STORAGE_KEYS.bestWpm, String(wpm));

  const today = now.toDateString();
  const previous = localStorage.getItem(STORAGE_KEYS.lastPlayed);
  if (previous !== today) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const streak = previous === yesterday.toDateString() ? profile.streak + 1 : 1;
    localStorage.setItem(STORAGE_KEYS.streak, String(streak));
  }
  localStorage.setItem(STORAGE_KEYS.lastPlayed, today);
  return readProfile();
}

function readNumber(key: string): number {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
