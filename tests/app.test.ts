import { BOOKS, getChapterCount } from '../src/bible-data.ts';
import { getSampleVerseNumbers } from '../src/bible-api.ts';
import { chooseRandomVerseRange, chooseVerseRange, filterEndVerses, isValidPassageSelection, normalizeVerseNumbers } from '../src/passage-selector.ts';
import { createGame } from '../src/game/state.ts';
import { handleInput } from '../src/game/input.ts';
import { calculateStats } from '../src/game/stats.ts';
import { getVerseCount, VERSE_COUNTS } from '../src/verse-counts.ts';
import { advanceEnemy, buyUpgrade, completeDefense, createDefenseState, typeCharacter } from '../src/game/minigame.ts';
import {
  completePassage,
  createCampaignChunks,
  getBookProgress,
  getCampaignProgress,
  nextChunk,
  normalizeCampaignProgress,
  starsForWpm
} from '../src/campaign.ts';
import { AppStorage } from '../src/persistence/storage.ts';
import { AppStateRepository } from '../src/persistence/app-state.ts';
import {
  formatPassageLabel,
  formatVerseSelectionLabel
} from '../src/memory/domain/passage.ts';
import { ProfileRepository } from '../src/persistence/profile-repository.ts';
import { filterJourneyBooks, findJourneyContinuation, groupJourneyBooks, isJourneyBookUnlocked, journeyCurrency } from '../src/journey.ts';
import {
  hiddenMemoryWordIndices,
  hiddenPercentForVisibleWords,
  shouldMaskMemoryCharacter
} from '../src/memory/domain/visibility.ts';
import {
  createPassageId,
  recordRecentPassage,
  selectPracticeStartPassage,
  toggleFavoritePassage
} from '../src/memory/domain/practice-library.ts';
import { getCurrentWordIndex, getCurrentWordRange, getHintWordIndex, isHintAvailable } from '../src/game/hint.ts';
import { analyzeSession } from '../src/game/analysis.ts';
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
import { createChapterReader, nextChapterReaderRange } from '../src/typing/chapter-reader.ts';
import { RoomEngine } from '../src/multiplayer/domain/room-engine.ts';
import { scorePassageGuess } from '../src/multiplayer/domain/scoring.ts';
import type { MultiplayerPassage } from '../src/multiplayer/domain/types.ts';
import {
  MOCK_REFRESH_INTERVAL_MS,
  nextBotTyping,
  nextTypingDelayMs
} from '../src/multiplayer/infrastructure/mock-multiplayer-client.ts';
import { BOT_DIFFICULTY_OPTIONS } from '../src/multiplayer/domain/settings.ts';
import { selectPassageWithinLimit } from '../src/multiplayer/infrastructure/bible-passage-provider.ts';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
const test = (name: string, run: () => void | Promise<void>) => tests.push({ name, run });
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

test('canonical Bible metadata covers all books', () => {
  equal(BOOKS.length, 66);
  equal(getChapterCount('Genesis'), 50);
  equal(getChapterCount('Psalms'), 150);
  equal(getChapterCount('Revelation'), 22);
});

test('API verse metadata is normalized and deduplicated', () => {
  equal(normalizeVerseNumbers([{ verse: 3 }, { verse: 1 }, { verse: 3 }, {}]), [1, 3, 4]);
});

test('selector chooses a safe five-verse default range', () => {
  equal(chooseVerseRange([1, 2, 3, 4, 5, 6, 7]), { start: 1, end: 5 });
  equal(chooseVerseRange([16, 17]), { start: 16, end: 17 });
});

test('selector preserves eligible user selections', () => {
  equal(chooseVerseRange([1, 2, 3, 4], 2, 4), { start: 2, end: 4 });
  equal(filterEndVerses([1, 2, 3, 4], 3), [3, 4]);
});

