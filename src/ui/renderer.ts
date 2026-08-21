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
  lineBoostActive: boolean;
  lastTime: number;
  frame: number;
};

const caretMotions = new WeakMap<HTMLElement, CaretMotion>();
const CARET_MAX_SPEED = 2.75;
const CARET_ACCELERATION = .28;
const CARET_LINE_MAX_SPEED = 18;
const CARET_LINE_ACCELERATION = 1.8;

function animateCaret(motion: CaretMotion, now: number): void {
  const delta = Math.min(2, Math.max(.25, (now - motion.lastTime) / 16.67));
  motion.lastTime = now;
  const offsetX = motion.targetX - motion.x;
  const offsetY = motion.targetY - motion.y;
  const distance = Math.hypot(offsetX, offsetY);
  const acceleration = motion.lineBoostActive ? CARET_LINE_ACCELERATION : CARET_ACCELERATION;
  const maxSpeed = motion.lineBoostActive ? CARET_LINE_MAX_SPEED : CARET_MAX_SPEED;
  const desiredSpeed = Math.min(maxSpeed, Math.sqrt(2 * acceleration * distance));
  const desiredVelocityX = distance ? offsetX / distance * desiredSpeed : 0;
  const desiredVelocityY = distance ? offsetY / distance * desiredSpeed : 0;
  const velocityChange = acceleration * delta;

  motion.velocityX = approach(motion.velocityX, desiredVelocityX, velocityChange);
  motion.velocityY = approach(motion.velocityY, desiredVelocityY, velocityChange);
  const movementX = motion.velocityX * delta;
  const movementY = motion.velocityY * delta;
  if (Math.hypot(movementX, movementY) >= distance) {
    motion.x = motion.targetX;
    motion.y = motion.targetY;
    motion.velocityX = 0;
    motion.velocityY = 0;
  } else {
    motion.x += movementX;
    motion.y += movementY;
  }
  motion.height += (motion.targetHeight - motion.height) * Math.min(1, .22 * delta);
  if (Math.abs(motion.targetHeight - motion.height) < .05) motion.height = motion.targetHeight;
  const speed = Math.hypot(motion.velocityX, motion.velocityY);
  if (motion.lineBoostActive && desiredSpeed <= CARET_MAX_SPEED && speed <= CARET_MAX_SPEED) {
    motion.lineBoostActive = false;
  }
  renderCaretPosition(motion);

  const remainingDistance = Math.hypot(motion.targetX - motion.x, motion.targetY - motion.y);
  if (remainingDistance > .15 || speed > .05 || Math.abs(motion.targetHeight - motion.height) > .05) {
    motion.frame = requestAnimationFrame(time => animateCaret(motion, time));
  } else {
    motion.x = motion.targetX;
    motion.y = motion.targetY;
    motion.height = motion.targetHeight;
    motion.velocityX = 0;
    motion.velocityY = 0;
    motion.frame = 0;
    renderCaretPosition(motion);
  }
}

function approach(current: number, target: number, maximumChange: number): number {
  const difference = target - current;
  if (Math.abs(difference) <= maximumChange) return target;
  return current + Math.sign(difference) * maximumChange;
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
      velocityX: 0, velocityY: 0,
      lineBoostActive: false,
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
      motion.lineBoostActive = true;
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
