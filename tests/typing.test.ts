import { analyzeSession } from '../src/game/analysis.ts';
import { getCurrentWordIndex, getCurrentWordRange, getHintWordIndex, isHintAvailable } from '../src/game/hint.ts';
import { handleInput } from '../src/game/input.ts';
import { createGame } from '../src/game/state.ts';
import { calculateStats } from '../src/game/stats.ts';
import { equal, test } from './harness.ts';

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
