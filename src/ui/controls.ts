import { BOOKS, getChapterCount } from '../bible-data';
import { chooseVerseRange, filterEndVerses } from '../passage-selector';
import { getVerseCount } from '../verse-counts';
import { requireElement } from '../shared/dom';
import type { AppConfig } from '../config';
import { formatVerseSelectionLabel } from '../memory/domain/passage.ts';
import { practiceWorkspaceMarkup } from './practice-workspace.ts';
import { multiplayerWorkspaceMarkup } from '../multiplayer/ui/workspace.ts';

export function initControls(config: AppConfig) {
  const developerControls = config.isDevelopment ? `
    <button id="dev-complete-passage" class="dev-complete-btn" type="button">Dev: Complete passage</button>` : '';
  const journeyDeveloperToggle = config.isDevelopment
    ? '<button id="dev-tools-toggle" class="ghost-btn">Development tools</button>'
    : '';
  const journeyDeveloperPanel = config.isDevelopment ? `
    <div id="campaign-dev-tools" class="campaign-dev-tools is-hidden">
      <strong>Journey development tools</strong>
      <button data-dev-action="complete-book">Complete selected book</button>
      <button data-dev-action="reset-book">Reset selected book</button>
      <button data-dev-action="complete-all">Complete all books</button>
      <button data-dev-action="reset-all">Reset all progress</button>
    </div>` : '<div id="campaign-dev-tools" class="is-hidden"></div>';
  const app = document.getElementById('app') as HTMLElement;
  app.innerHTML = `
    <main class="app-shell">
      <nav class="topbar">
        <a class="brand" href="#" aria-label="Typology home">
          <span class="brand-mark">✦</span>
          <span>Typology</span>
        </a>
        <div></div>
        <div class="top-actions">
          <div class="header-profile">
            <div class="level-summary"><strong id="level-label">Level 1</strong><span id="xp-label" class="is-hidden"></span></div>
            <div class="xp-track"><div id="xp-fill"></div></div>
            <div class="speed-summary">
              <small id="personal-best"><span>Best</span><strong>0 WPM</strong></small>
              <small id="lifetime-wpm"><span>Lifetime</span><strong>0 WPM</strong></small>
              <small id="recent-wpm"><span>Recent</span><strong>0 WPM</strong></small>
            </div>
          </div>
          <div class="settings">
            <button id="settings-toggle" class="settings-toggle" type="button" aria-label="Settings" aria-expanded="false" aria-controls="settings-menu">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.8 7.8 0 0 0 0-3l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14.1 2h-4.2l-.4 3.1A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5l.4 3.1h4.2l.4-3.1a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2.2-1.5Z"/></svg>
            </button>
            <div id="settings-menu" class="settings-menu is-hidden">
              <header><div><small>Preferences</small><strong>App settings</strong></div></header>
              <div class="setting-row">
                <div><strong>Cursor smoothing</strong><small>Animate the typing cursor between characters</small></div>
                <button id="cursor-smoothing-toggle" class="sound-switch" aria-label="Toggle cursor smoothing" aria-pressed="true"><i></i><span>On</span></button>
              </div>
              <div class="setting-row">
                <div><strong>Sound effects</strong><small>Typing and completion feedback</small></div>
                <button id="sound-toggle" class="sound-switch" aria-label="Toggle sound effects" aria-pressed="true"><i></i><span>On</span></button>
              </div>
              <div class="setting-row music-setting"><div><strong>Background music</strong><small>Playback and volume</small></div><div id="music-slot"></div></div>
            </div>
          </div>
        </div>
      </nav>

      <div class="workspace-shell">
        <aside id="mode-sidebar" class="mode-sidebar" aria-label="Game modes">
          <button id="sidebar-toggle" class="sidebar-toggle" type="button" aria-label="Collapse navigation" aria-controls="mode-sidebar" aria-expanded="true"><span aria-hidden="true">‹</span><b>Hide menu</b></button>
          <div class="sidebar-heading">Modes</div>
          <button class="mode-nav active" data-workspace="campaign" aria-label="Journey" title="Journey"><span>✦</span><div><strong>Journey</strong><small id="sidebar-campaign-progress">0 / 0 passages</small></div></button>
          <button class="mode-nav" data-workspace="practice" aria-label="Practice" title="Practice"><span>⌨</span><div><strong>Practice</strong><small>Practice with text guidance</small></div></button>
          <button class="mode-nav" data-workspace="defense" data-mode="defense" aria-label="Arcade" title="Arcade"><span>◇</span><div><strong>Arcade</strong><small>Repel the shadows</small></div></button>
          <button class="mode-nav" data-workspace="multiplayer" aria-label="Together" title="Together"><span>◎</span><div><strong>Together</strong><small>Type and recall as a group</small></div></button>
        </aside>
        <div class="page-viewport">
      <section id="home-screen" class="app-page home-screen">
        <div class="home-menu">
          <h1>Typology</h1>
          <div class="home-mode-grid" role="navigation" aria-label="Game modes">
            <button class="home-mode home-mode--journey" type="button" data-home-workspace="campaign">
              <span class="home-mode-icon" aria-hidden="true">✦</span>
              <span class="home-mode-copy"><strong>Journey</strong><small>Progress through Scripture</small></span>
              <span class="home-mode-arrow" aria-hidden="true">→</span>
            </button>
            <button class="home-mode home-mode--practice" type="button" data-home-workspace="practice">
              <span class="home-mode-icon" aria-hidden="true">⌨</span>
              <span class="home-mode-copy"><strong>Practice</strong><small>Type a passage</small></span>
              <span class="home-mode-arrow" aria-hidden="true">→</span>
            </button>
            <button class="home-mode home-mode--arcade" type="button" data-home-workspace="defense" data-home-mode="defense">
              <span class="home-mode-icon" aria-hidden="true">◇</span>
              <span class="home-mode-copy"><strong>Arcade</strong><small>Defend the light</small></span>
              <span class="home-mode-arrow" aria-hidden="true">→</span>
            </button>
            <button class="home-mode home-mode--together" type="button" data-home-workspace="multiplayer">
              <span class="home-mode-icon" aria-hidden="true">◎</span>
              <span class="home-mode-copy"><strong>Together</strong><small>Play with others</small></span>
              <span class="home-mode-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
      <section id="game-screen" class="app-page game-screen is-hidden">
        <header class="page-header game-intro">
          <div>
            <div class="eyebrow">Practice session</div>
            <h2 id="workspace-title">Choose your passage</h2>
          </div>
        </header>

        ${practiceWorkspaceMarkup(developerControls)}
      </section>
      <section id="campaign-screen" class="app-page campaign-screen is-hidden">
        <header class="page-header campaign-header">
          <div><div class="eyebrow">The Scripture Journey</div><h2>Journey</h2><p>Complete every passage, chapter, and book—one comfortable session at a time.</p></div>
          <div class="campaign-summary"><strong id="campaign-total-stars">0 light</strong><span id="campaign-total-progress">0 of 0 passages</span></div>
        </header>
        <div class="campaign-toolbar">
          <button id="campaign-back" class="secondary-btn is-hidden">← All books</button>
          <div id="campaign-breadcrumb">66 books · 1,189 chapters</div>
          <label class="campaign-search" for="campaign-search"><span>Search books</span><input id="campaign-search" type="search" placeholder="Type a book name…" autocomplete="off"></label>
          ${journeyDeveloperToggle}
        </div>
        <button id="journey-continue" class="journey-continue is-hidden" type="button"></button>
        ${journeyDeveloperPanel}
        <div id="campaign-content" class="campaign-content"></div>
      </section>
      ${multiplayerWorkspaceMarkup()}
        </div>
      </div>

      <div id="results" class="modal-backdrop is-hidden">
        <section class="results-card">
          <div class="success-mark">✓</div>
          <h2 id="results-title">Passage complete</h2>
          <p id="results-copy"></p>
          <div id="reward-message" class="reward-message"></div>
          <div id="result-stats" class="result-stats"></div>
          <div id="result-analysis" class="result-analysis"></div>
          <div class="result-actions">
            <button id="try-again" class="secondary-btn">Try again</button>
            <button id="chapter-select" class="secondary-btn">Chapter select</button>
            <button id="next-passage" class="primary-btn">Choose another</button>
          </div>
          <div id="celebration" class="celebration is-hidden" aria-live="polite"></div>
        </section>
      </div>
    </main>`;

  const bookEl = requireElement('book', HTMLSelectElement);
  const chapterEl = requireElement('chapter', HTMLSelectElement);
  const translationEl = requireElement('translation', HTMLSelectElement);
  const startVerseEl = requireElement('start-verse', HTMLSelectElement);
  const endVerseEl = requireElement('end-verse', HTMLSelectElement);
  const statusEl = requireElement('status', HTMLElement);
  const loadBtn = requireElement('load-passage', HTMLButtonElement);
  const passagePickerEl = requireElement('passage-picker', HTMLElement);
  const bookGridEl = requireElement('picker-book-grid', HTMLElement);
  const chapterGridEl = requireElement('picker-chapter-grid', HTMLElement);
  const verseGridEl = requireElement('picker-verse-grid', HTMLElement);
  const pickerBookLabelEl = requireElement('picker-book-label', HTMLElement);
  const pickerChapterLabelEl = requireElement('picker-chapter-label', HTMLElement);
  const pickerRangeLabelEl = requireElement('picker-range-label', HTMLElement);
  let rangeAnchor: number | null = null;
  let completedVerseIds = new Set<string>();

  function populateBooks() {
    bookEl.innerHTML = BOOKS.map(book => `<option value="${book}">${book}</option>`).join('');
    renderPassagePicker();
  }

  function populateChapters(preferred = 1) {
    const count = getChapterCount(bookEl.value);
    chapterEl.innerHTML = Array.from({ length: count }, (_, index) =>
      `<option value="${index + 1}">${index + 1}</option>`).join('');
    chapterEl.value = String(Math.min(Math.max(preferred, 1), count));
  }

  function renderVerseOptions(select: HTMLSelectElement, verses: number[], selected: number) {
    select.innerHTML = verses.map(verse => `<option value="${verse}">${verse}</option>`).join('');
    select.value = String(selected);
  }

  function constrainEndVerses() {
    const verses = Array.from(startVerseEl.options).map(option => Number(option.value)).filter(Boolean);
    const ends = filterEndVerses(verses, Number(startVerseEl.value));
    const currentEnd = Number(endVerseEl.value);
    renderVerseOptions(endVerseEl, ends, ends.includes(currentEnd) ? currentEnd : ends[0]);
  }

  async function populateVerses() {
    const book = bookEl.value;
    const chapter = Number(chapterEl.value);
    const previousStart = Number(startVerseEl.value);
    const previousEnd = Number(endVerseEl.value);
    const count = getVerseCount(book, chapter);
    const verseNumbers = Array.from({ length: count }, (_, index) => index + 1);
    const range = chooseVerseRange(verseNumbers, previousStart, previousEnd);
    renderVerseOptions(startVerseEl, verseNumbers, range.start);
    renderVerseOptions(endVerseEl, filterEndVerses(verseNumbers, range.start), range.end);
    startVerseEl.disabled = count === 0;
    endVerseEl.disabled = count === 0;
    loadBtn.disabled = count === 0;
    statusEl.textContent = count ? '' : 'No verse metadata is available for this chapter.';
    renderPassagePicker();
  }

  function renderPassagePicker(): void {
    const book = bookEl.value;
    const chapter = Number(chapterEl.value);
    const startVerse = Number(startVerseEl.value);
    const endVerse = Number(endVerseEl.value);
    pickerBookLabelEl.textContent = book;
    pickerChapterLabelEl.textContent = chapter ? `Chapter ${chapter}` : '';
    pickerRangeLabelEl.textContent = startVerse
      ? formatVerseSelectionLabel(startVerse, endVerse)
      : '';
    bookGridEl.replaceChildren(...BOOKS.map(candidate => pickerButton(candidate, candidate === book, () => {
      bookEl.value = candidate;
      populateChapters();
      void populateVerses();
    })));
    const chapterCount = getChapterCount(book);
    chapterGridEl.replaceChildren(...Array.from({ length: chapterCount }, (_, index) => {
      const candidate = index + 1;
      return pickerButton(String(candidate), candidate === chapter, () => {
        chapterEl.value = String(candidate);
        void populateVerses();
      });
    }));
    const verseCount = getVerseCount(book, chapter);
    verseGridEl.replaceChildren(...Array.from({ length: verseCount }, (_, index) => {
      const verse = index + 1;
      const button = pickerButton(String(verse), verse >= startVerse && verse <= endVerse, () => {
        if (rangeAnchor === null) {
          rangeAnchor = verse;
          startVerseEl.value = String(verse);
          endVerseEl.value = String(verse);
        } else {
          startVerseEl.value = String(Math.min(rangeAnchor, verse));
          constrainEndVerses();
          endVerseEl.value = String(Math.max(rangeAnchor, verse));
          rangeAnchor = null;
        }
        renderPassagePicker();
      });
      button.dataset.selected = String(verse >= startVerse && verse <= endVerse);
      const verseId = `${book}:${chapter}:${verse}-${verse}`;
      button.dataset.complete = String(completedVerseIds.has(verseId));
      button.setAttribute('aria-label', `Verse ${verse}${completedVerseIds.has(verseId) ? ', completed' : ''}`);
      return button;
    }));
  }

  function pickerButton(label: string, selected: boolean, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(selected));
    button.addEventListener('click', onClick);
    return button;
  }

  function setPickerVerseProgress(progress: Record<string, number>): void {
    completedVerseIds = new Set(Object.entries(progress)
      .filter(([, stars]) => stars > 0)
      .map(([id]) => id));
    renderPassagePicker();
  }

  document.getElementById('choose-passage')?.addEventListener('click', () => {
    rangeAnchor = null;
    renderPassagePicker();
    passagePickerEl.classList.remove('is-hidden');
  });
  document.getElementById('close-passage-picker')?.addEventListener('click', () => {
    passagePickerEl.classList.add('is-hidden');
  });
  loadBtn.addEventListener('click', () => passagePickerEl.classList.add('is-hidden'));

  return {
    hudEl: requireElement('hud', HTMLElement), textEl: requireElement('text', HTMLElement),
    chapterReaderEl: requireElement('chapter-reader', HTMLElement),
    inputEl: requireElement('input', HTMLInputElement), typedBarEl: requireElement('typed-bar', HTMLElement),
    translationEl, bookEl, chapterEl, startVerseEl, endVerseEl,
    loadBtn, statusEl,
    passageTitleEl: requireElement('passage-title', HTMLElement), resultsEl: requireElement('results', HTMLElement),
    resultStatsEl: requireElement('result-stats', HTMLElement), progressFillEl: requireElement('progress-fill', HTMLElement),
    gameModeEl: requireElement('game-mode', HTMLSelectElement), challengeBannerEl: requireElement('challenge-banner', HTMLElement),
    typingCardEl: requireElement('typing-card', HTMLElement), rewardMessageEl: requireElement('reward-message', HTMLElement),
    levelLabelEl: requireElement('level-label', HTMLElement),
    xpLabelEl: requireElement('xp-label', HTMLElement), xpFillEl: requireElement('xp-fill', HTMLElement),
    personalBestEl: requireElement('personal-best', HTMLElement),
    lifetimeWpmEl: requireElement('lifetime-wpm', HTMLElement),
    recentWpmEl: requireElement('recent-wpm', HTMLElement),
    defenseGameEl: requireElement('defense-game', HTMLElement), faithCountEl: requireElement('faith-count', HTMLElement),
    fortressHealthEl: requireElement('fortress-health', HTMLElement), waveCountEl: requireElement('wave-count', HTMLElement),
    defeatedCountEl: requireElement('defeated-count', HTMLElement), battlePathEl: requireElement('battle-path', HTMLElement),
    battleMessageEl: requireElement('battle-message', HTMLElement),
    readyIndicatorEl: requireElement('ready-indicator', HTMLElement),
    recallPromptEl: requireElement('recall-prompt', HTMLElement),
    favoritePassageEl: requireElement('favorite-passage', HTMLButtonElement),
    memoryLibraryEl: requireElement('practice-library', HTMLElement),
    practiceFavoritesEl: requireElement('practice-favorites', HTMLElement),
    memoryFavoritesEl: requireElement('memory-favorites', HTMLElement),
    memoryRecentEl: requireElement('practice-recent', HTMLElement),
    playlistFormEl: requireElement('playlist-create-form', HTMLFormElement),
    playlistNameEl: requireElement('playlist-name', HTMLInputElement),
    playlistListEl: requireElement('playlist-list', HTMLElement),
    playlistStatusEl: requireElement('playlist-status', HTMLElement),
    resultAnalysisEl: requireElement('result-analysis', HTMLElement),
    campaignScreenEl: requireElement('campaign-screen', HTMLElement),
    multiplayerScreenEl: requireElement('multiplayer-screen', HTMLElement),
    campaignContentEl: requireElement('campaign-content', HTMLElement),
    campaignBackEl: requireElement('campaign-back', HTMLButtonElement),
    campaignBreadcrumbEl: requireElement('campaign-breadcrumb', HTMLElement),
    campaignTotalStarsEl: requireElement('campaign-total-stars', HTMLElement),
    campaignTotalProgressEl: requireElement('campaign-total-progress', HTMLElement),
    campaignDevToolsEl: requireElement('campaign-dev-tools', HTMLElement),
    sidebarCampaignProgressEl: requireElement('sidebar-campaign-progress', HTMLElement),
    celebrationEl: requireElement('celebration', HTMLElement),
    populateBooks, populateChapters, populateVerses, constrainEndVerses, setPickerVerseProgress
  };
}
