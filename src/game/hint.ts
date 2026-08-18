import type { Game } from './state';

export const HINT_STALL_MS = 2_000;

export function getCurrentWordRange(text: string, typedLength: number): { start: number; end: number } {
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, typedLength - 1)) + 1);
  const nextSpace = text.indexOf(' ', typedLength);
  return { start, end: nextSpace < 0 ? text.length : nextSpace };
}

export function getCurrentWord(game: Pick<Game, 'text' | 'typed'>): string {
  const range = getCurrentWordRange(game.text, game.typed.length);
  return game.text.slice(range.start, range.end);
}

export function isHintAvailable(lastProgressAt: number, now: number, stalledFor = HINT_STALL_MS): boolean {
  return now - lastProgressAt > stalledFor;
}
