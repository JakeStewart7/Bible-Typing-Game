import type { Game } from './state';
import type { GameStats } from './stats';

export type SessionComparison = {
  wpmDifference: number;
  accuracyDifference: number;
};

export type SessionAnalysis = {
  mistakeCount: number;
  difficultWords: string[];
  strongestWords: string[];
  comparison: SessionComparison | null;
};

export function analyzeSession(
  game: Game,
  stats: GameStats,
  previous: Pick<GameStats, 'wpm' | 'accuracy'> | null
): SessionAnalysis {
  const words = getWordRanges(game.text);
  const difficultWords = words
    .filter(word => wordHasError(game, word.start, word.end))
    .map(word => word.value)
    .filter((word, index, all) => all.indexOf(word) === index)
    .slice(0, 3);
  const strongestWords = words
    .filter(word => !wordHasError(game, word.start, word.end) && word.value.length >= 5)
    .sort((left, right) => right.value.length - left.value.length)
    .map(word => word.value)
    .filter((word, index, all) => all.indexOf(word) === index)
    .slice(0, 3);

  return {
    mistakeCount: game.firstAttemptCorrect.filter(correct => correct === false).length,
    difficultWords,
    strongestWords,
    comparison: previous ? {
      wpmDifference: stats.wpm - previous.wpm,
      accuracyDifference: stats.accuracy - previous.accuracy
    } : null
  };
}

function wordHasError(game: Game, start: number, end: number): boolean {
  for (let index = start; index < end; index++) {
    if (game.firstAttemptCorrect[index] === false) return true;
  }
  return false;
}

function getWordRanges(text: string): Array<{ value: string; start: number; end: number }> {
  const words: Array<{ value: string; start: number; end: number }> = [];
  for (const match of text.matchAll(/\S+/g)) {
    const start = match.index ?? 0;
    words.push({ value: match[0], start, end: start + match[0].length });
  }
  return words;
}