test('changing the starting verse rebuilds eligible end verses', () => {
  equal(filterEndVerses([1, 2, 3, 4, 5], 4), [4, 5]);
  equal(chooseVerseRange(filterEndVerses([1, 2, 3, 4, 5], 4), 4, 2), { start: 4, end: 5 });
});

test('switching from a long chapter resets stale verse choices', () => {
  equal(chooseVerseRange([1, 2, 3], 16, 17), { start: 1, end: 3 });
});

test('random defense ranges contain seven verses within chapter boundaries', () => {
  equal(chooseRandomVerseRange(36, 7, () => 0), { start: 1, end: 7 });
  equal(chooseRandomVerseRange(36, 7, () => .999), { start: 30, end: 36 });
  equal(chooseRandomVerseRange(4, 7, () => .5), { start: 1, end: 4 });
});

test('chapter reader keeps active verses typeable and surrounding context subdued', () => {
  const reader = createChapterReader([
    { verse: 1, text: ' Before ' },
    { verse: 2, text: 'Active one.' },
    { verse: 3, text: 'Active two.' },
    { verse: 4, text: 'After' }
  ], { startVerse: 2, endVerse: 3 });
  equal(reader.activeText, 'Active one. Active two.');
  equal(reader.verses.map(verse => [verse.verse, verse.isActive]), [
    [1, false], [2, true], [3, true], [4, false]
  ]);
});

test('chapter reader continuation keeps range length and crosses chapter ends', () => {
  const reference = { book: 'John', chapter: 3, startVerse: 5, endVerse: 7, translation: 'kjv' };
  equal(nextChapterReaderRange(reference, 10, { book: 'John', chapter: 4, verseCount: 5 }), {
    ...reference, startVerse: 8, endVerse: 10
  });
  equal(nextChapterReaderRange({ ...reference, startVerse: 7, endVerse: 9 }, 10, {
    book: 'John', chapter: 4, verseCount: 5
  }), {
    ...reference, startVerse: 10, endVerse: 10
  });
  equal(nextChapterReaderRange({ ...reference, startVerse: 8, endVerse: 10 }, 10, {
    book: 'John', chapter: 4, verseCount: 2
  }), {
    book: 'John', chapter: 4, startVerse: 1, endVerse: 2, translation: 'kjv'
  });
});

test('chapter reader continuation advances a whole chapter as a whole chapter', () => {
  const reference = { book: 'John', chapter: 3, startVerse: 1, endVerse: 36, translation: 'kjv' };
  equal(nextChapterReaderRange(reference, 36, { book: 'John', chapter: 4, verseCount: 54 }), {
    book: 'John', chapter: 4, startVerse: 1, endVerse: 54, translation: 'kjv'
  });
});

test('selector rejects reversed and unavailable ranges', () => {
  const base = { book: 'John', chapter: 3, translation: 'web' };
  equal(isValidPassageSelection({ ...base, startVerse: 16, endVerse: 17 }, [16, 17]), true);
  equal(isValidPassageSelection({ ...base, startVerse: 17, endVerse: 16 }, [16, 17]), false);
  equal(isValidPassageSelection({ ...base, startVerse: 1, endVerse: 17 }, [16, 17]), false);
});

test('licensed sample selectors preserve canonical verse numbers', () => {
  equal(getSampleVerseNumbers('John', 3, 'esv'), [16, 17]);
  equal(getSampleVerseNumbers('John', 3, 'niv'), [16, 17]);
});

test('static verse metadata covers every canonical chapter', () => {
  equal(Object.keys(VERSE_COUNTS).length, 66);
  equal(Object.values(VERSE_COUNTS).reduce((total, chapters) => total + chapters.length, 0), 1189);
  equal(Object.values(VERSE_COUNTS).flat().reduce((total, count) => total + count, 0), 31102);
  equal(getVerseCount('John', 3), 36);
  equal(getVerseCount('Psalms', 119), 176);
});

