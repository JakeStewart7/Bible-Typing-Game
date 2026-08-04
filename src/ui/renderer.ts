import type { Game } from '../game/state';

let caretAnimationId: number | null = null;
let caretStartPos: { x: number; y: number } | null = null;
let caretTargetPos: { x: number; y: number } | null = null;
let caretAnimationStart = 0;
const CARET_ANIM_DURATION = 140;

function smoothCaret(caret: HTMLElement, targetX: number, targetY: number) {
  if (caretAnimationId) cancelAnimationFrame(caretAnimationId);

  const currentTransform = caret.style.transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
  caretStartPos = {
    x: currentTransform ? parseFloat(currentTransform[1]) : targetX,
    y: currentTransform ? parseFloat(currentTransform[2]) : targetY
  };
  caretTargetPos = { x: targetX, y: targetY };
  caretAnimationStart = performance.now();

  function animateFrame(now: number) {
    const elapsed = now - caretAnimationStart;
    const progress = Math.min(1, elapsed / CARET_ANIM_DURATION);

    if (caretStartPos && caretTargetPos) {
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

      const x = caretStartPos.x + (caretTargetPos.x - caretStartPos.x) * easeProgress;
      const y = caretStartPos.y + (caretTargetPos.y - caretStartPos.y) * easeProgress;
      caret.style.transform = `translate(${x}px, ${y}px)`;
    }

    if (progress < 1) {
      caretAnimationId = requestAnimationFrame(animateFrame);
    } else {
      caretAnimationId = null;
    }
  }

  caretAnimationId = requestAnimationFrame(animateFrame);
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
    caret.style.transition = 'none';
    container.appendChild(caret);
  }

  const caretEl = container.querySelector('.char.current') as HTMLElement | null;
  if (caretEl) {
    const cRect = caretEl.getBoundingClientRect();
    const parentRect = container.getBoundingClientRect();
    const left = cRect.left - parentRect.left + container.scrollLeft;
    const top = cRect.top - parentRect.top + container.scrollTop;
    caret.style.width = Math.max(2, cRect.width * 0.08) + 'px';
    caret.style.height = cRect.height + 'px';

    if (caret.style.transition === 'none') {
      caret.style.transform = `translate(${left}px, ${top}px)`;
      caret.offsetHeight;
      caret.style.transition = 'width 120ms ease-out, background 100ms ease, box-shadow 100ms ease';
      caret.style.opacity = '1';
      caretStartPos = { x: left, y: top };
      caretTargetPos = { x: left, y: top };
    } else {
      smoothCaret(caret, left, top);
    }

    const caretCenter = left + (cRect.width / 2);
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;
    if (caretCenter < viewLeft + 60) {
      container.scrollTo({ left: Math.max(0, caretCenter - 60), behavior: 'smooth' });
    } else if (caretCenter > viewRight - 60) {
      container.scrollTo({ left: caretCenter - container.clientWidth + 60, behavior: 'smooth' });
    }
  }
}
