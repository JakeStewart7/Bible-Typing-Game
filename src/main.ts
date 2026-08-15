// main.ts: keep this file as a minimal orchestrator that wires together modules
// and delegates behavior. Avoid adding business logic here — put it in focused modules.

import './styles/main.css';
import { createGame } from './game/state';
import type { Game } from './game/state';
import { initControls } from './ui/controls';
import { initGameControllers } from './game/controller';
import { setupMusic } from './audio/music';
import { toggleEffects } from './audio/effects';
import { createCampaignController } from './campaign-controller';
import type { CampaignChunk } from './campaign';
import { fetchRange } from './bible-api';

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
  campaignScreenEl, campaignContentEl, campaignBackEl, campaignBreadcrumbEl,
  campaignTotalStarsEl, campaignTotalProgressEl, campaignDevToolsEl,
  sidebarCampaignProgressEl, celebrationEl,
  populateBooks, populateChapters, populateVerses, constrainEndVerses
} = initControls();

// ----------------------------
// Game state (keep instance export for other modules/tests)
// ----------------------------
export const game: Game = createGame('Typing games help improve speed and accuracy through practice and focus.');

// Wire controllers (moves logic out of main.ts into game/controller.ts)
const gameController = initGameControllers(game, {
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

let startCampaignChunk: (chunk: CampaignChunk, text: string) => void = () => undefined;
const campaignController = createCampaignController({
  contentEl: campaignContentEl, backEl: campaignBackEl, breadcrumbEl: campaignBreadcrumbEl,
  totalStarsEl: campaignTotalStarsEl, totalProgressEl: campaignTotalProgressEl,
  devToolsEl: campaignDevToolsEl, sidebarProgressEl: sidebarCampaignProgressEl, celebrationEl
}, (chunk, text) => startCampaignChunk(chunk, text));

startCampaignChunk = (chunk, text) => {
  showWorkspace('practice');
  gameController.startCampaignChunk(chunk, text);
};
gameController.setCampaignHooks({
  save: campaignController.saveChunk,
  progress: campaignController.getProgress,
  celebrateBook: campaignController.celebrateBook,
  returnToMenu: book => {
    showWorkspace('campaign');
    campaignController.renderBook(book);
  },
  startNext: chunk => {
    void fetchCampaignChunk(chunk);
  }
});

async function fetchCampaignChunk(chunk: CampaignChunk): Promise<void> {
  const data = await fetchRange(chunk.book, chunk.chapter, chunk.startVerse, chunk.endVerse, 'kjv', false);
  startCampaignChunk(chunk, data.verses?.map(verse => verse.text).join(' ') ?? '');
}

function showWorkspace(workspace: string): void {
  document.getElementById('game-screen')?.classList.remove('is-hidden');
  campaignScreenEl.classList.toggle('is-hidden', workspace !== 'campaign');
  document.getElementById('game-screen')?.classList.toggle('is-hidden', workspace === 'campaign');
  document.querySelectorAll('.mode-nav').forEach(button => button.classList.toggle('active', (button as HTMLElement).dataset.workspace === workspace));
  if (workspace === 'defense') {
    const mode = document.getElementById('game-mode') as HTMLSelectElement | null;
    if (mode) { mode.value = 'defense'; mode.dispatchEvent(new Event('change')); }
  } else if (workspace === 'practice') {
    gameController.leaveCampaign();
  } else campaignController.renderBooks();
}

document.querySelectorAll<HTMLElement>('.mode-nav').forEach(button => button.addEventListener('click', () => showWorkspace(button.dataset.workspace ?? 'practice')));
document.getElementById('sidebar-toggle')?.addEventListener('click', () => document.getElementById('mode-sidebar')?.classList.toggle('collapsed'));

document.getElementById('sound-toggle')?.addEventListener('click', event => {
  const button = event.currentTarget as HTMLButtonElement;
  button.textContent = toggleEffects() ? '🔊' : '🔇';
});
