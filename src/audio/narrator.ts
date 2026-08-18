import type { Game } from '../game/state';
import { narrationRate } from './narration-policy';

const STORAGE_KEY = 'verseTypeNarratorEnabled';
const SPEED_STORAGE_KEY = 'verseTypeNarratorSpeed';
let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
let speed = Number(localStorage.getItem(SPEED_STORAGE_KEY)) || 1;
let spokenThrough = 0;
let lastWordAt = 0;
let smoothedInterval = 700;
let selectedVoice: SpeechSynthesisVoice | null = null;

function selectNarratorVoice(): SpeechSynthesisVoice | null {
  const englishVoices = speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('en'));
  selectedVoice = englishVoices.find(voice => /microsoft david/i.test(voice.name))
    ?? englishVoices.find(voice => /microsoft/i.test(voice.name))
    ?? englishVoices[0]
    ?? null;
  return selectedVoice;
}

export function narratorVoiceName(): string {
  return (selectedVoice ?? selectNarratorVoice())?.name ?? 'System default';
}

export function narratorSpeed(): number {
  return speed;
}

export function setNarratorSpeed(value: number): number {
  speed = Math.min(2, Math.max(.6, value));
  localStorage.setItem(SPEED_STORAGE_KEY, String(speed));
  return speed;
}

if ('speechSynthesis' in window) {
  selectNarratorVoice();
  speechSynthesis.addEventListener('voiceschanged', selectNarratorVoice);
}

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
  }
  lastWordAt = now;

  for (const completedWord of words) {
    const utterance = new SpeechSynthesisUtterance(completedWord);
    utterance.voice = selectedVoice ?? selectNarratorVoice();
    utterance.rate = narrationRate(smoothedInterval, speed);
    utterance.volume = .75;
    speechSynthesis.speak(utterance);
  }
}
