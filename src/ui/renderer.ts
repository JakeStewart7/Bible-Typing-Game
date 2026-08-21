import type { Game } from '../game/state';
import { hiddenMemoryWordIndices, shouldMaskMemoryCharacter } from '../memory/domain/visibility';

type CaretMotion = {
  element: HTMLElement;
  x: number;
  y: number;
  height: number;
  targetX: number;
  targetY: number;
  targetHeight: number;
  velocityX: number;
  velocityY: number;
  velocityHeight: number;
  lastTime: number;
  frame: number;
};

const caretMotions = new WeakMap<HTMLElement, CaretMotion>();
const CARET_SPEED_LIMIT = 2.75;
const CARET_SPEED_OVERFLOW_FACTOR = .08;

function animateCaret(motion: CaretMotion, now: number): void {
  const delta = Math.min(2, Math.max(.25, (now - motion.lastTime) / 16.67));
  motion.lastTime = now;
  const acceleration = .03 * delta;
  const damping = Math.pow(.86, delta);

  motion.velocityX = softenCaretVelocity((motion.velocityX + (motion.targetX - motion.x) * acceleration) * damping);
  motion.velocityY = softenCaretVelocity((motion.velocityY + (motion.targetY - motion.y) * acceleration) * damping);
  motion.velocityHeight = softenCaretVelocity((motion.velocityHeight + (motion.targetHeight - motion.height) * acceleration) * damping);
  motion.x = moveWithoutOvershoot(motion.x, motion.targetX, motion.velocityX * delta);
  motion.y = moveWithoutOvershoot(motion.y, motion.targetY, motion.velocityY * delta);
  motion.height = moveWithoutOvershoot(motion.height, motion.targetHeight, motion.velocityHeight * delta);
  if (motion.x === motion.targetX) motion.velocityX = 0;
  if (motion.y === motion.targetY) motion.velocityY = 0;
  if (motion.height === motion.targetHeight) motion.velocityHeight = 0;
  renderCaretPosition(motion);

  const distance = Math.abs(motion.targetX - motion.x) + Math.abs(motion.targetY - motion.y);
  const speed = Math.abs(motion.velocityX) + Math.abs(motion.velocityY);
  if (distance > .15 || speed > .05) {
    motion.frame = requestAnimationFrame(time => animateCaret(motion, time));
  } else {
    motion.x = motion.targetX;
    motion.y = motion.targetY;
    motion.height = motion.targetHeight;
    motion.velocityX = 0;
    motion.velocityY = 0;
    motion.velocityHeight = 0;
    motion.frame = 0;
    renderCaretPosition(motion);
  }
}

function softenCaretVelocity(velocity: number): number {
  const magnitude = Math.abs(velocity);
  if (magnitude <= CARET_SPEED_LIMIT) return velocity;
  return Math.sign(velocity) * (CARET_SPEED_LIMIT + (magnitude - CARET_SPEED_LIMIT) * CARET_SPEED_OVERFLOW_FACTOR);
}

function moveWithoutOvershoot(current: number, target: number, movement: number): number {
  const remaining = target - current;
  if (remaining === 0 || Math.sign(movement) !== Math.sign(remaining)) return current;
  return Math.abs(movement) >= Math.abs(remaining) ? target : current + movement;
}

