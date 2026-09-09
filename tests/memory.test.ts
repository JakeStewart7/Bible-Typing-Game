import {
  createPassageId,
  recordRecentPassage,
  selectPracticeStartPassage,
  toggleFavoritePassage
} from '../src/memory/domain/practice-library.ts';
import {
  addPassage,
  advancePlaylist,
  createPlaylist,
  deletePlaylist,
  emptyPlaylistState,
  removePassage,
  renamePlaylist,
  reorderPassage,
  reorderPlaylist
} from '../src/memory/domain/playlists.ts';
import {
  hiddenMemoryWordIndices,
  hiddenPercentForVisibleWords,
  shouldMaskMemoryCharacter
} from '../src/memory/domain/visibility.ts';
import { equal, test } from './harness.ts';

test('Text visibility maps visible words to deterministic masked words', () => {
  equal(hiddenPercentForVisibleWords(100), 0);
  equal(hiddenPercentForVisibleWords(75), 25);
  equal(hiddenPercentForVisibleWords(50), 50);
  equal(hiddenPercentForVisibleWords(25), 75);
  equal(hiddenPercentForVisibleWords(0), 100);
  equal([...hiddenMemoryWordIndices(20, 0)], []);
  equal(hiddenMemoryWordIndices(20, 50).size, 10);
  equal(hiddenMemoryWordIndices(20, 100).size, 20);
  equal([...hiddenMemoryWordIndices(20, 37)], [...hiddenMemoryWordIndices(20, 37)]);
});

test('Memory keeps hidden word characters masked until correct while showing punctuation', () => {
  equal(shouldMaskMemoryCharacter(true, undefined, 'a'), true);
  equal(shouldMaskMemoryCharacter(true, 'x', 'a'), true);
  equal(shouldMaskMemoryCharacter(true, 'a', 'a'), false);
  equal(shouldMaskMemoryCharacter(true, undefined, ','), false);
  equal(shouldMaskMemoryCharacter(false, undefined, 'a'), false);
});

test('Practice starts from the newest passage or John 3:16', () => {
  const recent = { book: 'Psalms', chapter: 23, startVerse: 1, endVerse: 4, translation: 'kjv' };
  equal(selectPracticeStartPassage([recent]), recent);
  equal(selectPracticeStartPassage([]), {
    book: 'John', chapter: 3, startVerse: 16, endVerse: 16, translation: 'kjv'
  });
});

test('Memory library keeps unique recent passages and toggles favorites', () => {
  const reference = { book: 'John', chapter: 3, startVerse: 16, endVerse: 17, translation: 'kjv' };
  const passage = { ...reference, id: createPassageId(reference), practicedAt: 100 };
  const empty = { favorites: [], recent: [] };
  const recent = recordRecentPassage(recordRecentPassage(empty, passage), { ...passage, practicedAt: 200 });
  equal(recent.recent.length, 1);
  equal(recent.recent[0]?.practicedAt, 200);
  const favorite = toggleFavoritePassage(recent, passage);
  equal(favorite.favorites.map(item => item.id), [passage.id]);
  equal(toggleFavoritePassage(favorite, passage).favorites, []);
});

test('playlist operations create, rename, reorder, and delete playlists', () => {
  let state = createPlaylist(emptyPlaylistState(), 'psalms', ' Psalms ');
  state = createPlaylist(state, 'john', 'John');
  state = renamePlaylist(state, 'psalms', 'Psalms to remember');
  state = reorderPlaylist(state, 1, 0);
  equal(state.playlists.map(playlist => [playlist.id, playlist.name]), [
    ['john', 'John'],
    ['psalms', 'Psalms to remember']
  ]);
  equal(deletePlaylist(state, 'john').playlists.map(playlist => playlist.id), ['psalms']);
});

test('playlist passage operations preserve progress and wrap after a completed cycle', () => {
  const john = { book: 'John', chapter: 3, startVerse: 16, endVerse: 17, translation: 'kjv' };
  const psalms = { book: 'Psalms', chapter: 23, startVerse: 1, endVerse: 2, translation: 'kjv' };
  let state = createPlaylist(emptyPlaylistState(), 'memory', 'Memory');
  state = addPassage(state, 'memory', john);
  state = addPassage(state, 'memory', psalms);
  state = addPassage(state, 'memory', john);
  equal(state.playlists[0]?.passages.length, 2);
  state = advancePlaylist(state, 'memory').state;
  state = reorderPassage(state, 'memory', 1, 0);
  equal(state.playlists[0]?.currentIndex, 0);
  state = removePassage(state, 'memory', 1);
  const advanced = advancePlaylist(state, 'memory');
  equal(advanced.completedCycle, true);
  equal(advanced.state.playlists[0]?.currentIndex, 0);
});
