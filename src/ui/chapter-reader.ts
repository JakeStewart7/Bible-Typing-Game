import type { Game } from '../game/state';
import { hiddenMemoryWordIndices, shouldMaskMemoryCharacter } from '../memory/domain/visibility';
import type { ChapterReader } from '../typing/chapter-reader';

type RenderState = {
  characterIndex: number;
  wordIndex: number;
  word: HTMLSpanElement | null;
  firstErrorIndex: number;
  lastTypedIndex: number;
  caretWordIndex: number | null;
  hiddenWords: Set<number>;
  memoryMode: boolean;
  revealedWordIndex: number | null;
  promptedWordIndex: number | null;
};

export function renderChapterReader(
  container: HTMLElement,
  readerEl: HTMLElement,
  reader: ChapterReader,
  game: Game,
  revealedWordIndex: number | null = null,
  promptedWordIndex: number | null = null,
  animatedRevealWordIndex: number | null = null,
  revealAnimationElapsedMs = 0
): void {
  if (readerEl.parentElement !== container) container.replaceChildren(readerEl);
  readerEl.replaceChildren();
  const state = createRenderState(container, game, revealedWordIndex, promptedWordIndex);

  for (const verse of reader.verses) {
    const verseEl = document.createElement('p');
    verseEl.className = verse.isActive
      ? 'chapter-reader-verse is-active'
      : 'chapter-reader-verse is-context';
    verseEl.dataset.verse = String(verse.verse);
    const numberEl = document.createElement('span');
    numberEl.className = 'verse-number';
    numberEl.textContent = String(verse.verse);
    verseEl.appendChild(numberEl);

    if (verse.isActive) {
      appendCharacters(verseEl, verse.text, game, state, animatedRevealWordIndex, revealAnimationElapsedMs);
      const nextVerse = reader.verses[reader.verses.indexOf(verse) + 1];
      if (nextVerse?.isActive) {
        appendCharacter(verseEl, ' ', game, state, animatedRevealWordIndex, revealAnimationElapsedMs);
      }
    } else {
      verseEl.append(` ${verse.text}`);
    }
    readerEl.appendChild(verseEl);
  }
}

export function positionReaderAtActiveRange(container: HTMLElement, readerEl: HTMLElement): void {
  const firstActiveVerse = readerEl.querySelector<HTMLElement>('.chapter-reader-verse.is-active');
  if (!firstActiveVerse) return;
  container.scrollTop = Math.max(0, firstActiveVerse.offsetTop - container.clientHeight * .25);
}

function createRenderState(
  container: HTMLElement,
  game: Game,
  revealedWordIndex: number | null,
  promptedWordIndex: number | null
): RenderState {
  const memoryMode = Boolean(container.closest<HTMLElement>('[data-mode="memory"]'));
  const memoryHiddenPercent = Number(
    container.closest<HTMLElement>('[data-mode="memory"]')?.style.getPropertyValue('--memory-hidden-percent') || 50
  );
  const words = game.text.split(' ');
  const caretWordIndex = findCaretWordIndex(words, game.typed.length - 1);
  return {
    characterIndex: 0,
    wordIndex: -1,
    word: null,
    firstErrorIndex: game.typed.findIndex((character, index) => character !== game.chars[index]),
    lastTypedIndex: game.typed.length - 1,
    caretWordIndex,
    hiddenWords: memoryMode ? hiddenMemoryWordIndices(words.length, memoryHiddenPercent) : new Set<number>(),
    memoryMode,
    revealedWordIndex,
    promptedWordIndex
  };
}

function findCaretWordIndex(words: string[], lastTypedIndex: number): number | null {
  let runningIndex = 0;
  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    const word = words[wordIndex] ?? '';
    if (lastTypedIndex <= runningIndex + word.length) return wordIndex;
    runningIndex += word.length + 1;
  }
  return null;
}

function appendCharacters(
  verseEl: HTMLElement,
  text: string,
  game: Game,
  state: RenderState,
  animatedRevealWordIndex: number | null,
  revealAnimationElapsedMs: number
): void {
  for (const character of text) {
    appendCharacter(verseEl, character, game, state, animatedRevealWordIndex, revealAnimationElapsedMs);
  }
}

function appendCharacter(
  verseEl: HTMLElement,
  character: string,
  game: Game,
  state: RenderState,
  animatedRevealWordIndex: number | null,
  revealAnimationElapsedMs: number
): void {
  const isSpace = character === ' ';
  if (isSpace) {
    const separator = document.createElement('span');
    separator.textContent = character;
    separator.className = 'char';
    if (state.characterIndex <= state.lastTypedIndex) {
      separator.classList.add(state.firstErrorIndex === -1 || state.characterIndex < state.firstErrorIndex
        ? 'correct'
        : 'error-highlight');
    }
    if (state.characterIndex === game.typed.length) separator.classList.add('current');
    if (state.characterIndex === game.lastPressedIndex) separator.classList.add('pressed');
    verseEl.appendChild(separator);
    state.characterIndex++;
    state.word = null;
    return;
  }
  if (!isSpace && !state.word) {
    state.word = document.createElement('span');
    state.word.className = 'word';
    state.wordIndex++;
    if (state.wordIndex === state.promptedWordIndex) state.word.classList.add('hint-target');
    if (state.wordIndex === animatedRevealWordIndex) {
      state.word.classList.add('revealed-hint');
      state.word.style.animationDelay = `-${revealAnimationElapsedMs}ms`;
    }
    verseEl.appendChild(state.word);
  }
  const span = document.createElement('span');
  span.textContent = character;
  span.className = 'char';
  const hiddenInMemory = state.memoryMode && state.wordIndex !== state.revealedWordIndex && shouldMaskMemoryCharacter(
    state.hiddenWords.has(state.wordIndex),
    game.typed[state.characterIndex],
    game.chars[state.characterIndex] ?? ''
  );
  if (hiddenInMemory) {
    span.classList.add('memory-hidden');
    span.textContent = '·';
  }
  if (state.wordIndex === state.caretWordIndex) span.classList.add('letter-underline');
  if (state.characterIndex <= state.lastTypedIndex) {
    span.classList.add(state.firstErrorIndex === -1 || state.characterIndex < state.firstErrorIndex
      ? 'correct'
      : 'error-highlight');
  }
  if (state.characterIndex === game.typed.length) span.classList.add('current');
  if (state.characterIndex === game.lastPressedIndex) span.classList.add('pressed');
  (state.word ?? verseEl).appendChild(span);
  state.characterIndex++;
}
