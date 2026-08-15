import type { Game } from '../game/state';

type CaretMotion = {
  element: HTMLElement;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  height: number;
  targetHeight: number;
  frame: number;
};

const caretMotions = new WeakMap<HTMLElement, CaretMotion>();

function animateCaret(motion: CaretMotion) {
  const smoothing = 0.32;
  motion.x += (motion.targetX - motion.x) * smoothing;
  motion.y += (motion.targetY - motion.y) * smoothing;
  motion.height += (motion.targetHeight - motion.height) * smoothing;
  motion.element.style.transform = `translate(${motion.x}px, ${motion.y}px)`;
  motion.element.style.height = `${motion.height}px`;

  const moving = Math.abs(motion.targetX - motion.x) > 0.1 ||
    Math.abs(motion.targetY - motion.y) > 0.1 ||
    Math.abs(motion.targetHeight - motion.height) > 0.1;
  if (moving) {
    motion.frame = requestAnimationFrame(() => animateCaret(motion));
  } else {
    motion.x = motion.targetX;
    motion.y = motion.targetY;
    motion.height = motion.targetHeight;
    motion.element.style.transform = `translate(${motion.x}px, ${motion.y}px)`;
    motion.element.style.height = `${motion.height}px`;
    motion.frame = 0;
  }
}

export function updateCaretPosition(container: HTMLElement, game: Game) {
  const parentRect = container.getBoundingClientRect();
  const caretEl = container.querySelector('.char.current') as HTMLElement | null;
  const fallbackEl = container.querySelector('.char:last-of-type') as HTMLElement | null;
  const anchor = caretEl || fallbackEl;
  if (!anchor) return;
  const cRect = anchor.getBoundingClientRect();
  const targetX = cRect.left - parentRect.left + container.scrollLeft + (caretEl ? 0 : cRect.width);
  const targetY = cRect.top - parentRect.top + container.scrollTop;
  const visibleTop = targetY - container.scrollTop;
  if (visibleTop < 24 || visibleTop > container.clientHeight - cRect.height - 24) {
    container.scrollTop = Math.max(0, targetY - container.clientHeight / 2);
  }

  let motion = caretMotions.get(container);
  if (!motion) {
    const element = document.createElement('div');
    element.className = 'floating-caret';
    container.appendChild(element);
    motion = {
      element,
      x: targetX,
      y: targetY,
      targetX,
      targetY,
      height: cRect.height,
      targetHeight: cRect.height,
      frame: 0
    };
    caretMotions.set(container, motion);
    element.style.transform = `translate(${targetX}px, ${targetY}px)`;
    element.style.height = `${cRect.height}px`;
  } else {
    if (!motion.element.isConnected) container.appendChild(motion.element);
    motion.targetX = targetX;
    motion.targetY = targetY;
    motion.targetHeight = cRect.height;
    if (!motion.frame) motion.frame = requestAnimationFrame(() => animateCaret(motion!));
  }
  motion.element.classList.toggle('complete', !caretEl);
}

export function renderText(container: HTMLElement, game: Game) {
  const motion = caretMotions.get(container);
  container.replaceChildren();
  if (motion) container.appendChild(motion.element);
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

}
