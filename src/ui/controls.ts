import { BOOKS, getChapterCount } from '../bible-data';
import { chooseVerseRange, filterEndVerses } from '../passage-selector';
import { getVerseCount } from '../verse-counts';
import { requireElement } from '../shared/dom';

export function initControls() {
  const app = document.getElementById('app') as HTMLElement;
  app.innerHTML = `
    <main class="app-shell">
      <div class="titlebar">
        <span class="titlebar-title">VerseType</span>
        <span class="titlebar-context">Bible typing studio</span>
        <div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
      </div>
      <nav class="topbar">
        <a class="brand" href="#" aria-label="Verse Type home">
          <span class="brand-mark">✦</span>
          <span>Verse<span>Type</span></span>
        </a>
        <button id="sidebar-toggle" class="icon-btn sidebar-toggle" aria-label="Toggle navigation">☰</button>
        <div class="top-actions">
          <button id="sound-toggle" class="icon-btn" aria-label="Toggle sound effects">🔊</button>
          <div id="music-slot"></div>
        </div>
      </nav>

      <div class="workspace-shell">
        <aside id="mode-sidebar" class="mode-sidebar">
          <div class="sidebar-heading">Modes</div>
          <button class="mode-nav active" data-workspace="practice"><span>⌨</span><div><strong>Practice</strong><small>Choose any passage</small></div></button>
          <button class="mode-nav" data-workspace="defense"><span>🛡</span><div><strong>Defense</strong><small>Repel the shadows</small></div></button>
          <button class="mode-nav" data-workspace="campaign"><span>✦</span><div><strong>Campaign</strong><small>Journey through Scripture</small></div></button>
          <div class="sidebar-profile"><strong id="sidebar-campaign-progress">0 / 0 chunks</strong><small>Campaign journey</small></div>
        </aside>
      <section id="game-screen" class="game-screen">
        <header class="game-intro">
          <div>
            <div class="eyebrow">Practice session</div>
            <h2 id="workspace-title">Choose your passage</h2>
          </div>
          <div class="streak-pill">🔥 <span id="streak">0 day streak</span></div>
        </header>

        <div class="layout">
          <aside class="passage-panel card">
            <h3>Passage</h3>
            <p class="panel-copy">Select any chapter and verse range to practice.</p>
            <label for="translation">Translation</label>
            <select id="translation">
              <option value="kjv">KJV · King James Version</option>
              <option value="asv">ASV · American Standard Version</option>
            </select>
            <div class="field-grid">
              <div><label for="book">Book</label><select id="book"></select></div>
              <div><label for="chapter">Chapter</label><select id="chapter"></select></div>
            </div>
            <div class="field-grid">
              <div><label for="start-verse">From verse</label><select id="start-verse"></select></div>
              <div><label for="end-verse">To verse</label><select id="end-verse"></select></div>
            </div>
            <button id="load-passage" class="primary-btn">Load passage</button>
            <label for="game-mode">Game mode</label>
            <select id="game-mode">
              <option value="practice">🌿 Practice — relaxed</option>
              <option value="precision">🎯 Precision — highlight mistakes</option>
              <option value="sprint">⚡ Sprint — beat 60 seconds</option>
              <option value="memory">🧠 Memory — words fade as you type</option>
              <option value="defense">🛡 Scripture Defense — minigame</option>
            </select>
            <div class="profile-card">
              <div class="level-row"><strong id="level-label">Level 1</strong><span id="xp-label">0 XP</span></div>
              <div class="xp-track"><div id="xp-fill"></div></div>
              <small id="personal-best">Personal best: 0 WPM</small>
            </div>
            <div id="status" class="status" role="status"></div>
            <div class="tip"><span>⌨</span><p><strong>Typing tip</strong>Keep your eyes on the text, not the keyboard.</p></div>
          </aside>

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
                <button data-upgrade="power"><span>⚡</span><div><strong>Word Power</strong><small>More damage · <b data-cost="power">35</b> faith</small></div><i data-level="power">Lv 0</i></button>
                <button data-upgrade="ward"><span>🛡</span><div><strong>Stone Ward</strong><small>Less fortress damage · <b data-cost="ward">45</b> faith</small></div><i data-level="ward">Lv 0</i></button>
                <button data-upgrade="slow"><span>❄</span><div><strong>Still Waters</strong><small>Slow approaching foes · <b data-cost="slow">55</b> faith</small></div><i data-level="slow">Lv 0</i></button>
              </div>
            </section>
            <section id="campaign-screen" class="campaign-screen is-hidden">
              <header class="campaign-header">
                <div><div class="eyebrow">The Scripture Journey</div><h2>Campaign</h2><p>Complete every passage, chapter, and book—one comfortable session at a time.</p></div>
                <div class="campaign-summary"><strong id="campaign-total-stars">0 ★</strong><span id="campaign-total-progress">0 of 0 chunks</span></div>
              </header>
              <div class="campaign-toolbar">
                <button id="campaign-back" class="secondary-btn is-hidden">← All books</button>
                <div id="campaign-breadcrumb">66 books · 1,189 chapters</div>
                <button id="dev-tools-toggle" class="ghost-btn">Development tools</button>
              </div>
              <div id="campaign-dev-tools" class="campaign-dev-tools is-hidden">
                <strong>Campaign development tools</strong>
                <button data-dev-action="complete-book">Complete selected book</button>
                <button data-dev-action="reset-book">Reset selected book</button>
                <button data-dev-action="complete-all">Complete all books</button>
                <button data-dev-action="reset-all">Reset all progress</button>
              </div>
              <div id="campaign-content" class="campaign-content"></div>
            </section>
            </div>
            <div id="hud" class="hud"></div>
            <div id="challenge-banner" class="challenge-banner">🌿 Relaxed practice</div>
            <article id="typing-card" class="typing-card card">
              <div class="passage-heading">
                <div><small>NOW TYPING</small><h3 id="passage-title">John 3:16</h3></div>
                <button id="focus-button" class="ghost-btn">Focus mode</button>
              </div>
              <div class="progress-track"><div id="progress-fill"></div></div>
              <div id="text" class="text-display" tabindex="0"></div>
              <div class="typed-area">
                <div id="typed-bar" class="typed-bar" aria-hidden="true"></div>
                <input id="input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Type the passage here">
              </div>
              <div class="typing-footer"><span>Click the passage or start typing</span><button id="restart" class="text-btn">↻ Restart</button></div>
            </article>
          </section>
        </div>
      </section>

      <div id="results" class="modal-backdrop is-hidden">
        <section class="results-card">
          <div class="success-mark">✓</div>
          <div class="eyebrow">Passage complete</div>
          <h2>Beautiful work!</h2>
          <p>You carried this verse from the page to your memory.</p>
          <div id="reward-message" class="reward-message"></div>
          <div id="result-stats" class="result-stats"></div>
          <div class="result-actions">
            <button id="try-again" class="secondary-btn">Try again</button>
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
    streakEl: requireElement('streak', HTMLElement), levelLabelEl: requireElement('level-label', HTMLElement),
    xpLabelEl: requireElement('xp-label', HTMLElement), xpFillEl: requireElement('xp-fill', HTMLElement),
    personalBestEl: requireElement('personal-best', HTMLElement),
    defenseGameEl: requireElement('defense-game', HTMLElement), faithCountEl: requireElement('faith-count', HTMLElement),
    fortressHealthEl: requireElement('fortress-health', HTMLElement), waveCountEl: requireElement('wave-count', HTMLElement),
    defeatedCountEl: requireElement('defeated-count', HTMLElement), battlePathEl: requireElement('battle-path', HTMLElement),
    battleMessageEl: requireElement('battle-message', HTMLElement),
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
