import type { CampaignChunk, CampaignProgress } from '../campaign';
import type { AppStorage, StoredValue } from './storage.ts';
import { decodeJson } from './storage.ts';

export type PassageReference = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  translation: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPassageReference = (value: unknown): value is PassageReference =>
  isRecord(value) &&
  typeof value.book === 'string' &&
  Number.isInteger(value.chapter) && Number(value.chapter) > 0 &&
  Number.isInteger(value.startVerse) && Number(value.startVerse) > 0 &&
  Number.isInteger(value.endVerse) && Number(value.endVerse) >= Number(value.startVerse) &&
  typeof value.translation === 'string';

const campaignProgressValue: StoredValue<CampaignProgress> = {
  key: 'verseTypeCampaignProgress',
  decode: decodeJson((value): value is CampaignProgress =>
    isRecord(value) && Object.values(value).every(stars => Number.isInteger(stars) && Number(stars) >= 0 && Number(stars) <= 5))
};

const journeyPositionValue: StoredValue<CampaignChunk> = {
  key: 'verseTypeJourneyPosition',
  decode: decodeJson((value): value is CampaignChunk =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.book === 'string' &&
    Number.isInteger(value.chapter) &&
    Number.isInteger(value.startVerse) &&
    Number.isInteger(value.endVerse))
};

const favoritePassagesValue: StoredValue<PassageReference[]> = {
  key: 'verseTypeMemoryFavorites',
  decode: decodeJson((value): value is PassageReference[] =>
    Array.isArray(value) && value.every(isPassageReference))
};

const recentPassagesValue: StoredValue<PassageReference[]> = {
  key: 'verseTypeRecentPassages',
  decode: decodeJson((value): value is PassageReference[] =>
    Array.isArray(value) && value.every(isPassageReference))
};

export class AppStateRepository {
  private readonly storage: AppStorage;

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  readCampaignProgress(): CampaignProgress {
    return this.storage.read(campaignProgressValue, {});
  }

  writeCampaignProgress(progress: CampaignProgress): void {
    this.storage.write(campaignProgressValue, progress);
  }

  readJourneyPosition(): CampaignChunk | null {
    return this.storage.read(journeyPositionValue, null);
  }

  writeJourneyPosition(chunk: CampaignChunk): void {
    this.storage.write(journeyPositionValue, chunk);
  }

  readMemoryFavorites(): PassageReference[] {
    return this.storage.read(favoritePassagesValue, []);
  }

  writeMemoryFavorites(favorites: PassageReference[]): void {
    this.storage.write(favoritePassagesValue, favorites);
  }

  readRecentPassages(): PassageReference[] {
    return this.storage.read(recentPassagesValue, []);
  }

  recordRecentPassage(passage: PassageReference): PassageReference[] {
    const distinct = this.readRecentPassages().filter(item => !samePassage(item, passage));
    const recent = [passage, ...distinct].slice(0, 10);
    this.storage.write(recentPassagesValue, recent);
    return recent;
  }
}

function samePassage(left: PassageReference, right: PassageReference): boolean {
  return left.book === right.book &&
    left.chapter === right.chapter &&
    left.startVerse === right.startVerse &&
    left.endVerse === right.endVerse &&
    left.translation === right.translation;
}
