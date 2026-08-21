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

type RenderedChapter = {
  reader: ChapterReader;
  characterElements: HTMLElement[];
  wordElements: HTMLElement[];
};

const renderedChapters = new WeakMap<HTMLElement, RenderedChapter>();

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
  const state = createRenderState(container, game, revealedWordIndex, promptedWordIndex);
  let rendered = renderedChapters.get(readerEl);
  if (rendered?.reader !== reader) {
    buildChapter(readerEl, reader, game, state, animatedRevealWordIndex, revealAnimationElapsedMs);
    rendered = {
      reader,
      characterElements: [...readerEl.querySelectorAll<HTMLElement>('.chapter-reader-verse.is-active .char')],
      wordElements: [...readerEl.querySelectorAll<HTMLElement>('.chapter-reader-verse.is-active .word')]
    };
    renderedChapters.set(readerEl, rendered);
  }
  updateRenderedChapter(rendered, game, state, animatedRevealWordIndex, revealAnimationElapsedMs);
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

function buildChapter(
  readerEl: HTMLElement,
  reader: ChapterReader,
  game: Game,
  state: RenderState,
  animatedRevealWordIndex: number | null,
  revealAnimationElapsedMs: number
): void {
  readerEl.replaceChildren();
  for (const [verseIndex, verse] of reader.verses.entries()) {
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
      if (reader.verses[verseIndex + 1]?.isActive) {
        appendCharacter(verseEl, ' ', game, state, animatedRevealWordIndex, revealAnimationElapsedMs);
      }
    } else {
      verseEl.append(` ${verse.text}`);
    }
    readerEl.appendChild(verseEl);
  }
}

function updateRenderedChapter(
  rendered: RenderedChapter,
  game: Game,
  state: RenderState,
  animatedRevealWordIndex: number | null,
  revealAnimationElapsedMs: number
): void {
  for (const [wordIndex, wordEl] of rendered.wordElements.entries()) {
    const prompted = wordIndex === state.promptedWordIndex;
    wordEl.classList.toggle('hint-target', prompted);
    const animated = wordIndex === animatedRevealWordIndex;
    if (animated && !wordEl.classList.contains('revealed-hint')) {
      wordEl.classList.add('revealed-hint');
      wordEl.style.animationDelay = `-${revealAnimationElapsedMs}ms`;
    } else if (!animated) {
      wordEl.classList.remove('revealed-hint');
      wordEl.style.removeProperty('animation-delay');
    }
  }

  for (const [characterIndex, characterEl] of rendered.characterElements.entries()) {
    const wordIndex = Number(characterEl.dataset.wordIndex);
    const sourceCharacter = game.chars[characterIndex] ?? '';
    const hiddenInMemory = sourceCharacter !== ' ' && state.memoryMode
      && wordIndex !== state.revealedWordIndex
      && shouldMaskMemoryCharacter(
        state.hiddenWords.has(wordIndex),
        game.typed[characterIndex],
        sourceCharacter
      );
    const classes = ['char'];
    if (hiddenInMemory) classes.push('memory-hidden');
    if (wordIndex === state.caretWordIndex) classes.push('letter-underline');
    if (characterIndex <= state.lastTypedIndex) {
      classes.push(state.firstErrorIndex === -1 || characterIndex < state.firstErrorIndex
        ? 'correct'
        : 'error-highlight');
    }
    if (characterIndex === game.typed.length) classes.push('current');
    if (characterIndex === game.lastPressedIndex) classes.push('pressed');
    const className = classes.join(' ');
    if (characterEl.className !== className) characterEl.className = className;
    const displayCharacter = hiddenInMemory ? '·' : sourceCharacter;
    if (characterEl.textContent !== displayCharacter) characterEl.textContent = displayCharacter;
  }
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
    separator.dataset.wordIndex = String(state.wordIndex);
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
  span.dataset.wordIndex = String(state.wordIndex);
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
