import type { Game } from '../game/state';
import { getCaretElement } from './caret';
import {
  createTypingRenderState,
  updateCharacterElement,
  updateWordElement
} from './typing-render-state';

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
