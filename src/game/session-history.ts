import type { GameStats } from './stats';

export interface SessionHistoryRepository {
  readPrevious(): Pick<GameStats, 'wpm' | 'accuracy'> | null;
  save(stats: Pick<GameStats, 'wpm' | 'accuracy'>): void;
}

const STORAGE_KEY = 'verseTypeLastSession';

export class BrowserSessionHistoryRepository implements SessionHistoryRepository {
  constructor(private readonly storage: Storage = localStorage) {}

  readPrevious(): Pick<GameStats, 'wpm' | 'accuracy'> | null {
    try {
      const value: unknown = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? 'null');
      if (!isRecord(value)) return null;
      const wpm = Number(value.wpm);
      const accuracy = Number(value.accuracy);
      return Number.isFinite(wpm) && Number.isFinite(accuracy) ? { wpm, accuracy } : null;
    } catch (error) {
      console.warn('Could not read the previous typing session.', error);
      return null;
    }
  }

  save(stats: Pick<GameStats, 'wpm' | 'accuracy'>): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
