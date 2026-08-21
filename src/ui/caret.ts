import type { Game } from '../game/state';

export type CaretMovement = 'track' | 'boost' | 'teleport';

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
  boostActive: boolean;
  lastTime: number;
  frame: number;
};

const motions = new WeakMap<HTMLElement, CaretMotion>();
const MAX_SPEED = 2.75;
const ACCELERATION = .34;
const ACCELERATION_FALLOFF = 4;
const BOOST_MAX_SPEED = 54;
const BOOST_ACCELERATION = 3.6;

export function getCaretElement(container: HTMLElement): HTMLElement | undefined {
  return motions.get(container)?.element;
}

export function updateCaretPosition(
  container: HTMLElement,
  game: Game,
  movement: CaretMovement = 'track'
): void {
  const target = findCaretTarget(container);
  if (!target) return;
  keepTargetVisible(container, target);

  let motion = motions.get(container);
  if (!motion) {
    motion = createMotion(container, target);
  } else {
    attachCaret(container, motion);
    const changedLine = Math.abs(target.y - motion.targetY) > target.height / 2;
    motion.targetX = target.x;
    motion.targetY = target.y;
    motion.targetHeight = target.height;
    motion.boostActive ||= changedLine || movement === 'boost';
  }

  if (movement === 'teleport') {
    teleportToTarget(motion);
  } else {
    scheduleAnimation(motion);
  }
  motion.element.classList.toggle('complete', !target.hasCharacter);
}

function findCaretTarget(container: HTMLElement) {
  const parentRect = container.getBoundingClientRect();
  const character = container.querySelector<HTMLElement>('.char.current');
  const anchor = character ?? container.querySelector<HTMLElement>('.char:last-of-type');
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  return {
    x: rect.left - parentRect.left + container.scrollLeft + (character ? -1 : rect.width - 1),
    y: rect.top - parentRect.top + container.scrollTop,
    height: rect.height,
    hasCharacter: Boolean(character)
  };
}

function keepTargetVisible(
  container: HTMLElement,
  target: { y: number; height: number }
): void {
  const visibleTop = target.y - container.scrollTop;
  if (visibleTop < 24 || visibleTop > container.clientHeight - target.height - 24) {
    container.scrollTop = Math.max(0, target.y - container.clientHeight / 2);
  }
}

function createMotion(
  container: HTMLElement,
  target: { x: number; y: number; height: number }
): CaretMotion {
  const element = document.createElement('div');
  element.className = 'floating-caret';
  const motion = {
    element,
    x: target.x,
    y: target.y,
    height: target.height,
    targetX: target.x,
    targetY: target.y,
    targetHeight: target.height,
    velocityX: 0,
    velocityY: 0,
    boostActive: false,
    lastTime: performance.now(),
    frame: 0
  };
  motions.set(container, motion);
  container.appendChild(element);
  renderPosition(motion);
  return motion;
}

function attachCaret(container: HTMLElement, motion: CaretMotion): void {
  if (!motion.element.isConnected) container.appendChild(motion.element);
}

function teleportToTarget(motion: CaretMotion): void {
  cancelAnimationFrame(motion.frame);
  motion.x = motion.targetX;
  motion.y = motion.targetY;
  motion.height = motion.targetHeight;
  motion.velocityX = 0;
  motion.velocityY = 0;
  motion.boostActive = false;
  motion.frame = 0;
  renderPosition(motion);
}

function scheduleAnimation(motion: CaretMotion): void {
  if (motion.frame) return;
  motion.lastTime = performance.now();
  motion.frame = requestAnimationFrame(time => animate(motion, time));
}

function animate(motion: CaretMotion, now: number): void {
  const delta = Math.min(2, Math.max(.25, (now - motion.lastTime) / 16.67));
  motion.lastTime = now;
  const offsetX = motion.targetX - motion.x;
  const offsetY = motion.targetY - motion.y;
  const distance = Math.hypot(offsetX, offsetY);
  const speed = Math.hypot(motion.velocityX, motion.velocityY);
  const regularAcceleration = ACCELERATION / (1 + speed / ACCELERATION_FALLOFF);
  const acceleration = motion.boostActive ? BOOST_ACCELERATION : regularAcceleration;
  const maxSpeed = motion.boostActive ? BOOST_MAX_SPEED : MAX_SPEED;
  const desiredSpeed = Math.min(maxSpeed, Math.sqrt(2 * acceleration * distance));
  const velocityChange = acceleration * delta;
  const desiredX = distance ? offsetX / distance * desiredSpeed : 0;
  const desiredY = distance ? offsetY / distance * desiredSpeed : 0;

  motion.velocityX = approach(motion.velocityX, desiredX, velocityChange);
  motion.velocityY = approach(motion.velocityY, desiredY, velocityChange);
  moveTowardTarget(motion, delta, distance);
  motion.height += (motion.targetHeight - motion.height) * Math.min(1, .22 * delta);
  if (Math.abs(motion.targetHeight - motion.height) < .05) motion.height = motion.targetHeight;

  const currentSpeed = Math.hypot(motion.velocityX, motion.velocityY);
  if (motion.boostActive && desiredSpeed <= MAX_SPEED && currentSpeed <= MAX_SPEED) {
    motion.boostActive = false;
  }
  renderPosition(motion);

  const remaining = Math.hypot(motion.targetX - motion.x, motion.targetY - motion.y);
  if (remaining > .15 || currentSpeed > .05 || Math.abs(motion.targetHeight - motion.height) > .05) {
    motion.frame = requestAnimationFrame(time => animate(motion, time));
  } else {
    teleportToTarget(motion);
  }
}

function moveTowardTarget(motion: CaretMotion, delta: number, distance: number): void {
  const movementX = motion.velocityX * delta;
  const movementY = motion.velocityY * delta;
  if (Math.hypot(movementX, movementY) >= distance) {
    motion.x = motion.targetX;
    motion.y = motion.targetY;
    motion.velocityX = 0;
    motion.velocityY = 0;
    return;
  }
  motion.x += movementX;
  motion.y += movementY;
}

function approach(current: number, target: number, maximumChange: number): number {
  const difference = target - current;
  return Math.abs(difference) <= maximumChange
    ? target
    : current + Math.sign(difference) * maximumChange;
}

function renderPosition(motion: CaretMotion): void {
  motion.element.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`;
  motion.element.style.height = `${motion.height}px`;
}
