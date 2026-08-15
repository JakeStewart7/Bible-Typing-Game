import { BOOKS, getChapterCount } from '../src/bible-data.ts';
import { getSampleVerseNumbers } from '../src/bible-api.ts';
import { chooseVerseRange, filterEndVerses, isValidPassageSelection, normalizeVerseNumbers } from '../src/passage-selector.ts';
import { createGame } from '../src/game/state.ts';
import { handleInput } from '../src/game/input.ts';
import { calculateStats } from '../src/game/stats.ts';
import { getVerseCount, VERSE_COUNTS } from '../src/verse-counts.ts';
import { advanceEnemy, buyUpgrade, completeDefense, createDefenseState, typeCharacter } from '../src/game/minigame.ts';

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
  equal(calculateStats(game).progress, 100);
});

test('defense typing earns faith and damages enemies', () => {
  const state = createDefenseState();
  typeCharacter(state, true);
  equal(state.faith, 1);
  equal(state.projectiles.length, 1);
  advanceEnemy(state, 2);
  equal(state.enemies[0].health, 3);
  equal(state.projectiles.length, 0);
  typeCharacter(state, false);
  equal(state.faith, 0);
  equal(Math.round(state.enemies[0].position), 20);
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
  typeCharacter(state, true);
  advanceEnemy(state, 2);
  equal(state.enemies[0].health, 2);
});

test('light is destroyed on contact and defeats low-health shadows', () => {
  const state = createDefenseState();
  state.enemies[0].health = 1;
  typeCharacter(state, true);
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
  typeCharacter(state, true);
  advanceEnemy(state, 2);
  equal(state.projectiles.length, 0);
  equal(state.enemies.some(enemy => enemy.health < enemy.maxHealth), true);
});

test('missed light disappears after crossing the battlefield', () => {
  const state = createDefenseState();
  state.enemies = [];
  typeCharacter(state, true);
  advanceEnemy(state, 2);
  equal(state.projectiles.length, 0);
});

test('completing defense awards a victory bonus', () => {
  const state = createDefenseState();
  completeDefense(state);
  equal(state.status, 'won');
  equal(state.faith, 150);
});

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
