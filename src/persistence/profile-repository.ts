import type { AppStorage, StoredValue } from './storage.ts';
import { decodeJson } from './storage.ts';

const nonNegativeNumber = (raw: string): number | null => {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const xpValue: StoredValue<number> = {
  key: 'verseTypeXp',
  decode: nonNegativeNumber,
  encode: String
};

const bestWpmValue: StoredValue<number> = {
  key: 'verseTypeBest',
  decode: nonNegativeNumber,
  encode: String
};

const sessionsValue: StoredValue<number[]> = {
  key: 'verseTypeWpmSessions',
  decode: decodeJson((value): value is number[] =>
    Array.isArray(value) && value.every(item => typeof item === 'number' && Number.isFinite(item) && item >= 0))
};

export type StoredProfile = {
  xp: number;
  bestWpm: number;
  sessions: number[];
};

export class ProfileRepository {
  private readonly storage: AppStorage;

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  read(): StoredProfile {
    return {
      xp: this.storage.read(xpValue, 0),
      bestWpm: this.storage.read(bestWpmValue, 0),
      sessions: this.storage.read(sessionsValue, [])
    };
  }

  recordSession(wpm: number, earnedXp: number): StoredProfile {
    const profile = this.read();
    const updated = {
      xp: profile.xp + earnedXp,
      bestWpm: Math.max(profile.bestWpm, wpm),
      sessions: [...profile.sessions, wpm]
    };
    this.storage.write(xpValue, updated.xp);
    this.storage.write(bestWpmValue, updated.bestWpm);
    this.storage.write(sessionsValue, updated.sessions);
    return updated;
  }
}
