import type { Game } from './state';
import { getValidatedTypingLength } from './input.ts';

export type GameStats = { time: number; wpm: number; accuracy: number; progress: number };

export function calculateStats(game: Game, now = Date.now()): GameStats {
  if (!game.startTime) {
    return { time: 0, wpm: 0, accuracy: 100, progress: 0 };
  }

  const elapsed = ((game.completedAt || now) - game.startTime) / 1000;
  const scoredLength = getTypingProgressLength(game);
  const wpm = elapsed > 0 ? Math.round(((scoredLength / 5) / elapsed) * 60) : 0;
  const accuracy = game.accuracyTotal === 0 ? 100 : Math.round((game.accuracyCorrect / game.accuracyTotal) * 100);

  const currentProgress = game.chars.length === 0 ? 0 : Math.round((scoredLength / game.chars.length) * 100);
  game.maxProgress = Math.max(game.maxProgress, currentProgress);

  return { time: Math.floor(elapsed), wpm, accuracy, progress: game.maxProgress };
}

export function getTypingProgressLength(game: Game): number {
  return getValidatedTypingLength(game.text, game.typed.join(''));
}
