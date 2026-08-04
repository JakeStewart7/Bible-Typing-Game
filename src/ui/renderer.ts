import type { Game } from '../game/state';

let caretAnimationId: number | null = null;
let lastTargetX = 0;
let lastTargetY = 0;
const CARET_ANIM_DURATION = 220;

export function updateCaretPosition(container: HTMLElement, game: Game) {
  let caret = container.querySelector('.floating-caret') as HTMLElement | null;
  if (!caret) return;

  const caretEl = container.querySelector('.char.current') as HTMLElement | null;
  if (!caretEl) return;

  const cRect = caretEl.getBoundingClientRect();
  const parentRect = container.getBoundingClientRect();
  const targetX = cRect.left - parentRect.left + container.scrollLeft;
  const targetY = cRect.top - parentRect.top + container.scrollTop;

  caret.style.width = Math.max(2, cRect.width * 0.08) + 'px';
  caret.style.height = cRect.height + 'px';
  caret.style.opacity = '1';

  if (caretAnimationId) cancelAnimationFrame(caretAnimationId);

  const startX = lastTargetX;
  const startY = lastTargetY;
  lastTargetX = targetX;
  lastTargetY = targetY;

  const startTime = performance.now();

  function animateFrame(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / CARET_ANIM_DURATION);

    // Cubic ease-out for acceleration feel
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    const x = startX + (targetX - startX) * easeProgress;
    const y = startY + (targetY - startY) * easeProgress;
    caret.style.transform = `translate(${x}px, ${y}px)`;

    if (progress < 1) {
      caretAnimationId = requestAnimationFrame(animateFrame);
    } else {
      caretAnimationId = null;
    }
  }

  caretAnimationId = requestAnimationFrame(animateFrame);

  const caretCenter = targetX + (cRect.width / 2);
  const viewLeft = container.scrollLeft;
  const viewRight = viewLeft + container.clientWidth;
  if (caretCenter < viewLeft + 60) {
    container.scrollTo({ left: Math.max(0, caretCenter - 60), behavior: 'smooth' });
  } else if (caretCenter > viewRight - 60) {
    container.scrollTo({ left: caretCenter - container.clientWidth + 60, behavior: 'smooth' });
  }
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
