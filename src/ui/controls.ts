import { BOOKS, getChapterCount } from '../bible-data';
import { chooseVerseRange, filterEndVerses } from '../passage-selector';
import { getVerseCount } from '../verse-counts';

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
        <div class="desktop-nav">
          <button id="home-nav" class="nav-item active">⌂ Home</button>
          <button id="practice-nav" class="nav-item">⌨ Practice</button>
          <span class="nav-item disabled">◫ Library</span>
        </div>
        <div class="top-actions">
          <button id="sound-toggle" class="icon-btn" aria-label="Toggle sound effects">🔊</button>
          <div id="music-slot"></div>
        </div>
      </nav>

      <section id="welcome" class="welcome">
        <div class="welcome-workspace">
          <section class="welcome-hero">
            <div class="eyebrow">Scripture at your fingertips</div>
            <h1>Type the Word.<br><span>Keep it in your heart.</span></h1>
            <p>Build speed, focus, and familiarity with Scripture through a calm, rewarding typing experience.</p>
            <button id="begin-button" class="primary-btn large">Start a session <span>→</span></button>
          </section>
          <aside class="welcome-sidebar">
            <div class="daily-card">
              <div class="daily-icon">☀</div>
              <div>
                <small>Verse of the day</small>
                <strong>“For God so loved the world...”</strong>
                <span>John 3:16</span>
              </div>
            </div>
            <div class="desktop-quick-card">
              <small>QUICK START</small>
              <strong>Continue with John 3</strong>
              <span>Practice · WEB · 5 verses</span>
            </div>
          </div>
          </aside>
        </div>
      </section>

      <section id="game-screen" class="game-screen is-hidden">
        <header class="game-intro">
          <div>
            <div class="eyebrow">Practice session</div>
            <h2>Choose your passage</h2>
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
              <option value="nheb">NHEB · New Heart English Bible</option>
              <option value="ylt">YLT · Young's Literal Translation</option>
              <option value="darby">Darby Bible</option>
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
        </section>
      </div>
    </main>`;

  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const bookEl = byId<HTMLSelectElement>('book');
  const chapterEl = byId<HTMLSelectElement>('chapter');
  const translationEl = byId<HTMLSelectElement>('translation');
  const startVerseEl = byId<HTMLSelectElement>('start-verse');
  const endVerseEl = byId<HTMLSelectElement>('end-verse');
  const statusEl = byId<HTMLElement>('status');
  const loadBtn = byId<HTMLButtonElement>('load-passage');

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
    hudEl: byId<HTMLElement>('hud'), textEl: byId<HTMLElement>('text'),
    inputEl: byId<HTMLInputElement>('input'), typedBarEl: byId<HTMLElement>('typed-bar'),
    translationEl, bookEl, chapterEl, startVerseEl, endVerseEl,
    loadBtn, statusEl,
    passageTitleEl: byId<HTMLElement>('passage-title'), resultsEl: byId<HTMLElement>('results'),
    resultStatsEl: byId<HTMLElement>('result-stats'), progressFillEl: byId<HTMLElement>('progress-fill'),
    gameModeEl: byId<HTMLSelectElement>('game-mode'), challengeBannerEl: byId<HTMLElement>('challenge-banner'),
    typingCardEl: byId<HTMLElement>('typing-card'), rewardMessageEl: byId<HTMLElement>('reward-message'),
    streakEl: byId<HTMLElement>('streak'), levelLabelEl: byId<HTMLElement>('level-label'),
    xpLabelEl: byId<HTMLElement>('xp-label'), xpFillEl: byId<HTMLElement>('xp-fill'),
    personalBestEl: byId<HTMLElement>('personal-best'),
    defenseGameEl: byId<HTMLElement>('defense-game'), faithCountEl: byId<HTMLElement>('faith-count'),
    fortressHealthEl: byId<HTMLElement>('fortress-health'), waveCountEl: byId<HTMLElement>('wave-count'),
    defeatedCountEl: byId<HTMLElement>('defeated-count'), battlePathEl: byId<HTMLElement>('battle-path'),
    battleMessageEl: byId<HTMLElement>('battle-message'),
    populateBooks, populateChapters, populateVerses, constrainEndVerses
  };
}
