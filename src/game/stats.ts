import type { Game } from './state';

export function calculateStats(game: Game) {
  if (!game.startTime) {
    return { time: 0, wpm: 0, accuracy: 100, progress: 0 };
  }

  const elapsed = ((game.completedAt || Date.now()) - game.startTime) / 1000;
  const typedLength = game.typed.length;

  const wpm = elapsed > 0 ? Math.round(((typedLength / 5) / elapsed) * 60) : 0;

  const accuracy = typedLength === 0 ? 100 : Math.max(0, Math.round(((typedLength - game.errors) / typedLength) * 100));

  const progress = Math.round((typedLength / game.chars.length) * 100);

  return { time: Math.floor(elapsed), wpm, accuracy, progress };
}
