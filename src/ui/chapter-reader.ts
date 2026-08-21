import type { Game } from '../game/state';
import type { ChapterReader } from '../typing/chapter-reader';
import {
  createTypingRenderState,
  updateCharacterElement,
  updateWordElement
} from './typing-render-state';

type BuildState = {
  characterIndex: number;
  wordIndex: number;
  word: HTMLSpanElement | null;
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
  let rendered = renderedChapters.get(readerEl);
  if (rendered?.reader !== reader) {
    buildChapter(readerEl, reader);
    rendered = {
      reader,
      characterElements: [...readerEl.querySelectorAll<HTMLElement>('.chapter-reader-verse.is-active .char')],
      wordElements: [...readerEl.querySelectorAll<HTMLElement>('.chapter-reader-verse.is-active .word')]
    };
    renderedChapters.set(readerEl, rendered);
  }
  const state = createTypingRenderState(container, game, revealedWordIndex);
  rendered.wordElements.forEach((element, wordIndex) => {
    updateWordElement(
      element,
      wordIndex,
      promptedWordIndex,
      animatedRevealWordIndex,
      revealAnimationElapsedMs
    );
  });
  rendered.characterElements.forEach((element, characterIndex) => {
    updateCharacterElement(element, characterIndex, state);
  });
}

export function positionReaderAtActiveRange(container: HTMLElement, readerEl: HTMLElement): void {
  const firstActiveVerse = readerEl.querySelector<HTMLElement>('.chapter-reader-verse.is-active');
  if (!firstActiveVerse) return;
  container.scrollTop = Math.max(0, firstActiveVerse.offsetTop - container.clientHeight * .25);
}

function buildChapter(
  readerEl: HTMLElement,
  reader: ChapterReader
): void {
  const state: BuildState = { characterIndex: 0, wordIndex: -1, word: null };
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
      appendCharacters(verseEl, verse.text, state);
      if (reader.verses[verseIndex + 1]?.isActive) {
        appendCharacter(verseEl, ' ', state);
      }
    } else {
      verseEl.append(` ${verse.text}`);
    }
    readerEl.appendChild(verseEl);
  }
}

function appendCharacters(
  verseEl: HTMLElement,
  text: string,
  state: BuildState
): void {
  for (const character of text) {
    appendCharacter(verseEl, character, state);
  }
}

function appendCharacter(
  verseEl: HTMLElement,
  character: string,
  state: BuildState
): void {
  const isSpace = character === ' ';
  if (isSpace) {
    const separator = document.createElement('span');
    separator.textContent = character;
    separator.className = 'char';
    separator.dataset.wordIndex = String(state.wordIndex);
    verseEl.appendChild(separator);
    state.characterIndex++;
    state.word = null;
    return;
  }
  if (!isSpace && !state.word) {
    state.word = document.createElement('span');
    state.word.className = 'word';
    state.wordIndex++;
    verseEl.appendChild(state.word);
  }
  const span = document.createElement('span');
  span.textContent = character;
  span.className = 'char';
  span.dataset.wordIndex = String(state.wordIndex);
  (state.word ?? verseEl).appendChild(span);
  state.characterIndex++;
}
