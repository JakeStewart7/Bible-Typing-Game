import type { Game } from '../game/state';
import { hiddenMemoryWordIndices, shouldMaskMemoryCharacter } from '../memory/domain/visibility';
import { getCaretElement } from './caret';

type RenderedText = {
  text: string;
  characterElements: HTMLElement[];
  wordElements: HTMLElement[];
};

const renderedTexts = new WeakMap<HTMLElement, RenderedText>();

export function renderText(
  container: HTMLElement,
  game: Game,
  revealedWordIndex: number | null = null,
  promptedWordIndex: number | null = null,
  animatedRevealWordIndex: number | null = null,
  revealAnimationElapsedMs = 0
) {
  const caretElement = getCaretElement(container);
  container.style.position = container.style.position || 'relative';

  const words = game.text.split(' ');
  const memoryMode = container.closest<HTMLElement>('[data-mode="memory"]');
  const memoryHiddenPercent = Number(memoryMode?.style.getPropertyValue('--memory-hidden-percent') || 50);
  const hiddenWords = memoryMode
    ? hiddenMemoryWordIndices(words.length, memoryHiddenPercent)
    : new Set<number>();
  const firstErrorIndex = game.blockedAccuracyIndex ?? -1;
  const lastTypedIndex = game.typed.length - 1;
  const caretWordIndex = findCaretWordIndex(words, lastTypedIndex);
  let rendered = renderedTexts.get(container);
  if (rendered?.text !== game.text || !rendered.characterElements[0]?.isConnected) {
    for (const child of [...container.children]) {
      if (child !== caretElement) child.remove();
    }
    buildText(container, words);
    rendered = {
      text: game.text,
      characterElements: [...container.querySelectorAll<HTMLElement>(':scope > .char, :scope > .word > .char')],
      wordElements: [...container.querySelectorAll<HTMLElement>(':scope > .word')]
    };
    renderedTexts.set(container, rendered);
  }
  updateRenderedText({
    rendered,
    game,
    hiddenWords,
    revealedWordIndex,
    promptedWordIndex,
    animatedRevealWordIndex,
    revealAnimationElapsedMs,
    firstErrorIndex,
    lastTypedIndex,
    caretWordIndex
  });
}

function buildText(container: HTMLElement, words: string[]): void {
  words.forEach((word, wordIndex) => {
    const wordEl = document.createElement('span');
    wordEl.className = 'word';
    for (const character of word) {
      const characterEl = document.createElement('span');
      characterEl.className = 'char';
      characterEl.dataset.wordIndex = String(wordIndex);
      characterEl.textContent = character;
      wordEl.appendChild(characterEl);
    }
    container.appendChild(wordEl);
    if (wordIndex < words.length - 1) {
      const separator = document.createElement('span');
      separator.className = 'char';
      separator.dataset.wordIndex = String(wordIndex);
      separator.textContent = ' ';
      container.appendChild(separator);
    }
  });
}

function updateRenderedText(options: {
  rendered: RenderedText;
  game: Game;
  hiddenWords: ReadonlySet<number>;
  revealedWordIndex: number | null;
  promptedWordIndex: number | null;
  animatedRevealWordIndex: number | null;
  revealAnimationElapsedMs: number;
  firstErrorIndex: number;
  lastTypedIndex: number;
  caretWordIndex: number | null;
}): void {
  const {
    rendered, game, hiddenWords, revealedWordIndex, promptedWordIndex,
    animatedRevealWordIndex, revealAnimationElapsedMs, firstErrorIndex,
    lastTypedIndex, caretWordIndex
  } = options;
  rendered.wordElements.forEach((wordEl, wordIndex) => {
    wordEl.classList.toggle('hint-target', wordIndex === promptedWordIndex);
    const animated = wordIndex === animatedRevealWordIndex;
    if (animated && !wordEl.classList.contains('revealed-hint')) {
      wordEl.classList.add('revealed-hint');
      wordEl.style.animationDelay = `-${revealAnimationElapsedMs}ms`;
    } else if (!animated) {
      wordEl.classList.remove('revealed-hint');
      wordEl.style.removeProperty('animation-delay');
    }
  });
  rendered.characterElements.forEach((characterEl, characterIndex) => {
    const wordIndex = Number(characterEl.dataset.wordIndex);
    const sourceCharacter = game.chars[characterIndex] ?? '';
    const hidden = sourceCharacter !== ' ' && wordIndex !== revealedWordIndex
      && shouldMaskMemoryCharacter(hiddenWords.has(wordIndex), game.typed[characterIndex], sourceCharacter);
    const classes = ['char'];
    if (hidden) classes.push('memory-hidden');
    if (wordIndex === caretWordIndex) classes.push('letter-underline');
    if (characterIndex <= lastTypedIndex) {
      classes.push(firstErrorIndex === -1 || characterIndex < firstErrorIndex ? 'correct' : 'error-highlight');
    }
    if (characterIndex === game.typed.length) classes.push('current');
    if (characterIndex === game.lastPressedIndex) classes.push('pressed');
    const className = classes.join(' ');
    if (characterEl.className !== className) characterEl.className = className;
    const displayCharacter = hidden ? '·' : sourceCharacter;
    if (characterEl.textContent !== displayCharacter) characterEl.textContent = displayCharacter;
  });
}

function findCaretWordIndex(words: string[], lastTypedIndex: number): number | null {
  let runningIndex = 0;
  for (const [wordIndex, word] of words.entries()) {
    if (lastTypedIndex <= runningIndex + word.length) return wordIndex;
    runningIndex += word.length + 1;
  }
  return null;
}
