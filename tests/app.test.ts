import { BOOKS, getChapterCount } from '../src/bible-data.ts';
import { getSampleVerseNumbers } from '../src/bible-api.ts';
import { chooseRandomVerseRange, chooseVerseRange, filterEndVerses, isValidPassageSelection, normalizeVerseNumbers } from '../src/passage-selector.ts';
import { createGame } from '../src/game/state.ts';
import { handleInput } from '../src/game/input.ts';
import { calculateStats } from '../src/game/stats.ts';
import { getVerseCount, VERSE_COUNTS } from '../src/verse-counts.ts';
import { advanceEnemy, buyUpgrade, completeDefense, createDefenseState, typeCharacter } from '../src/game/minigame.ts';
import { createCampaignChunks, getBookProgress, getCampaignProgress, nextChunk, starsForWpm } from '../src/campaign.ts';
import { AppStorage } from '../src/persistence/storage.ts';
import { AppStateRepository } from '../src/persistence/app-state.ts';
import { ProfileRepository } from '../src/persistence/profile-repository.ts';
import { filterJourneyBooks, findJourneyContinuation, groupJourneyBooks, isJourneyBookUnlocked, journeyCurrency } from '../src/journey.ts';
import { hiddenMemoryWordIndices, shouldMaskMemoryCharacter } from '../src/memory/domain/visibility.ts';
import {
  createPassageId,
  recordRecentPassage,
  selectMemoryStartPassage,
  toggleFavoritePassage
} from '../src/memory/domain/practice-library.ts';
import { getCurrentWordRange, isHintAvailable } from '../src/game/hint.ts';
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

type Test = { name: string; run: () => void };
const tests: Test[] = [];
const test = (name: string, run: () => void) => tests.push({ name, run });
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

test('Memory hides the requested percentage of whole words deterministically', () => {
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
  equal(isHintAvailable(1_000, 3_000), false);
  equal(isHintAvailable(1_000, 3_001), true);
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

test('Memory starts with the newest practiced passage or Genesis 1:1', () => {
  const recent = { book: 'Psalms', chapter: 23, startVerse: 1, endVerse: 4, translation: 'kjv' };
  equal(selectMemoryStartPassage([recent]), recent);
  equal(selectMemoryStartPassage([]), {
    book: 'Genesis', chapter: 1, startVerse: 1, endVerse: 1, translation: 'kjv'
  });
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

test('campaign chunks never cross chapter boundaries', () => {
  const chunks = createCampaignChunks('John');
  equal(chunks[0], { id: 'John:1:1-3', book: 'John', chapter: 1, startVerse: 1, endVerse: 3 });
  equal(chunks.filter(chunk => chunk.chapter === 1).at(-1)?.endVerse, 51);
  equal(chunks.some((chunk, index) => index > 0 && chunk.chapter !== chunks[index - 1]?.chapter && chunk.startVerse !== 1), false);
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

test('journey currency counts unique completed passages without using stars', () => {
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
  const repository = new AppStateRepository(new AppStorage(storage));
  equal(repository.readCampaignProgress(), { 'John:3:16-18': 4 });
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

let failed = 0;
for (const current of tests) {
  try {
    current.run();
    console.log(`✓ ${current.name}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${current.name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
else console.log(`\n${tests.length} tests passed.`);
