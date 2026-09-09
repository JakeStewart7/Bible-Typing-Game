import { createCampaignChunks } from '../src/campaign.ts';
import {
  addPassage,
  advancePlaylist,
  createPlaylist,
  emptyPlaylistState
} from '../src/memory/domain/playlists.ts';
import {
  formatPassageLabel,
  formatVerseSelectionLabel
} from '../src/memory/domain/passage.ts';
import { AppStateRepository } from '../src/persistence/app-state.ts';
import { ProfileRepository } from '../src/persistence/profile-repository.ts';
import { AppStorage } from '../src/persistence/storage.ts';
import { equal, test } from './harness.ts';

test('profile records lifetime and recent completed-passage WPM', () => {
  const repository = new ProfileRepository(new AppStorage(createMemoryStorage()));
  repository.recordSession(40, 25);
  repository.recordSession(60, 25);
  equal(repository.read(), {
    xp: 50,
    bestWpm: 60,
    sessions: [40, 60]
  });
});

test('profile repository preserves legacy localStorage keys and formats', () => {
  const storage = createMemoryStorage({
    verseTypeXp: '525',
    verseTypeBest: '72',
    verseTypeWpmSessions: '[40,60]'
  });
  const profile = new ProfileRepository(new AppStorage(storage)).read();
  equal(profile, { xp: 525, bestWpm: 72, sessions: [40, 60] });
});

test('app state repository validates legacy Journey progress', () => {
  const storage = createMemoryStorage({
    verseTypeCampaignProgress: '{"John:3:16-18":4}'
  });

  test('cursor smoothing preference defaults on and persists', () => {
    const repository = new AppStateRepository(new AppStorage(createMemoryStorage()));
    equal(repository.readCursorSmoothing(), true);
    repository.writeCursorSmoothing(false);
    equal(repository.readCursorSmoothing(), false);
  });

  test('passage labels omit duplicate single-verse ranges', () => {
    equal(formatPassageLabel({
      book: 'Isaiah', chapter: 46, startVerse: 3, endVerse: 3
    }), 'Isaiah 46:3');
    equal(formatPassageLabel({
      book: 'Isaiah', chapter: 46, startVerse: 3, endVerse: 5
    }), 'Isaiah 46:3–5');
    equal(formatVerseSelectionLabel(3, 3), 'Verse 3');
    equal(formatVerseSelectionLabel(3, 5), 'Verses 3–5');
  });
  const repository = new AppStateRepository(new AppStorage(storage));
  equal(repository.readCampaignProgress(), {
    'John:3:16-16': 4,
    'John:3:17-17': 4,
    'John:3:18-18': 4
  });
  storage.setItem('verseTypeCampaignProgress', '{"bad":99}');
  equal(repository.readCampaignProgress(), {});
});

test('recent passages are deduplicated and bounded', () => {
  const repository = new AppStateRepository(new AppStorage(createMemoryStorage()));
  for (let chapter = 1; chapter <= 12; chapter++) {
    repository.recordRecentPassage({
      book: 'John', chapter, startVerse: 1, endVerse: 3, translation: 'kjv'
    });
  }
  repository.recordRecentPassage({
    book: 'John', chapter: 5, startVerse: 1, endVerse: 3, translation: 'kjv'
  });
  const recent = repository.readRecentPassages();
  equal(recent.length, 10);
  equal(recent[0]?.chapter, 5);
  equal(recent.filter(item => item.chapter === 5).length, 1);
});

test('Journey position and mode-specific favorites round-trip through app storage', () => {
  const repository = new AppStateRepository(new AppStorage(createMemoryStorage()));
  const position = createCampaignChunks('Obadiah')[0]!;
  const memoryFavorite = {
    book: 'John', chapter: 3, startVerse: 16, endVerse: 17, translation: 'kjv'
  };
  const practiceFavorite = {
    book: 'Psalms', chapter: 23, startVerse: 1, endVerse: 1, translation: 'kjv'
  };
  repository.writeJourneyPosition(position);
  repository.writePracticeFavorites([practiceFavorite]);
  repository.writeMemoryFavorites([memoryFavorite]);
  equal(repository.readJourneyPosition(), position);
  equal(repository.readPracticeFavorites(), [practiceFavorite]);
  equal(repository.readMemoryFavorites(), [memoryFavorite]);
});

test('memorization playlists round-trip through validated app storage', () => {
  const storage = createMemoryStorage();
  const repository = new AppStateRepository(new AppStorage(storage));
  const passage = {
    book: 'Romans', chapter: 8, startVerse: 1, endVerse: 2, translation: 'kjv'
  };
  let state = addPassage(
    createPlaylist(emptyPlaylistState(), 'romans-8', 'Romans 8'),
    'romans-8',
    passage
  );
  state = addPassage(state, 'romans-8', {
    ...passage, startVerse: 3, endVerse: 4
  });
  state = advancePlaylist(state, 'romans-8').state;
  repository.writePlaylistState(state);
  equal(repository.readPlaylistState(), state);
  storage.setItem('verseTypeMemorizationPlaylists', '{"version":1,"playlists":[{"id":"bad"}]}');
  equal(repository.readPlaylistState(), emptyPlaylistState());
});

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); }
  };
}
