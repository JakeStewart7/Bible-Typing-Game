// main.ts: keep this file as a minimal orchestrator that wires together modules
// and delegates behavior. Avoid adding business logic here — put it in focused modules.

import './styles/main.css';
import { createGame, Game } from './game/state';
import { initControls } from './ui/controls';
import { initGameControllers } from './game/controller';
import { setupMusic } from './audio/music';

import trackDetermination from '../assets/music/determination.mp3';
import trackApple from '../assets/music/apple_cider.ogg';

// bundle tracks for the music module to consume
(window as any).__bundledMusic = [trackDetermination, trackApple];

// initialize DOM and controls
const {
  hudEl, textEl, inputEl, typedBarEl,
  translationEl, bookEl, chapterEl, startVerseEl, endVerseEl, loadBtn,
  populateBooks, populateVerses
} = initControls();

// ----------------------------
// Game state (keep instance export for other modules/tests)
// ----------------------------
export const game: Game = createGame('Typing games help improve speed and accuracy through practice and focus.');

// Wire controllers (moves logic out of main.ts into game/controller.ts)
initGameControllers(game, {
  hudEl, textEl, inputEl, typedBarEl,
  translationEl, bookEl, chapterEl, startVerseEl, endVerseEl, loadBtn,
  populateBooks, populateVerses
});

// initialize music controls
setupMusic(document.querySelector('.game-header'));