function renderCaretPosition(motion: CaretMotion): void {
  motion.element.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`;
  motion.element.style.height = `${motion.height}px`;
}

export function updateCaretPosition(container: HTMLElement, game: Game) {
  const parentRect = container.getBoundingClientRect();
  const caretEl = container.querySelector('.char.current') as HTMLElement | null;
  const fallbackEl = container.querySelector('.char:last-of-type') as HTMLElement | null;
  const anchor = caretEl || fallbackEl;
  if (!anchor) return;
  const cRect = anchor.getBoundingClientRect();
  const targetX = cRect.left - parentRect.left + container.scrollLeft + (caretEl ? -1 : cRect.width - 1);
  const targetY = cRect.top - parentRect.top + container.scrollTop;
  const visibleTop = targetY - container.scrollTop;
  if (visibleTop < 24 || visibleTop > container.clientHeight - cRect.height - 24) {
    container.scrollTop = Math.max(0, targetY - container.clientHeight / 2);
  }

  let motion = caretMotions.get(container);
  if (!motion) {
    const element = document.createElement('div');
    element.className = 'floating-caret';
    motion = {
      element, x: targetX, y: targetY, height: cRect.height,
      targetX, targetY, targetHeight: cRect.height,
      velocityX: 0, velocityY: 0, velocityHeight: 0,
      lastTime: performance.now(), frame: 0
    };
    caretMotions.set(container, motion);
    container.appendChild(element);
    renderCaretPosition(motion);
  } else {
    if (!motion.element.isConnected) container.appendChild(motion.element);
    const changedLine = Math.abs(targetY - motion.targetY) > cRect.height / 2;
    motion.targetX = targetX;
    motion.targetY = targetY;
    motion.targetHeight = cRect.height;
    if (changedLine) {
      cancelAnimationFrame(motion.frame);
      motion.frame = 0;
      motion.x = targetX;
      motion.y = targetY;
      motion.height = cRect.height;
      motion.velocityX = 0;
      motion.velocityY = 0;
      motion.velocityHeight = 0;
      renderCaretPosition(motion);
    }
    if (!motion.frame) {
      motion.lastTime = performance.now();
      motion.frame = requestAnimationFrame(time => animateCaret(motion!, time));
    }
  }
  motion.element.classList.toggle('complete', !caretEl);
}

export function renderText(
  container: HTMLElement,
  game: Game,
  revealedWordIndex: number | null = null,
  promptedWordIndex: number | null = null,
  animatedRevealWordIndex: number | null = null,
  revealAnimationElapsedMs = 0
) {
  const motion = caretMotions.get(container);
  for (const child of [...container.children]) {
    if (child !== motion?.element) child.remove();
  }
  container.style.position = container.style.position || 'relative';

  const words = game.text.split(' ');
  const memoryMode = container.closest<HTMLElement>('[data-mode="memory"]');
  const memoryHiddenPercent = Number(memoryMode?.style.getPropertyValue('--memory-hidden-percent') || 50);
  const hiddenWords = memoryMode
    ? hiddenMemoryWordIndices(words.length, memoryHiddenPercent)
    : new Set<number>();
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
    if (wIdx === promptedWordIndex) wordSpan.classList.add('hint-target');
    if (wIdx === animatedRevealWordIndex) {
      wordSpan.classList.add('revealed-hint');
      wordSpan.style.animationDelay = `-${revealAnimationElapsedMs}ms`;
    }
    wordSpan.style.whiteSpace = 'normal';
    for (let i = 0; i < word.length; i++) {
      const span = document.createElement('span');
      span.textContent = word[i];
      span.classList.add('char');
      const hiddenInMemory = wIdx !== revealedWordIndex && shouldMaskMemoryCharacter(
        hiddenWords.has(wIdx),
        game.typed[charIndex],
        game.chars[charIndex] ?? ''
      );
      if (hiddenInMemory) {
        span.classList.add('memory-hidden');
        span.textContent = '·';
      }

      if (wIdx === caretWordIndex) span.classList.add('letter-underline');

      if (charIndex <= lastTypedIndex) {
        if (firstErrorIndex === -1 || charIndex < firstErrorIndex) {
          span.classList.add('correct');
        } else {
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

    container.appendChild(wordSpan);

    const spaceSpan = document.createElement('span');
    spaceSpan.textContent = ' ';
    spaceSpan.classList.add('char');
    if (charIndex <= lastTypedIndex && firstErrorIndex !== -1 && charIndex >= firstErrorIndex) {
      spaceSpan.classList.add('error-highlight');
    }

    if (charIndex === game.typed.length) spaceSpan.classList.add('current');

    container.appendChild(spaceSpan);
    charIndex++;
  });

}
