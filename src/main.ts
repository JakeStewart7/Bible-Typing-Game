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
import { normalizeChapterVerses, type ChapterVerse } from './typing/chapter-reader';
import { appConfig } from './config';
import { AppStateRepository } from './persistence/app-state';
import { AppStorage } from './persistence/storage';
import { ProfileRepository } from './persistence/profile-repository';
import { applyPageTheme, themeForWorkspace } from './ui/page-theme';
import { setCaretSmoothingEnabled } from './ui/caret';
import { createPlaylistController } from './memory/ui/playlist-controller.ts';
import { createMultiplayerController } from './multiplayer/ui/controller.ts';
import { MockMultiplayerClient } from './multiplayer/infrastructure/mock-multiplayer-client.ts';
import { BiblePassageProvider } from './multiplayer/infrastructure/bible-passage-provider.ts';

import trackDetermination from '../assets/music/determination.mp3';
import trackApple from '../assets/music/apple_cider.ogg';

// bundle tracks for the music module to consume
(window as Window & { __bundledMusic?: string[] }).__bundledMusic = [trackDetermination, trackApple];

const controls = initControls(appConfig);
const storage = new AppStorage(window.localStorage);
const stateRepository = new AppStateRepository(storage);
const profileRepository = new ProfileRepository(storage);
const appShell = document.querySelector<HTMLElement>('.app-shell');
const cursorSmoothingToggle = document.getElementById('cursor-smoothing-toggle');
let cursorSmoothingEnabled = stateRepository.readCursorSmoothing();
applyCursorSmoothing();
const multiplayerController = createMultiplayerController(
  new MockMultiplayerClient(new BiblePassageProvider())
);

// ----------------------------
// Game state (keep instance export for other modules/tests)
// ----------------------------
export const game: Game = createGame('');

// Wire controllers (moves logic out of main.ts into game/controller.ts)
const gameController = initGameControllers(
  game,
  controls,
  stateRepository,
  profileRepository,
  storage,
  appConfig
);
const playlistController = createPlaylistController({
  form: controls.playlistFormEl,
  nameInput: controls.playlistNameEl,
  list: controls.playlistListEl,
  status: controls.playlistStatusEl
}, {
  repository: stateRepository,
  getActivePassage: gameController.getActivePassage,
  loadPassage: gameController.loadPassage,
  activateRecallMode: () => gameController.setTextVisibility(50)
});
gameController.setPlaylistHooks({
  complete: playlistController.completeActivePassage,
  continue: playlistController.continueActivePlaylist,
  passageChanged: playlistController.handlePassageChanged
});

setupMusic(document.getElementById('music-slot'));

let startCampaignChunk: (chunk: CampaignChunk, verses: ChapterVerse[]) => void = () => undefined;
const campaignController = createCampaignController({
  contentEl: controls.campaignContentEl,
  backEl: controls.campaignBackEl,
  breadcrumbEl: controls.campaignBreadcrumbEl,
  totalStarsEl: controls.campaignTotalStarsEl,
  totalProgressEl: controls.campaignTotalProgressEl,
  devToolsEl: controls.campaignDevToolsEl,
  sidebarProgressEl: controls.sidebarCampaignProgressEl,
  celebrationEl: controls.celebrationEl
}, (chunk, text) => startCampaignChunk(chunk, text), stateRepository, appConfig);

