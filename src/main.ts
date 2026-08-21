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
import { fetchChapter } from './bible-api';
import type { ChapterVerse } from './typing/chapter-reader';
import { appConfig } from './config';
import { AppStateRepository } from './persistence/app-state';
import { AppStorage } from './persistence/storage';
import { ProfileRepository } from './persistence/profile-repository';
import { applyPageTheme, themeForWorkspace } from './ui/page-theme';
import { createPlaylistController } from './memory/ui/playlist-controller.ts';

import trackDetermination from '../assets/music/determination.mp3';
import trackApple from '../assets/music/apple_cider.ogg';

// bundle tracks for the music module to consume
(window as Window & { __bundledMusic?: string[] }).__bundledMusic = [trackDetermination, trackApple];

// initialize DOM and controls
const {
  hudEl, textEl, chapterReaderEl, inputEl, typedBarEl,
  translationEl, bookEl, chapterEl, startVerseEl, endVerseEl, loadBtn,
  statusEl, passageTitleEl, resultsEl, resultStatsEl, progressFillEl,
  gameModeEl, challengeBannerEl, typingCardEl, rewardMessageEl,
  levelLabelEl, xpLabelEl, xpFillEl, personalBestEl, lifetimeWpmEl, recentWpmEl,
  defenseGameEl, faithCountEl, fortressHealthEl, waveCountEl, defeatedCountEl,
  battlePathEl, battleMessageEl,
  readyIndicatorEl, hintButtonEl, favoritePassageEl,
  memoryLibraryEl, practiceFavoritesEl, memoryFavoritesEl, memoryRecentEl, resultAnalysisEl,
  playlistFormEl, playlistNameEl, playlistListEl, playlistStatusEl,
  campaignScreenEl, campaignContentEl, campaignBackEl, campaignBreadcrumbEl,
  campaignTotalStarsEl, campaignTotalProgressEl, campaignDevToolsEl,
  sidebarCampaignProgressEl, celebrationEl,
  populateBooks, populateChapters, populateVerses, constrainEndVerses
} = initControls(appConfig);
const storage = new AppStorage(window.localStorage);
const stateRepository = new AppStateRepository(storage);
const profileRepository = new ProfileRepository(storage);

// ----------------------------
// Game state (keep instance export for other modules/tests)
// ----------------------------
export const game: Game = createGame('Typing games help improve speed and accuracy through practice and focus.');

// Wire controllers (moves logic out of main.ts into game/controller.ts)
const gameController = initGameControllers(game, {
  hudEl, textEl, chapterReaderEl, inputEl, typedBarEl,
  translationEl, bookEl, chapterEl, startVerseEl, endVerseEl, loadBtn,
  statusEl, passageTitleEl, resultsEl, resultStatsEl, progressFillEl,
  gameModeEl, challengeBannerEl, typingCardEl, rewardMessageEl,
  levelLabelEl, xpLabelEl, xpFillEl, personalBestEl, lifetimeWpmEl, recentWpmEl,
  defenseGameEl, faithCountEl, fortressHealthEl, waveCountEl, defeatedCountEl,
  battlePathEl, battleMessageEl,
  readyIndicatorEl, hintButtonEl, favoritePassageEl,
  memoryLibraryEl, practiceFavoritesEl, memoryFavoritesEl, memoryRecentEl, resultAnalysisEl,
  populateBooks, populateChapters, populateVerses, constrainEndVerses
}, stateRepository, profileRepository, storage, appConfig);
const playlistController = createPlaylistController({
  form: playlistFormEl,
  nameInput: playlistNameEl,
  list: playlistListEl,
  status: playlistStatusEl
}, {
  repository: stateRepository,
  getActivePassage: gameController.getActivePassage,
  loadPassage: gameController.loadPassage,
  activateMemoryMode: () => gameController.setPracticeMode('memory', { memoryStart: 'preserve' })
});
gameController.setPlaylistHooks({
  complete: playlistController.completeActivePassage,
  continue: playlistController.continueActivePlaylist,
  passageChanged: playlistController.handlePassageChanged
});

setupMusic(document.getElementById('music-slot'));

let startCampaignChunk: (chunk: CampaignChunk, verses: ChapterVerse[]) => void = () => undefined;
const campaignController = createCampaignController({
  contentEl: campaignContentEl, backEl: campaignBackEl, breadcrumbEl: campaignBreadcrumbEl,
  totalStarsEl: campaignTotalStarsEl, totalProgressEl: campaignTotalProgressEl,
  devToolsEl: campaignDevToolsEl, sidebarProgressEl: sidebarCampaignProgressEl, celebrationEl
}, (chunk, text) => startCampaignChunk(chunk, text), stateRepository, appConfig);

