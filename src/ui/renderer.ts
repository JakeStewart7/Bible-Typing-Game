import type { Game } from '../game/state';

export function updateCaretPosition(container: HTMLElement, game: Game) {
  let caret = container.querySelector('.floating-caret') as HTMLElement | null;
  if (!caret) return;

  const caretEl = container.querySelector('.char.current') as HTMLElement | null;
  if (!caretEl) return;

  const cRect = caretEl.getBoundingClientRect();
  const parentRect = container.getBoundingClientRect();
  const left = cRect.left - parentRect.left + container.scrollLeft;
  const top = cRect.top - parentRect.top + container.scrollTop;

  caret.style.width = Math.max(2, cRect.width * 0.08) + 'px';
  caret.style.height = cRect.height + 'px';
  caret.style.transform = `translate(${left}px, ${top}px)`;
}

export function renderText(container: HTMLElement, game: Game) {
  container.innerHTML = '';
  container.style.position = container.style.position || 'relative';

  const words = game.text.split(' ');
  let charIndex = 0;

  const firstErrorIndex = game.typed.findIndex((c, i) => c !== game.chars[i]);
  const lastTypedIndex = game.typed.length - 1;

  let caretWordIndex: number | null = null;
  let runningIndex = 0;
  for (let w = 0; w < words.length; w++) {
    const wordLength = words[w].length;
    if (lastTypedIndex <= runningIndex + wordLength) {
      caretWordIndex = w;
      break;
    }
    runningIndex += wordLength + 1;
  }

  words.forEach((word, wIdx) => {
    const wordSpan = document.createElement('span');
    wordSpan.classList.add('word');
    wordSpan.style.whiteSpace = 'normal';

    for (let i = 0; i < word.length; i++) {
      const span = document.createElement('span');
      span.textContent = word[i];
      span.classList.add('char');

      if (wIdx === caretWordIndex) span.classList.add('letter-underline');

      if (charIndex <= lastTypedIndex) {
        if (firstErrorIndex === -1 || charIndex < firstErrorIndex) {
          span.classList.add('correct');
        } else {
          span.classList.add('incorrect');
          span.classList.add('error-highlight');
        }
      }

      if (charIndex === game.typed.length) span.classList.add('current');

      if (typeof game.lastPressedIndex === 'number' && charIndex === game.lastPressedIndex) {
        span.classList.add('pressed');
      }

      wordSpan.appendChild(span);
      charIndex++;
    }

    const spaceSpan = document.createElement('span');
    spaceSpan.textContent = ' ';
    spaceSpan.classList.add('char');

    if (charIndex <= lastTypedIndex && firstErrorIndex !== -1 && charIndex >= firstErrorIndex) {
      spaceSpan.classList.add('incorrect');
      spaceSpan.classList.add('error-highlight');
    }

    if (charIndex === game.typed.length) spaceSpan.classList.add('current');

    wordSpan.appendChild(spaceSpan);
    charIndex++;

    container.appendChild(wordSpan);
  });

  let caret = container.querySelector('.floating-caret') as HTMLElement | null;
  if (!caret) {
    caret = document.createElement('div');
    caret.className = 'floating-caret';
    caret.style.opacity = '0';
    container.appendChild(caret);
  }
}