startCampaignChunk = (chunk, verses) => {
  stateRepository.writeJourneyPosition(chunk);
  showWorkspace('campaign-play');
  gameController.startCampaignChunk(chunk, verses);
};
gameController.setCampaignHooks({
  save: campaignController.saveChunk,
  savePassage: campaignController.savePassage,
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
  startCampaignChunk(chunk, normalizeChapterVerses(data.verses ?? []));
}

function showWorkspace(workspace: string, selectedMode?: string): void {
  const homeScreen = document.getElementById('home-screen');
  const gameScreen = document.getElementById('game-screen');
  homeScreen?.classList.toggle('is-hidden', workspace !== 'home');
  controls.campaignScreenEl.classList.toggle('is-hidden', workspace !== 'campaign');
  controls.multiplayerScreenEl.classList.toggle('is-hidden', workspace !== 'multiplayer');
  gameScreen?.classList.toggle('is-hidden', workspace === 'campaign' || workspace === 'multiplayer' || workspace === 'home');
  gameScreen?.classList.toggle('campaign-play', workspace === 'campaign-play');
  const appShell = document.querySelector<HTMLElement>('.app-shell');
  appShell?.classList.toggle('home-active', workspace === 'home');
  if (appShell) applyPageTheme(appShell, themeForWorkspace(workspace, selectedMode));
  gameScreen?.scrollTo({ top: 0 });
  controls.campaignScreenEl.scrollTo({ top: 0 });
  document.querySelectorAll<HTMLElement>('.mode-nav').forEach(button => {
    const campaignActive = (workspace === 'campaign' || workspace === 'campaign-play') && button.dataset.workspace === 'campaign';
    const practiceActive = workspace === 'practice' && button.dataset.workspace === 'practice';
    const modeActive = workspace === 'defense' && button.dataset.mode === selectedMode;
    const multiplayerActive = workspace === 'multiplayer' && button.dataset.workspace === 'multiplayer';
    button.classList.toggle('active', campaignActive || practiceActive || modeActive || multiplayerActive);
  });
  if (workspace === 'defense') {
    const mode = document.getElementById('game-mode') as HTMLSelectElement | null;
    if (mode && mode.value !== 'defense') {
      mode.value = 'defense';
      mode.dispatchEvent(new Event('change'));
    }
  } else if (workspace === 'practice') {
    gameController.leaveCampaign();
    gameController.showPracticeReader();
  } else if (workspace === 'multiplayer') {
    gameController.leaveCampaign();
    multiplayerController.show();
  } else if (workspace === 'campaign') campaignController.renderBooks();
}

document.querySelectorAll<HTMLElement>('.mode-nav').forEach(button => button.addEventListener('click', () => {
  const mode = button.dataset.mode;
  if (mode) {
    controls.gameModeEl.value = mode;
    controls.gameModeEl.dispatchEvent(new Event('change'));
  }
  const workspace = button.dataset.workspace ?? 'practice';
  if (workspace === 'practice' && controls.gameModeEl.value === 'defense') {
    controls.gameModeEl.value = 'practice';
    controls.gameModeEl.dispatchEvent(new Event('change'));
  }
  showWorkspace(workspace, mode ?? controls.gameModeEl.value);
}));
document.querySelectorAll<HTMLElement>('.home-mode').forEach(button => button.addEventListener('click', () => {
  const workspace = button.dataset.homeWorkspace ?? 'practice';
  const mode = button.dataset.homeMode;
  if (mode) {
    controls.gameModeEl.value = mode;
    controls.gameModeEl.dispatchEvent(new Event('change'));
  }
  showWorkspace(workspace, mode ?? controls.gameModeEl.value);
}));
document.querySelector('.brand')?.addEventListener('click', event => {
  event.preventDefault();
  showWorkspace('home');
});
document.getElementById('home-button')?.addEventListener('click', () => showWorkspace('home'));
controls.gameModeEl.addEventListener('change', () => {
  if (controls.gameModeEl.value === 'practice' || controls.gameModeEl.value === 'memory') {
    showWorkspace('practice', controls.gameModeEl.value);
  }
});
showWorkspace('home');
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

cursorSmoothingToggle?.addEventListener('click', () => {
  cursorSmoothingEnabled = !cursorSmoothingEnabled;
  stateRepository.writeCursorSmoothing(cursorSmoothingEnabled);
  applyCursorSmoothing();
});

function applyCursorSmoothing(): void {
  setCaretSmoothingEnabled(cursorSmoothingEnabled);
  appShell?.classList.toggle('cursor-smoothing-disabled', !cursorSmoothingEnabled);
  cursorSmoothingToggle?.setAttribute('aria-pressed', String(cursorSmoothingEnabled));
  const label = cursorSmoothingToggle?.querySelector('span');
  if (label) label.textContent = cursorSmoothingEnabled ? 'On' : 'Off';
}
