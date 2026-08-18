import type {
  MemoryLibraryRepository,
  MemoryLibrarySnapshot,
  MemoryPassage
} from '../domain/practice-library';

const STORAGE_KEY = 'verseTypeMemoryLibrary';
const VERSION = 1;
const EMPTY_SNAPSHOT: MemoryLibrarySnapshot = { favorites: [], recent: [] };

type StoredLibrary = MemoryLibrarySnapshot & { version: number };

export class BrowserMemoryLibraryRepository implements MemoryLibraryRepository {
  constructor(private readonly storage: Storage = localStorage) {}

  read(): MemoryLibrarySnapshot {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SNAPSHOT;

    try {
      const value: unknown = JSON.parse(raw);
      if (!isStoredLibrary(value)) return EMPTY_SNAPSHOT;
      return { favorites: value.favorites, recent: value.recent };
    } catch (error) {
      console.warn('Could not read the saved Memory library.', error);
      return EMPTY_SNAPSHOT;
    }
  }

  write(snapshot: MemoryLibrarySnapshot): void {
    const stored: StoredLibrary = { version: VERSION, ...snapshot };
    this.storage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
}

function isStoredLibrary(value: unknown): value is StoredLibrary {
  if (!isRecord(value) || value.version !== VERSION) return false;
  return Array.isArray(value.favorites)
    && value.favorites.every(isMemoryPassage)
    && Array.isArray(value.recent)
    && value.recent.every(isMemoryPassage);
}

function isMemoryPassage(value: unknown): value is MemoryPassage {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.book === 'string'
    && typeof value.translation === 'string'
    && isPositiveInteger(value.chapter)
    && isPositiveInteger(value.startVerse)
    && isPositiveInteger(value.endVerse)
    && typeof value.practicedAt === 'number'
    && Number.isFinite(value.practicedAt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
