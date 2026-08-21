import type { Game } from '../game/state';
import { hiddenMemoryWordIndices, shouldMaskMemoryCharacter } from '../memory/domain/visibility';

export type TypingRenderState = {
  game: Game;
  hiddenWords: ReadonlySet<number>;
  revealedWordIndex: number | null;
  caretWordIndex: number | null;
  firstErrorIndex: number;
  lastTypedIndex: number;
};

export function createTypingRenderState(
  container: HTMLElement,
  game: Game,
  revealedWordIndex: number | null
): TypingRenderState {
  const memoryMode = container.closest<HTMLElement>('[data-mode="memory"]');
  const words = game.text.split(' ');
  const hiddenPercent = Number(memoryMode?.style.getPropertyValue('--memory-hidden-percent') || 50);
  return {
    game,
    hiddenWords: memoryMode ? hiddenMemoryWordIndices(words.length, hiddenPercent) : new Set<number>(),
    revealedWordIndex,
    caretWordIndex: findCaretWordIndex(words, game.typed.length - 1),
    firstErrorIndex: game.blockedAccuracyIndex ?? -1,
    lastTypedIndex: game.typed.length - 1
  };
}

export function updateWordElement(
  element: HTMLElement,
  wordIndex: number,
  promptedWordIndex: number | null,
  animatedWordIndex: number | null,
  animationElapsedMs: number
): void {
  element.classList.toggle('hint-target', wordIndex === promptedWordIndex);
  const animated = wordIndex === animatedWordIndex;
  if (animated && !element.classList.contains('revealed-hint')) {
    element.classList.add('revealed-hint');
    element.style.animationDelay = `-${animationElapsedMs}ms`;
  } else if (!animated) {
    element.classList.remove('revealed-hint');
    element.style.removeProperty('animation-delay');
  }
}

export function updateCharacterElement(
  element: HTMLElement,
  characterIndex: number,
  state: TypingRenderState
): void {
  const { game } = state;
  const wordIndex = Number(element.dataset.wordIndex);
  const sourceCharacter = game.chars[characterIndex] ?? '';
  const hidden = sourceCharacter !== ' ' && wordIndex !== state.revealedWordIndex
    && shouldMaskMemoryCharacter(state.hiddenWords.has(wordIndex), game.typed[characterIndex], sourceCharacter);
  const classes = ['char'];
  if (hidden) classes.push('memory-hidden');
  if (wordIndex === state.caretWordIndex) classes.push('letter-underline');
  if (characterIndex <= state.lastTypedIndex) {
    classes.push(state.firstErrorIndex === -1 || characterIndex < state.firstErrorIndex
      ? 'correct'
      : 'error-highlight');
  }
  if (characterIndex === game.typed.length) classes.push('current');
  if (characterIndex === game.lastPressedIndex) classes.push('pressed');
  const className = classes.join(' ');
  if (element.className !== className) element.className = className;
  const displayCharacter = hidden ? '·' : sourceCharacter;
  if (element.textContent !== displayCharacter) element.textContent = displayCharacter;
}

function findCaretWordIndex(words: string[], lastTypedIndex: number): number | null {
  let runningIndex = 0;
  for (const [wordIndex, word] of words.entries()) {
    if (lastTypedIndex <= runningIndex + word.length) return wordIndex;
    runningIndex += word.length + 1;
  }
  return null;
}