test('typing engine calculates progress and errors', () => {
  const game = createGame('Faith');
  handleInput(game, 'Faitx');
  equal(game.errors, 1);
  equal(calculateStats(game).progress, 0);
  handleInput(game, 'Faith');
  equal(calculateStats(game).progress, 100);
  equal(calculateStats(game).accuracy, 80);
});

test('typing past a mistake does not affect scoring until its word is corrected', () => {
  const game = createGame('Faith grows');
  handleInput(game, 'Faixh grows');
  const blocked = calculateStats(game, game.startTime! + 60_000);
  equal(blocked.progress, 0);
  equal(blocked.wpm, 0);
  equal(blocked.accuracy, 75);

  handleInput(game, 'Faith grows');
  const corrected = calculateStats(game, game.startTime! + 60_000);
  equal(corrected.progress, 100);
  equal(corrected.wpm, 2);
  equal(corrected.accuracy, 91);
});

test('progress freezes instead of moving backward after an error', () => {
  const game = createGame('Faith grows');
  handleInput(game, 'Faith ');
  equal(calculateStats(game).progress, 55);
  handleInput(game, 'Faith x');
  equal(calculateStats(game).progress, 55);
});

test('accuracy freezes at the last correct scoring position', () => {
  const game = createGame('Faith grows');
  handleInput(game, 'Faith ');
  const beforeError = calculateStats(game).accuracy;
  handleInput(game, 'Faith xrows');
  equal(calculateStats(game).accuracy, 86);
  handleInput(game, 'Faith grows');
  equal(calculateStats(game).accuracy, 91);
});

test('backspacing freezes accuracy until a new unscored letter is typed', () => {
  const game = createGame('Faith');
  handleInput(game, 'Fai');
  equal(calculateStats(game).accuracy, 100);
  handleInput(game, 'F');
  equal(calculateStats(game).accuracy, 100);
  handleInput(game, 'Fai');
  equal(calculateStats(game).accuracy, 100);
  handleInput(game, 'Faith');
  equal(calculateStats(game).accuracy, 100);
});

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

