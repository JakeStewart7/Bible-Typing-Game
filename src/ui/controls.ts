import { BOOKS, getChapterCount } from '../bible-data';
import { chooseVerseRange, filterEndVerses } from '../passage-selector';
import { getVerseCount } from '../verse-counts';
import { requireElement } from '../shared/dom';
import type { AppConfig } from '../config';

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
        <a class="brand" href="#" aria-label="Verse Type home">
          <span class="brand-mark">✦</span>
          <span>Verse<span>Type</span></span>
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
              <header><div><small>Preferences</small><strong>Audio settings</strong></div></header>
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
          <button class="mode-nav" data-workspace="practice" data-mode="practice" aria-label="Practice" title="Practice"><span>⌨</span><div><strong>Practice</strong><small>Relaxed typing</small></div></button>
          <button class="mode-nav" data-workspace="practice" data-mode="memory" aria-label="Memory" title="Memory"><span>◫</span><div><strong>Memory</strong><small>Words fade away</small></div></button>
          <button class="mode-nav" data-workspace="defense" data-mode="defense" aria-label="Arcade" title="Arcade"><span>◇</span><div><strong>Arcade</strong><small>Repel the shadows</small></div></button>
        </aside>
        <div class="page-viewport">
      <section id="game-screen" class="app-page game-screen is-hidden">
        <header class="page-header game-intro">
          <div>
            <div class="eyebrow">Practice session</div>
            <h2 id="workspace-title">Choose your passage</h2>
          </div>
        </header>

        <div class="practice-workspace">
          <section class="passage-panel card">
            <div class="passage-panel-heading"><h3>Passage</h3><p>Select a reference to practice.</p></div>
            <div class="passage-fields">
              <div class="translation-field"><label for="translation">Translation</label><select id="translation">
                <option value="kjv">KJV · King James Version</option>
                <option value="asv">ASV · American Standard Version</option>
              </select></div>
              <div><label for="book">Book</label><select id="book"></select></div>
              <div><label for="chapter">Chapter</label><select id="chapter"></select></div>
              <div><label for="start-verse">From</label><select id="start-verse"></select></div>
              <div><label for="end-verse">To</label><select id="end-verse"></select></div>
            </div>
            <button id="load-passage" class="primary-btn">Load passage</button>
            <select id="game-mode" class="is-hidden" aria-hidden="true">
              <option value="practice">Practice — relaxed</option>
              <option value="memory">Memory — words fade as you type</option>
              <option value="defense">Arcade — repel the shadows</option>
            </select>
            <div id="status" class="status" role="status"></div>
            <div id="memory-controls" class="memory-controls is-hidden">
              <label for="memory-visibility">Letters shown <strong id="memory-visibility-value">50%</strong></label>
              <input id="memory-visibility" type="range" min="0" max="100" step="10" value="50">
            </div>
            <div id="memory-library" class="memory-library is-hidden">
              <section><h4>Favorites</h4><div id="memory-favorites" class="memory-passage-list"></div></section>
              <section><h4>Recently practiced</h4><div id="memory-recent" class="memory-passage-list"></div></section>
            </div>
          </section>

          <section class="play-area">
            <section id="defense-game" class="defense-game is-hidden">
              <div class="defense-topbar">
                <div class="resource"><span>✦</span><div><strong id="faith-count">0</strong><small>Faith</small></div></div>
                <div class="resource"><span>⌂</span><div><strong id="fortress-health">100</strong><small>Fortress</small></div></div>
                <div class="resource"><span>⚔</span><div><strong id="wave-count">1</strong><small>Wave</small></div></div>
                <div class="resource"><span>✓</span><div><strong id="defeated-count">0</strong><small>Defeated</small></div></div>
              </div>
              <div class="battlefield">
                <div class="sky-decoration">✦　·　✧　　　·　✦</div>
                <div class="shadow-gate">⚑</div>
                <div id="battle-path" class="battle-path"></div>
                <div class="fortress" title="Your fortress"><span>♜</span><i></i></div>
                <div id="battle-message" class="battle-message">Type correctly to send light across the field!</div>
              </div>
              <div class="upgrade-dock">
                <button data-upgrade="power"><span>»</span><div><strong>Word Power</strong><small>More damage · <b data-cost="power">35</b> faith</small></div><i data-level="power">Lv 0</i></button>
                <button data-upgrade="ward"><span>◇</span><div><strong>Stone Ward</strong><small>Less fortress damage · <b data-cost="ward">45</b> faith</small></div><i data-level="ward">Lv 0</i></button>
                <button data-upgrade="slow"><span>❄</span><div><strong>Still Waters</strong><small>Slow approaching foes · <b data-cost="slow">55</b> faith</small></div><i data-level="slow">Lv 0</i></button>
              </div>
            </section>
            <div id="hud" class="hud"></div>
            <div id="challenge-banner" class="challenge-banner is-hidden"></div>
            <article id="typing-card" class="typing-card card">
              <div class="passage-heading">
                <div><small>NOW TYPING</small><h3 id="passage-title">John 3:16</h3></div>
                <button id="focus-button" class="ghost-btn">Focus mode</button>
              </div>
              <div class="progress-track"><div id="progress-fill"></div></div>
              <div id="ready-indicator" class="ready-indicator" role="status" aria-live="polite">
                <span aria-hidden="true">✦</span><strong>Ready to type</strong>
              </div>
              <div id="text" class="text-display" tabindex="0"></div>
              <div class="typed-area">
                <div id="typed-bar" class="typed-bar" aria-hidden="true"></div>
                <input id="input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Type the passage here">
              </div>
              <div class="typing-footer">
                <span>Click the passage or start typing</span>
                <div>
                  <button id="favorite-passage" class="text-btn is-hidden" type="button" aria-pressed="false">☆ Favorite</button>
                  <button id="hint-button" class="hint-button" type="button" disabled>Hint</button>
                  <button id="restart" class="text-btn">↻ Restart</button>
                </div>
              </div>
              ${developerControls}
            </article>
          </section>
        </div>
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

  function populateBooks() {
    bookEl.innerHTML = BOOKS.map(book => `<option value="${book}">${book}</option>`).join('');
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
  }

  return {
    hudEl: requireElement('hud', HTMLElement), textEl: requireElement('text', HTMLElement),
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
    hintButtonEl: requireElement('hint-button', HTMLButtonElement),
    favoritePassageEl: requireElement('favorite-passage', HTMLButtonElement),
    memoryLibraryEl: requireElement('memory-library', HTMLElement),
    memoryFavoritesEl: requireElement('memory-favorites', HTMLElement),
    memoryRecentEl: requireElement('memory-recent', HTMLElement),
    resultAnalysisEl: requireElement('result-analysis', HTMLElement),
    campaignScreenEl: requireElement('campaign-screen', HTMLElement),
    campaignContentEl: requireElement('campaign-content', HTMLElement),
    campaignBackEl: requireElement('campaign-back', HTMLButtonElement),
    campaignBreadcrumbEl: requireElement('campaign-breadcrumb', HTMLElement),
    campaignTotalStarsEl: requireElement('campaign-total-stars', HTMLElement),
    campaignTotalProgressEl: requireElement('campaign-total-progress', HTMLElement),
    campaignDevToolsEl: requireElement('campaign-dev-tools', HTMLElement),
    sidebarCampaignProgressEl: requireElement('sidebar-campaign-progress', HTMLElement),
    celebrationEl: requireElement('celebration', HTMLElement),
    populateBooks, populateChapters, populateVerses, constrainEndVerses
  };
}
