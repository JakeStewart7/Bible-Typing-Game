import {
  BOT_DIFFICULTY_OPTIONS,
  GUESS_DURATION_MS,
  PASSAGE_LENGTH_OPTIONS
} from '../domain/settings';
import { formatVerseRange } from '../../memory/domain/passage';
import type {
  PassageLength,
  PlayerState,
  RoomSnapshot
} from '../domain/types';

export function playerStatus(player: PlayerState, snapshot: RoomSnapshot): string {
  if (snapshot.phase === 'lobby') {
    if (player.id === snapshot.hostId) return 'Host';
    return player.kind === 'simulated'
      ? `${BOT_DIFFICULTY_OPTIONS[player.botDifficulty ?? 'medium'].label} bot`
      : 'Joined';
  }
  if (snapshot.phase === 'typing') {
    if (snapshot.countdownEndsAt !== null) return 'Get ready';
    return player.typingComplete ? 'Finished typing' : 'Typing…';
  }

  if (snapshot.phase === 'guessing') {
    if (player.guessSubmitted) return 'Answer locked';
    const guess = player.guess;
    return [
      guess.book,
      guess.chapter,
      guess.startVerse && guess.endVerse ? formatVerseRange(guess.startVerse, guess.endVerse) : ''
    ].filter(Boolean).join(' ') || 'Thinking...';
  }
  if (!snapshot.settings.includeGuessing) return player.ready ? 'Ready' : 'Round complete';
  return player.ready ? 'Ready' : `${player.score ?? 0}%`;
}

export function typedProgressPercent(player: PlayerState, passageText: string | null): number {
  return Math.round(player.progress / Math.max(1, passageText?.length ?? 1) * 100);
}

export function readPassageLength(id: string): PassageLength {
  const value = requiredSelect(id).value;
  return value in PASSAGE_LENGTH_OPTIONS ? value as PassageLength : 'medium';
}

export function required(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Expected #${id}.`);
  return element;
}

export function requiredInput<T extends HTMLElement>(id: string, type: { new(): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Expected #${id}.`);
  return element;
}

export function requiredButton(id: string): HTMLButtonElement {
  return requiredInput(id, HTMLButtonElement);
}

export function requiredSelect(id: string): HTMLSelectElement {
  return requiredInput(id, HTMLSelectElement);
}

export function requiredSvgCircle(id: string): SVGCircleElement {
  const element = document.getElementById(id);
  if (!(element instanceof SVGCircleElement)) throw new Error(`Expected #${id} to be a circle.`);
  return element;
}

export function setText(id: string, value: string): void {
  const element = required(id);
  if (element.textContent !== value) element.textContent = value;
}

export function renderGuessTimer(snapshot: RoomSnapshot): void {
  const remainingMs = Math.max(0, (snapshot.guessingEndsAt ?? Date.now()) - Date.now());
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  setText('multiplayer-timer-seconds', String(remainingSeconds));
  const ring = requiredSvgCircle('multiplayer-timer-ring');
  ring.style.strokeDashoffset = String(100 - remainingMs / GUESS_DURATION_MS * 100);
  ring.classList.toggle('is-urgent', remainingSeconds <= 10);
}
