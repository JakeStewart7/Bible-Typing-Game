import { normalizeCampaignProgress, type CampaignChunk, type CampaignProgress } from '../campaign.ts';
import {
  emptyPlaylistState,
  PLAYLIST_STATE_VERSION
} from '../memory/domain/playlists.ts';
import type { PlaylistState } from '../memory/domain/playlists.ts';
import type { PassageReference } from '../memory/domain/passage.ts';
import type { AppStorage, StoredValue } from './storage.ts';
import { decodeJson } from './storage.ts';

export type { PassageReference } from '../memory/domain/passage.ts';

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

const practiceFavoritePassagesValue: StoredValue<PassageReference[]> = {
  key: 'verseTypePracticeFavorites',
  decode: decodeJson((value): value is PassageReference[] =>
    Array.isArray(value) && value.every(isPassageReference))
};

const recentPassagesValue: StoredValue<PassageReference[]> = {
  key: 'verseTypeRecentPassages',
  decode: decodeJson((value): value is PassageReference[] =>
    Array.isArray(value) && value.every(isPassageReference))
};

const playlistStateValue: StoredValue<PlaylistState> = {
  key: 'verseTypeMemorizationPlaylists',
  decode: decodeJson(isPlaylistState)
};

export class AppStateRepository {
  private readonly storage: AppStorage;

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  readCampaignProgress(): CampaignProgress {
    return normalizeCampaignProgress(this.storage.read(campaignProgressValue, {}));
  }

  writeCampaignProgress(progress: CampaignProgress): void {
    this.storage.write(campaignProgressValue, normalizeCampaignProgress(progress));
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

  readPracticeFavorites(): PassageReference[] {
    return this.storage.read(practiceFavoritePassagesValue, []);
  }

  writePracticeFavorites(favorites: PassageReference[]): void {
    this.storage.write(practiceFavoritePassagesValue, favorites);
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

  readPlaylistState(): PlaylistState {
    return this.storage.read(playlistStateValue, emptyPlaylistState());
  }

  writePlaylistState(state: PlaylistState): void {
    this.storage.write(playlistStateValue, state);
  }
}

function samePassage(left: PassageReference, right: PassageReference): boolean {
  return left.book === right.book &&
    left.chapter === right.chapter &&
    left.startVerse === right.startVerse &&
    left.endVerse === right.endVerse &&
    left.translation === right.translation;
}

function isPlaylistState(value: unknown): value is PlaylistState {
  if (!isRecord(value) || value.version !== PLAYLIST_STATE_VERSION || !Array.isArray(value.playlists)) {
    return false;
  }
  const ids = new Set<string>();
  return value.playlists.every(playlist => {
    if (!isRecord(playlist) ||
      typeof playlist.id !== 'string' || !playlist.id ||
      typeof playlist.name !== 'string' || !playlist.name.trim() ||
      !Array.isArray(playlist.passages) || !playlist.passages.every(isPassageReference) ||
      !Number.isInteger(playlist.currentIndex)) {
      return false;
    }
    if (ids.has(playlist.id)) return false;
    ids.add(playlist.id);
    const passageIds = new Set(playlist.passages.map(passage =>
      `${passage.translation}:${passage.book}:${passage.chapter}:${passage.startVerse}:${passage.endVerse}`));
    if (passageIds.size !== playlist.passages.length) return false;
    const currentIndex = Number(playlist.currentIndex);
    return playlist.passages.length === 0
      ? currentIndex === 0
      : currentIndex >= 0 && currentIndex < playlist.passages.length;
  });
}
