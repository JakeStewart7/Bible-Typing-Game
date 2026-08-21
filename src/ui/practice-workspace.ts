import { RECALL_VISIBILITY_PRESETS } from '../memory/domain/visibility.ts';

export function practiceWorkspaceMarkup(developerControls: string): string {
  return `
    <div class="practice-workspace">
      <section id="passage-picker" class="passage-picker is-hidden" role="dialog" aria-modal="true" aria-labelledby="passage-picker-title">
        <div class="passage-picker-dialog">
          <header class="passage-picker-heading">
            <div><h3 id="passage-picker-title">Choose a passage</h3><p>Pick a book, chapter, and verse range.</p></div>
            <button id="close-passage-picker" class="ghost-btn" type="button">Close</button>
          </header>
          <div class="picker-translation"><label for="translation">Translation</label><select id="translation">
            <option value="kjv">KJV · King James Version</option>
            <option value="asv">ASV · American Standard Version</option>
          </select></div>
          <select id="book" class="is-hidden" aria-hidden="true"></select>
          <select id="chapter" class="is-hidden" aria-hidden="true"></select>
          <select id="start-verse" class="is-hidden" aria-hidden="true"></select>
          <select id="end-verse" class="is-hidden" aria-hidden="true"></select>
          <section class="picker-section"><div class="picker-section-heading"><h4>Book</h4><span id="picker-book-label"></span></div><div id="picker-book-grid" class="picker-book-grid"></div></section>
          <section class="picker-section"><div class="picker-section-heading"><h4>Chapter</h4><span id="picker-chapter-label"></span></div><div id="picker-chapter-grid" class="picker-chapter-grid"></div></section>
          <section class="picker-section"><div class="picker-section-heading"><h4>Verses</h4><span id="picker-range-label"></span></div><div id="picker-verse-grid" class="picker-verse-grid"></div></section>
          <div class="picker-actions">
            <div id="status" class="status" role="status"></div>
            <button id="load-passage" class="primary-btn">Open chapter reader</button>
          </div>
          <div id="practice-library" class="memory-library is-hidden">
            <section><h4>Practice favorites</h4><div id="practice-favorites" class="memory-passage-list"></div></section>
            <section><h4>Recall favorites</h4><div id="memory-favorites" class="memory-passage-list"></div></section>
            <section><h4>Recently practiced</h4><div id="practice-recent" class="memory-passage-list"></div></section>
          </div>
          <section id="playlist-library" class="playlist-library">
            <div class="playlist-title">
              <div><h4>Recall playlists</h4><p>Practice saved passages in order.</p></div>
              <form id="playlist-create-form">
                <label class="sr-only" for="playlist-name">New playlist name</label>
                <input id="playlist-name" maxlength="80" placeholder="New playlist name" required>
                <button class="secondary-btn" type="submit">Create</button>
              </form>
            </div>
            <div id="playlist-status" class="status" role="status"></div>
            <div id="playlist-list" class="playlist-list"></div>
          </section>
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
            <div class="reader-tools">
              <button id="choose-passage" class="ghost-btn">Choose passage</button>
              <fieldset class="text-visibility">
                <legend>Text visibility</legend>
                <div>
                  ${RECALL_VISIBILITY_PRESETS.map(({ visiblePercent, label }) =>
                    `<button type="button" data-text-visibility="${visiblePercent}" aria-pressed="${visiblePercent === 100}"><span>${visiblePercent}%</span>${label}</button>`).join('')}
                </div>
              </fieldset>
              <button id="focus-button" class="ghost-btn">Focus mode</button>
            </div>
          </div>
          <div class="progress-track"><div id="progress-fill"></div></div>
          <div id="ready-indicator" class="ready-indicator" role="status" aria-live="polite">
            <span aria-hidden="true">✦</span><strong>Ready to type</strong>
          </div>
          <div id="text" class="text-display" tabindex="0">
            <div id="chapter-reader" class="chapter-reader" role="region" aria-label="Chapter reader; highlighted verses are typeable"></div>
          </div>
          <div class="typed-area">
            <div id="typed-bar" class="typed-bar" aria-hidden="true"></div>
            <input id="input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Type the passage here">
            <div id="recall-prompt" class="recall-prompt is-hidden" role="status">
              <span>Need a nudge?</span> Press <kbd>Ctrl</kbd> + <kbd>H</kbd> to reveal the next word.
            </div>
          </div>
          <div class="typing-footer">
            <span>Click the passage or start typing</span>
            <div>
              <button id="favorite-passage" class="text-btn is-hidden" type="button" aria-pressed="false">☆ Favorite</button>
              <button id="hint-button" class="hint-button" type="button" disabled>Reveal word</button>
              <button id="restart" class="text-btn">↻ Restart</button>
            </div>
          </div>
          ${developerControls}
        </article>
      </section>
      <select id="game-mode" class="is-hidden" aria-hidden="true">
        <option value="practice">Practice — relaxed</option>
        <option value="memory">Practice — text recall</option>
        <option value="defense">Arcade — repel the shadows</option>
      </select>
    </div>`;
}