startCampaignChunk = (chunk, verses) => {
  stateRepository.writeJourneyPosition(chunk);
  showWorkspace('campaign-play');
  gameController.startCampaignChunk(chunk, verses);
};
gameController.setCampaignHooks({
  save: campaignController.saveChunk,
  progress: campaignController.getProgress,
  celebrateBook: campaignController.celebrateBook,
  returnToMenu: book => {
    const journeyPosition = stateRepository.readJourneyPosition();
    showWorkspace('campaign');
    if (journeyPosition) campaignController.renderBook(journeyPosition.book);
    campaignController.renderBook(book);
  },
  startNext: chunk => {
    void fetchCampaignChunk(chunk);
  }
});

async function fetchCampaignChunk(chunk: CampaignChunk): Promise<void> {
  const data = await fetchChapter(chunk.book, chunk.chapter, 'kjv', false);
  startCampaignChunk(chunk, (data.verses ?? []).map((verse, index) => ({
    verse: verse.verse ?? index + 1,
    text: verse.text
  })));
}

function showWorkspace(workspace: string, selectedMode?: string): void {
  const gameScreen = document.getElementById('game-screen');
  campaignScreenEl.classList.toggle('is-hidden', workspace !== 'campaign');
  gameScreen?.classList.toggle('is-hidden', workspace === 'campaign');
  gameScreen?.classList.toggle('campaign-play', workspace === 'campaign-play');
  const appShell = document.querySelector<HTMLElement>('.app-shell');
  if (appShell) applyPageTheme(appShell, themeForWorkspace(workspace, selectedMode));
  gameScreen?.scrollTo({ top: 0 });
  campaignScreenEl.scrollTo({ top: 0 });
  document.querySelectorAll<HTMLElement>('.mode-nav').forEach(button => {
    const campaignActive = (workspace === 'campaign' || workspace === 'campaign-play') && button.dataset.workspace === 'campaign';
    const practiceActive = workspace === 'practice' && button.dataset.workspace === 'practice';
    const modeActive = workspace === 'defense' && button.dataset.mode === selectedMode;
    button.classList.toggle('active', campaignActive || practiceActive || modeActive);
  });
  if (workspace === 'defense') {
    const mode = document.getElementById('game-mode') as HTMLSelectElement | null;
    if (mode && mode.value !== 'defense') {
      mode.value = 'defense';
      mode.dispatchEvent(new Event('change'));
    }
  } else if (workspace === 'practice') {
    gameController.leaveCampaign();
  } else if (workspace === 'campaign') campaignController.renderBooks();
}

document.querySelectorAll<HTMLElement>('.mode-nav').forEach(button => button.addEventListener('click', () => {
  const mode = button.dataset.mode;
  if (mode) {
    gameModeEl.value = mode;
    gameModeEl.dispatchEvent(new Event('change'));
  }
  const workspace = button.dataset.workspace ?? 'practice';
  if (workspace === 'practice' && gameModeEl.value === 'defense') {
    gameModeEl.value = 'practice';
    gameModeEl.dispatchEvent(new Event('change'));
  }
  showWorkspace(workspace, mode ?? gameModeEl.value);
}));
gameModeEl.addEventListener('change', () => {
  if (gameModeEl.value === 'practice' || gameModeEl.value === 'memory') {
    showWorkspace('practice', gameModeEl.value);
  }
});
showWorkspace('campaign');
const sidebar = document.getElementById('mode-sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
sidebarToggle?.addEventListener('click', () => {
  const collapsed = sidebar?.classList.toggle('collapsed') ?? false;
  sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
  const label = sidebarToggle.querySelector('b');
  if (label) label.textContent = collapsed ? 'Show menu' : 'Hide menu';
});
const settingsMenu = document.getElementById('settings-menu');
const settingsToggle = document.getElementById('settings-toggle');
settingsToggle?.addEventListener('click', event => {
  event.stopPropagation();
  const open = settingsMenu?.classList.toggle('is-hidden') === false;
  settingsToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', event => {
  if (!(event.target as Element).closest('.settings')) {
    settingsMenu?.classList.add('is-hidden');
    settingsToggle?.setAttribute('aria-expanded', 'false');
  }
});

document.getElementById('sound-toggle')?.addEventListener('click', event => {
  const button = event.currentTarget as HTMLButtonElement;
  const enabled = toggleEffects();
  button.setAttribute('aria-pressed', String(enabled));
  const label = button.querySelector('span');
  if (label) label.textContent = enabled ? 'On' : 'Off';
});
