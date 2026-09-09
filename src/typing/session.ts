import { handleInput } from '../game/input';
import { calculateStats, type GameStats } from '../game/stats';
import type { Game } from '../game/state';
import { updateCaretPosition, type CaretMovement } from '../ui/caret';
import { renderStats } from '../ui/hud';
import { renderText } from '../ui/renderer';
import { renderTypedBar } from '../ui/typedBar';

export type TypingInputUpdate = {
  hadStarted: boolean;
  previousLength: number;
  advanced: boolean;
  lastCharacterCorrect: boolean | null;
  completed: boolean;
};

export type TypingChrome = {
  text: HTMLElement;
  typedBar: HTMLElement;
  progressFill: HTMLElement;
  hud?: HTMLElement;
};

export function updateTypingInput(game: Game, value: string): TypingInputUpdate {
  const hadStarted = Boolean(game.startTime);
  const previousLength = game.typed.length;
  handleInput(game, value);
  const advanced = game.typed.length > previousLength;
  const lastIndex = game.typed.length - 1;
  return {
    hadStarted,
    previousLength,
    advanced,
    lastCharacterCorrect: advanced
      ? game.typed[lastIndex] === game.chars[lastIndex]
      : null,
    completed: game.typed.join('') === game.text
  };
}

export function renderTypingExperience(
  game: Game,
  elements: TypingChrome,
  movement: CaretMovement = 'track'
): GameStats {
  renderText(elements.text, game);
  return renderTypingChrome(game, elements, movement);
}

export function renderTypingChrome(
  game: Game,
  elements: TypingChrome,
  movement: CaretMovement = 'track'
): GameStats {
  const stats = calculateStats(game);
  if (elements.hud) renderStats(elements.hud, stats);
  updateCaretPosition(elements.text, game, movement);
  renderTypedBar(elements.typedBar, game);
  elements.progressFill.style.transform = `scaleX(${stats.progress / 100})`;
  return stats;
}
