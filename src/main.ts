// main.ts: keep this file as a minimal orchestrator that wires together modules
// and delegates behavior. Avoid adding business logic here — put it in focused modules.

import './styles/main.css';
import { createGame, Game } from './game/state';
import { initControls } from './ui/controls';
import { initGameControllers } from './game/controller';
import { setupMusic } from './audio/music';
import { toggleEffects } from './audio/effects';

import trackDetermination from '../assets/music/determination.mp3';
import trackApple from '../assets/music/apple_cider.ogg';

// bundle tracks for the music module to consume
(window as Window & { __bundledMusic?: string[] }).__bundledMusic = [trackDetermination, trackApple];

// initialize DOM and controls
const {
  hudEl, textEl, inputEl, typedBarEl,
  translationEl, bookEl, chapterEl, startVerseEl, endVerseEl, loadBtn,
  statusEl, passageTitleEl, resultsEl, resultStatsEl, progressFillEl,
  gameModeEl, challengeBannerEl, typingCardEl, rewardMessageEl, streakEl,
  levelLabelEl, xpLabelEl, xpFillEl, personalBestEl,
  defenseGameEl, faithCountEl, fortressHealthEl, waveCountEl, defeatedCountEl,
  battlePathEl, battleMessageEl,
  populateBooks, populateChapters, populateVerses, constrainEndVerses
} = initControls();

// ----------------------------
// Game state (keep instance export for other modules/tests)
// ----------------------------
export const game: Game = createGame('Typing games help improve speed and accuracy through practice and focus.');

// Wire controllers (moves logic out of main.ts into game/controller.ts)
initGameControllers(game, {
  hudEl, textEl, inputEl, typedBarEl,
  translationEl, bookEl, chapterEl, startVerseEl, endVerseEl, loadBtn,
  statusEl, passageTitleEl, resultsEl, resultStatsEl, progressFillEl,
  gameModeEl, challengeBannerEl, typingCardEl, rewardMessageEl, streakEl,
  levelLabelEl, xpLabelEl, xpFillEl, personalBestEl,
  defenseGameEl, faithCountEl, fortressHealthEl, waveCountEl, defeatedCountEl,
  battlePathEl, battleMessageEl,
  populateBooks, populateChapters, populateVerses, constrainEndVerses
});

setupMusic(document.getElementById('music-slot'));

function showPractice() {
  document.getElementById('welcome')?.classList.add('is-hidden');
  document.getElementById('game-screen')?.classList.remove('is-hidden');
  document.getElementById('home-nav')?.classList.remove('active');
  document.getElementById('practice-nav')?.classList.add('active');
  document.getElementById('input')?.focus();
}

function showHome() {
  document.getElementById('game-screen')?.classList.add('is-hidden');
  document.getElementById('welcome')?.classList.remove('is-hidden');
  document.getElementById('practice-nav')?.classList.remove('active');
  document.getElementById('home-nav')?.classList.add('active');
}

document.getElementById('begin-button')?.addEventListener('click', showPractice);
document.getElementById('practice-nav')?.addEventListener('click', showPractice);
document.getElementById('home-nav')?.addEventListener('click', showHome);

document.getElementById('sound-toggle')?.addEventListener('click', event => {
  const button = event.currentTarget as HTMLButtonElement;
  button.textContent = toggleEffects() ? '🔊' : '🔇';
});
