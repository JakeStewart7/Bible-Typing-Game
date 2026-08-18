import type { Game } from '../game/state';
import { narrationRate } from './narration-policy';

const STORAGE_KEY = 'verseTypeNarratorEnabled';
const STALE_AFTER_MS = 900;
let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
let spokenThrough = 0;
let lastWordAt = 0;
let smoothedInterval = 700;

export function isNarratorEnabled(): boolean {
  return enabled && 'speechSynthesis' in window;
}

export function toggleNarrator(): boolean {
  enabled = !enabled;
  localStorage.setItem(STORAGE_KEY, String(enabled));
  if (!enabled) speechSynthesis.cancel();
  return isNarratorEnabled();
}

export function resetNarrator(): void {
  spokenThrough = 0;
  lastWordAt = 0;
  smoothedInterval = 700;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function narrateCompletedWords(game: Game, now = performance.now()): void {
  if (!isNarratorEnabled() || game.blockedAccuracyIndex !== null) return;

  const typed = game.typed.join('');
  const boundary = typed === game.text ? typed.length : typed.lastIndexOf(' ');
  if (boundary < spokenThrough) return;

  const completed = game.text.slice(spokenThrough, boundary).trim();
  spokenThrough = Math.min(game.text.length, boundary + 1);
  const words = completed.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  const word = words.at(-1);
  if (!word) return;

  if (lastWordAt) {
    const interval = now - lastWordAt;
    smoothedInterval = smoothedInterval * .65 + interval * .35;
    if (speechSynthesis.pending && interval < STALE_AFTER_MS) speechSynthesis.cancel();
  }
  lastWordAt = now;

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = narrationRate(smoothedInterval);
  utterance.volume = .75;
  speechSynthesis.speak(utterance);
}
