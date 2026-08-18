import type { Game } from '../game/state';

const STORAGE_KEY = 'verseTypeNarratorEnabled';
let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
let spokenThrough = 0;

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
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function narrateCompletedWords(game: Game): void {
  if (!isNarratorEnabled() || game.blockedAccuracyIndex !== null) return;

  const typed = game.typed.join('');
  const boundary = typed === game.text ? typed.length : typed.lastIndexOf(' ');
  if (boundary < spokenThrough) return;

  const completed = game.text.slice(spokenThrough, boundary).trim();
  spokenThrough = Math.min(game.text.length, boundary + 1);
  const words = completed.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  for (const word of words) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = .9;
    utterance.volume = .75;
    speechSynthesis.speak(utterance);
  }
}
