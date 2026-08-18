import type { GameStats } from './stats';
import { AppStorage, decodeJson, type StoredValue } from '../persistence/storage';

export interface SessionHistoryRepository {
  readPrevious(): Pick<GameStats, 'wpm' | 'accuracy'> | null;
  save(stats: Pick<GameStats, 'wpm' | 'accuracy'>): void;
}

type SessionComparison = Pick<GameStats, 'wpm' | 'accuracy'>;

const sessionComparisonValue: StoredValue<SessionComparison> = {
  key: 'verseTypeLastSession',
  decode: decodeJson(isSessionComparison)
};

export class BrowserSessionHistoryRepository implements SessionHistoryRepository {
  constructor(private readonly storage: AppStorage) {}

  readPrevious(): SessionComparison | null {
    return this.storage.read(sessionComparisonValue, null);
  }

  save(stats: SessionComparison): void {
    this.storage.write(sessionComparisonValue, stats);
  }
}

function isSessionComparison(value: unknown): value is SessionComparison {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SessionComparison>;
  return Number.isFinite(candidate.wpm) && Number.isFinite(candidate.accuracy);
}