test('hint timing and current-word selection are deterministic', () => {
  equal(getCurrentWordRange('Faith grows here', 7), { start: 6, end: 11 });
  equal(getCurrentWordRange('Faith grows here', 17), { start: 12, end: 16 });
  equal(getCurrentWordIndex('Faith grows here', 7), 1);
  equal(getHintWordIndex('Faith grows here', 5, null), 1);
  equal(getHintWordIndex('Faith grows here', 6, 1), 2);
  equal(getHintWordIndex('Faith grows here', 12, 2), null);
  equal(isHintAvailable(1_000, 3_000), false);
  equal(isHintAvailable(1_000, 3_001), true);
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

test('session analysis identifies difficult words and comparisons', () => {
  const game = createGame('Faith grows strong');
  handleInput(game, 'Faixh grows strong');
  handleInput(game, 'Faith grows strong');
  const stats = calculateStats(game, game.startTime! + 60_000);
  const analysis = analyzeSession(game, stats, { wpm: 2, accuracy: 80 });
  equal(analysis.difficultWords, ['Faith']);
  equal(analysis.strongestWords, ['strong', 'grows']);
  equal(analysis.mistakeCount, 1);
  equal(analysis.comparison, { wpmDifference: 2, accuracyDifference: 14 });
});

test('defense typing earns faith and damages enemies', () => {
  const state = createDefenseState();
  typeCharacter(state, true, () => .5);
  equal(state.faith, 1);
  equal(state.projectiles.length, 3);
  advanceEnemy(state, 2);
  equal(state.enemies[0].health, 3);
  equal(state.projectiles.length, 0);
  typeCharacter(state, false);
  equal(state.faith, 0);
  equal(Math.round(state.enemies[0].position), 18);
});

test('incorrect arcade typing does not advance shadows', () => {
  const state = createDefenseState();
  const position = state.enemies[0].position;
  typeCharacter(state, false);
  equal(state.enemies[0].position, position);
});

test('defense enemies advance and damage the fortress', () => {
  const state = createDefenseState();
  advanceEnemy(state, 20);
  equal(state.fortress < 100, true);
});

test('defense upgrades consume resources and improve levels', () => {
  const state = createDefenseState();
  state.faith = 100;
  equal(buyUpgrade(state, 'power'), true);
  equal(state.powerLevel, 1);
  equal(state.faith, 65);
  typeCharacter(state, true, () => .5);
  advanceEnemy(state, 2);
  equal(state.enemies[0].health, 2);
});

test('light is destroyed on contact and defeats low-health shadows', () => {
  const state = createDefenseState();
  state.enemies[0].health = 1;
  typeCharacter(state, true, () => .5);
  advanceEnemy(state, 2);
  equal(state.projectiles.length, 0);
  equal(state.enemiesDefeated, 1);
  equal(state.faith, 6);
});

test('multiple shadows can occupy the battlefield', () => {
  const state = createDefenseState();
  advanceEnemy(state, 3);
  equal(state.enemies.length, 2);
});

test('up to fifteen shadows can occupy the battlefield', () => {
  const state = createDefenseState();
  state.spawnTimer = -100;
  advanceEnemy(state, .01);
  equal(state.enemies.length, 15);
});

test('light targets the unified shadow line regardless of visual angle', () => {
  const state = createDefenseState();
  state.enemies.push({ id: 2, position: 10, health: 4, maxHealth: 4 });
  typeCharacter(state, true, () => .5);
  advanceEnemy(state, 2);
  equal(state.projectiles.length, 0);
  equal(state.enemies.some(enemy => enemy.health < enemy.maxHealth), true);
});

test('missed light disappears after crossing the battlefield', () => {
  const state = createDefenseState();
  state.enemies = [];
  typeCharacter(state, true, () => .5);
  advanceEnemy(state, 2);
  equal(state.projectiles.length, 0);
});

test('arcade volleys are deterministic and spread across the battlefield', () => {
  const state = createDefenseState();
  state.enemies.push({ id: 2, position: 45, health: 4, maxHealth: 4 });
  const values = [.25, .5, .75, .1, .9, .4];
  let index = 0;
  typeCharacter(state, true, () => values[index++ % values.length]!);
  equal(state.projectiles.map(projectile => ({
    target: Math.round(projectile.targetPosition),
    arc: Math.round(projectile.arcHeight)
  })), [
    { target: 11, arc: 17 },
    { target: 55, arc: 38 },
    { target: 17, arc: 63 }
  ]);
});

test('arcade projectiles collide consistently across animation-sized steps', () => {
  const state = createDefenseState();
  typeCharacter(state, true, () => .5);
  equal(state.projectiles.map(projectile => Math.round(projectile.arcHeight)), [20, 38, 60]);
  for (let step = 0; step < 40; step++) advanceEnemy(state, .05);
  equal(state.projectiles.length, 0);
  equal(state.enemies[0].health, 3);
});

test('completing defense awards a victory bonus', () => {
  const state = createDefenseState();
  completeDefense(state);
  equal(state.status, 'won');
  equal(state.faith, 150);
});

test('Journey progress creates a task for every verse', () => {
  const chunks = createCampaignChunks('John');
  equal(chunks[0], { id: 'John:1:1-1', book: 'John', chapter: 1, startVerse: 1, endVerse: 1 });
  equal(chunks.filter(chunk => chunk.chapter === 1).at(-1)?.endVerse, 51);
  equal(chunks.some((chunk, index) => index > 0 && chunk.chapter !== chunks[index - 1]?.chapter && chunk.startVerse !== 1), false);
});

test('Practice completions mark every selected verse and migrate legacy ranges', () => {
  const legacy = normalizeCampaignProgress({ 'John:3:1-3': 2 });
  equal(Object.keys(legacy), ['John:3:1-1', 'John:3:2-2', 'John:3:3-3']);
  const completed = completePassage(legacy, {
    book: 'John', chapter: 3, startVerse: 2, endVerse: 4
  }, 4);
  equal(completed['John:3:1-1'], 2);
  equal(completed['John:3:2-2'], 4);
  equal(completed['John:3:4-4'], 4);
});

test('campaign stars use researched speed and accuracy thresholds', () => {
  equal(starsForWpm(24, 100), 0);
  equal(starsForWpm(40, 100), 2);
  equal(starsForWpm(100, 100), 5);
  equal(starsForWpm(100, 89), 2);
});

test('campaign progress and next passage are deterministic', () => {
  const chunks = createCampaignChunks('Obadiah');
  const progress = { [chunks[0]!.id]: 3 };
  equal(getBookProgress('Obadiah', progress).completed, 1);
  equal(nextChunk(chunks[0]!), chunks[1]);
});

test('campaign summary counts completed books', () => {
  const progress = Object.fromEntries(createCampaignChunks('Obadiah').map(chunk => [chunk.id, 1]));
  equal(getCampaignProgress(progress).completedBooks, 1);
  equal(getCampaignProgress(progress).completedChapters, 1);
});

test('journey search supports fuzzy typed matching', () => {
  equal(filterJourneyBooks('mthw').slice(0, 1), ['Matthew']);
  equal(filterJourneyBooks('song sol').slice(0, 1), ['Song of Solomon']);
});

test('journey books are grouped into canonical testaments', () => {
  const groups = groupJourneyBooks(['Genesis', 'Matthew', 'Psalms', 'John']);
  equal(groups, [
    { testament: 'Old Testament', books: ['Genesis', 'Psalms'] },
    { testament: 'New Testament', books: ['Matthew', 'John'] }
  ]);
});

test('journey unlocks starting books and progresses deterministically', () => {
  equal(isJourneyBookUnlocked('Matthew', {}), true);
  equal(isJourneyBookUnlocked('Genesis', {}), true);
  equal(isJourneyBookUnlocked('Psalms', {}), true);
  equal(isJourneyBookUnlocked('Mark', {}), false);
  const completedMatthew = Object.fromEntries(createCampaignChunks('Matthew').map(chunk => [chunk.id, 1]));
  equal(isJourneyBookUnlocked('Mark', completedMatthew), true);
});

test('journey currency counts unique completed verses without using stars', () => {
  equal(journeyCurrency({ 'Matthew:1:1-3': 5, 'Genesis:1:1-3': 1, invalid: 5, 'Mark:1:1-3': 0 }), 2);
});

test('journey continuation preserves a valid stored passage and advances completed work', () => {
  const first = createCampaignChunks('Matthew')[0]!;
  equal(findJourneyContinuation({}, first), first);
  equal(findJourneyContinuation({ [first.id]: 1 }, first), createCampaignChunks('Matthew')[1]);
});

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

test('multiplayer scoring rewards exact references and degrades by distance', () => {
  const answer = { book: 'John', chapter: 3, startVerse: 16, endVerse: 19 };
  equal(scorePassageGuess({
    book: 'John', chapter: 3, startVerse: 16, endVerse: 19
  }, answer), 100);
  equal(scorePassageGuess({
    book: 'Matthew', chapter: null, startVerse: null, endVerse: null
  }, answer), 40);
  equal(scorePassageGuess({
    book: 'Romans', chapter: null, startVerse: null, endVerse: null
  }, answer), 20);
  equal(scorePassageGuess({
    book: 'Genesis', chapter: null, startVerse: null, endVerse: null
  }, answer), 0);
  equal(scorePassageGuess({
    book: 'John', chapter: 4, startVerse: 17, endVerse: 20
  }, answer), 98);
  equal(scorePassageGuess({
    book: 'Revelation', chapter: null, startVerse: null, endVerse: null
  }, { book: 'Isaiah', chapter: 5, startVerse: 1, endVerse: 1 }), 20);
});

test('bot difficulties define requested accuracy and speed ranges', () => {
  equal(MOCK_REFRESH_INTERVAL_MS, 100);
  equal(BOT_DIFFICULTY_OPTIONS.easy, {
    label: 'Easy', accuracy: .85, minimumWpm: 20, maximumWpm: 30
  });
  equal(BOT_DIFFICULTY_OPTIONS.medium, {
    label: 'Normal', accuracy: .9, minimumWpm: 40, maximumWpm: 50
  });
  equal(BOT_DIFFICULTY_OPTIONS.hard, {
    label: 'Hard', accuracy: .95, minimumWpm: 70, maximumWpm: 80
  });
  equal(BOT_DIFFICULTY_OPTIONS['very-hard'], {
    label: 'Very hard', accuracy: .96, minimumWpm: 90, maximumWpm: 110
  });
  equal(BOT_DIFFICULTY_OPTIONS.extreme, {
    label: 'Extreme', accuracy: .98, minimumWpm: 110, maximumWpm: 130
  });
  equal(nextBotTyping('Faith', '', 'easy', () => 0), 'F');
  equal(nextBotTyping('Faith', '', 'easy', () => .99) === 'F', false);
  equal(nextBotTyping('Faith', 'x', 'hard', () => 0), '');
  equal(
    nextTypingDelayMs(75, 'Faith', 'hard', () => 0)
      < nextTypingDelayMs(25, 'Faith', 'easy', () => 0),
    true
  );
  equal(measureBotWpm('easy', 25, 11) >= 20 && measureBotWpm('easy', 25, 11) <= 30, true);
  equal(measureBotWpm('medium', 45, 22) >= 40 && measureBotWpm('medium', 45, 22) <= 50, true);
  equal(measureBotWpm('hard', 75, 33) >= 70 && measureBotWpm('hard', 75, 33) <= 80, true);
  equal(
    measureBotWpm('very-hard', 100, 44) >= 90
      && measureBotWpm('very-hard', 100, 44) <= 110,
    true
  );
  equal(
    measureBotWpm('extreme', 120, 55) >= 110
      && measureBotWpm('extreme', 120, 55) <= 130,
    true
  );
});

test('multiplayer passage lengths enforce absolute character ceilings', () => {
  const verses = [
    { verse: 1, text: `${'A'.repeat(59)}.` },
    { verse: 2, text: `${'B'.repeat(58)}.` }
  ];
  equal(selectPassageWithinLimit('Test', 1, verses, 0, 60).text.length, 60);
  equal(selectPassageWithinLimit('Test', 1, verses, 0, 120).text.length, 120);
  equal(selectPassageWithinLimit('Test', 1, verses, 0, 120).reference.endVerse, 2);
  const boundary = selectPassageWithinLimit('Test', 1, [
    { verse: 1, text: 'Faith.' },
    { verse: 2, text: 'Hope' }
  ], 0, 6);
  equal(boundary.text, 'Faith.');
  equal(boundary.reference.endVerse, 1);
  const retried = selectPassageWithinLimit('Test', 1, [
    { verse: 1, text: 'A passage without terminal punctuation' },
    { verse: 2, text: 'Hope.' }
  ], 0, 20);
  equal(retried.text, 'Hope.');
});

test('only the host can add bots and each bot keeps its own difficulty', async () => {
  const passage: MultiplayerPassage = {
    text: 'Faith.',
    reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
  };
  const room = new RoomEngine('BOTS', { nextPassage: async () => passage });
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  let guestRejected = false;
  try {
    await room.dispatch('guest', { type: 'ADD_BOT' });
  } catch {
    guestRejected = true;
  }
  equal(guestRejected, true);
  await room.dispatch('host', { type: 'ADD_BOT' });
  const bot = room.getSnapshot('host').players.find(player => player.kind === 'simulated');
  equal(bot?.botDifficulty, 'medium');
  if (!bot) throw new Error('Expected a simulated player.');
  await room.dispatch('host', {
    type: 'UPDATE_BOT_DIFFICULTY',
    playerId: bot.id,
    difficulty: 'easy'
  });
  equal(room.getSnapshot('host').players.find(player => player.id === bot.id)?.botDifficulty, 'easy');
});

test('guess timer submits each current draft when the deadline expires', async () => {
  let now = 1_000;
  const passage: MultiplayerPassage = {
    text: 'Faith.',
    reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
  };
  const room = new RoomEngine(
    'TIMER',
    { nextPassage: async () => passage },
    { botDifficulty: 'medium', passageLength: 'short', includeGuessing: true },
    () => now
  );
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  await room.dispatch('guest', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  await room.dispatch('host', {
    type: 'UPDATE_GUESS',
    guess: { book: 'Hebrews', chapter: 11, startVerse: null, endVerse: null }
  });
  equal(room.getSnapshot('host').guessingEndsAt, 31_000);
  now = 31_000;
  room.tick();
  const snapshot = room.getSnapshot('host');
  equal(snapshot.phase, 'reveal');
  equal(snapshot.players[0]?.guess, {
    book: 'Hebrews', chapter: 11, startVerse: null, endVerse: null
  });
  equal(snapshot.players[1]?.guess, {
    book: '', chapter: null, startVerse: null, endVerse: null
  });
});

test('multiplayer can reveal immediately when passage guessing is disabled', async () => {
  const passage: MultiplayerPassage = {
    text: 'Faith.',
    reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
  };
  const room = new RoomEngine(
    'DIRECT',
    { nextPassage: async () => passage },
    { botDifficulty: 'medium', passageLength: 'short', includeGuessing: false }
  );
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  await room.dispatch('guest', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  const snapshot = room.getSnapshot('host');
  equal(snapshot.phase, 'reveal');
  equal(snapshot.guessingEndsAt, null);
  equal(snapshot.players.map(player => player.score), [null, null]);
});

test('multiplayer tracks actual cursors and freezes completed typing statistics', async () => {
  let now = 1_000;
  const passage: MultiplayerPassage = {
    text: 'Faith comes.',
    reference: { book: 'Romans', chapter: 10, startVerse: 17, endVerse: 17 }
  };
  const room = new RoomEngine(
    'STATS',
    { nextPassage: async () => passage },
    { botDifficulty: 'medium', passageLength: 'short', includeGuessing: true },
    () => now
  );
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  now = 2_000;
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'Faith x', sequence: 1 });
  let host = room.getSnapshot('host').players[0]!;
  equal({ cursor: host.cursor, progress: host.progress }, { cursor: 7, progress: 6 });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'Fax', sequence: 2 });
  host = room.getSnapshot('host').players[0]!;
  equal({ cursor: host.cursor, progress: host.progress }, { cursor: 3, progress: 6 });
  now = 3_000;
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 3 });
  host = room.getSnapshot('host').players[0]!;
  const completedStats = { wpm: host.wpm, accuracy: host.accuracy };
  now = 63_000;
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: '', sequence: 4 });
  host = room.getSnapshot('host').players[0]!;
  equal({ wpm: host.wpm, accuracy: host.accuracy }, completedStats);
  equal({ cursor: host.cursor, progress: host.progress }, {
    cursor: passage.text.length,
    progress: passage.text.length
  });

  test('multiplayer refresh ticks recalculate active WPM', async () => {
    let now = 1_000;
    const passage: MultiplayerPassage = {
      text: 'Faith',
      reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
    };
    const room = new RoomEngine('REFRESH', { nextPassage: async () => passage }, undefined, () => now);
    room.addPlayer('host', 'Host');
    room.addPlayer('guest', 'Guest');
    await room.dispatch('host', { type: 'START_ROUND' });
    await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'F', sequence: 1 });
    now += MOCK_REFRESH_INTERVAL_MS;
    room.tick();
    equal(room.getSnapshot('host').players[0]?.wpm, 120);
    now += MOCK_REFRESH_INTERVAL_MS;
    room.tick();
    equal(room.getSnapshot('host').players[0]?.wpm, 60);
  });
});

