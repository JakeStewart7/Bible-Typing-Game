import { handleInput, getValidatedTypingLength } from './input.ts';
import { calculateStats, type GameStats } from './stats.ts';
import type { Game } from './state.ts';

export type AppliedTypingInput = {
  typedText: string;
  validatedLength: number;
  completed: boolean;
  stats: GameStats;
};

export function applyTypingInput(
  game: Game,
  value: string,
  now = Date.now()
): AppliedTypingInput {
  handleInput(game, value, now);
  const typedText = game.typed.join('');
  const completed = typedText === game.text;
  if (completed && game.completedAt === undefined) game.completedAt = now;
  return {
    typedText,
    validatedLength: getValidatedTypingLength(game.text, typedText),
    completed,
    stats: calculateStats(game, now)
  };
}