test('multiplayer restart resets authoritative typing statistics', async () => {
  let now = 1_000;
  const passage: MultiplayerPassage = {
    text: 'Faith',
    reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
  };
  const room = new RoomEngine(
    'RESTART',
    { nextPassage: async () => passage },
    { botDifficulty: 'medium', passageLength: 'short', includeGuessing: true },
    () => now
  );
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'Fa', sequence: 1 });
  now = 2_000;
  await room.dispatch('host', { type: 'RESTART_TYPING' });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'F', sequence: 2 });
  now = 3_000;
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 3 });
  const host = room.getSnapshot('host').players[0]!;
  equal({ wpm: host.wpm, accuracy: host.accuracy }, { wpm: 60, accuracy: 100 });
});

test('multiplayer room advances only after every player completes each phase', async () => {
  const passage: MultiplayerPassage = {
    text: 'Faith comes by hearing.',
    reference: { book: 'Romans', chapter: 10, startVerse: 17, endVerse: 17 }
  };
  const room = new RoomEngine('FAITH', { nextPassage: async () => passage });
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  equal(room.getSnapshot('host').phase, 'typing');
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'Faith', sequence: 1 });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  equal(room.getSnapshot('host').players[0]?.cursor, 5);
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 2 });
  equal(room.getSnapshot('host').phase, 'typing');
  await room.dispatch('guest', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  equal(room.getSnapshot('host').phase, 'guessing');
  const exactGuess = { book: 'Romans', chapter: 10, startVerse: 17, endVerse: 17 };
  await room.dispatch('host', { type: 'UPDATE_GUESS', guess: exactGuess });
  await room.dispatch('host', { type: 'SUBMIT_GUESS' });
  equal(room.getSnapshot('host').revealedReference, null);
  await room.dispatch('guest', { type: 'UPDATE_GUESS', guess: exactGuess });
  await room.dispatch('guest', { type: 'SUBMIT_GUESS' });
  equal(room.getSnapshot('host').phase, 'reveal');
  equal(room.getSnapshot('host').players.map(player => player.score), [100, 100]);
  let rejectedEarlyStart = false;
  try {
    await room.dispatch('host', { type: 'START_ROUND' });
  } catch {
    rejectedEarlyStart = true;
  }
  equal(rejectedEarlyStart, true);
  await room.dispatch('host', { type: 'SET_READY', ready: true });
  equal(room.getSnapshot('host').round, 1);
  await room.dispatch('guest', { type: 'SET_READY', ready: true });
  equal(room.getSnapshot('host').round, 2);
  equal(room.getSnapshot('host').phase, 'typing');
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

function measureBotWpm(
  difficulty: keyof typeof BOT_DIFFICULTY_OPTIONS,
  targetWpm: number,
  seed: number
): number {
  const passage = 'Faith comes by hearing and hearing by the word. '.repeat(30);
  const option = BOT_DIFFICULTY_OPTIONS[difficulty];
  const actionWpm = targetWpm * (2 - option.accuracy) / option.accuracy;
  let state = seed;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
  let typedText = '';
  let elapsedMs = 0;
  while (typedText !== passage) {
    typedText = nextBotTyping(passage, typedText, difficulty, random);
    elapsedMs += nextTypingDelayMs(actionWpm, typedText, difficulty, random);
  }
  return Math.round((passage.length / 5) / (elapsedMs / 60_000));
}

let failed = 0;
for (const current of tests) {
  try {
    await current.run();
    console.log(`✓ ${current.name}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${current.name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
else console.log(`\n${tests.length} tests passed.`);
