import { menuNavigationMarkup } from '../../ui/menu-navigation.ts';
import { ACTION_LABELS, COSTS, MIN_TIER, ROLE_ACTIONS, ROLE_LABELS } from '../domain/rules.ts';
import { ROLES } from '../domain/types.ts';

export function strongholdWorkspaceMarkup(): string {
  return `<section id="stronghold-screen" class="app-page stronghold-screen is-hidden">
    ${menuNavigationMarkup()}
    <header class="stronghold-heading">
      <div><small>COOPERATIVE TYPING / LOCAL SQUAD</small><h2>Stronghold</h2><p>Build together. Hold the line. Take their stronghold.</p></div>
      <div class="stronghold-controls"><button id="stronghold-pause" class="secondary-btn" type="button">Pause</button><button id="stronghold-restart" class="text-btn" type="button">New stronghold</button></div>
    </header>
    <div class="stronghold-hud surface">
      <div><small>SHARED SUPPLIES</small><strong id="stronghold-resources">100</strong></div>
      <div><small>CASTLE</small><strong id="stronghold-castle">1000 / 1000</strong></div>
      <div><small>NEXT WAVE</small><strong id="stronghold-wave">30s</strong></div>
      <div><small>WORLD EVENT</small><strong id="stronghold-event">Scripture watch</strong></div>
      <button id="stronghold-ready" class="stronghold-tier" type="button">Tier 0 / Ready up</button>
    </div>
    <div class="stronghold-battlefield">
      <svg id="stronghold-map" viewBox="0 0 1000 650" role="img" aria-label="Stronghold battlefield. Use Army control to select troops and issue orders, or complete a building phrase then choose a location." tabindex="0"></svg>
      <div class="stronghold-map-label"><span>YOUR KINGDOM</span><small>Enemy stronghold to the north</small></div>
      <div id="stronghold-outcome" class="stronghold-outcome is-hidden"><h3 id="stronghold-outcome-title"></h3><p id="stronghold-outcome-copy"></p><button id="stronghold-play-again" class="primary-btn" type="button">Build again</button></div>
      <div class="stronghold-legend"><span class="legend-workers">o Gatherer</span><span class="legend-builders">△ Builder</span><span class="legend-warriors">□ Warrior</span><span>◇ Archer</span><span>▲ Catapult</span><span class="legend-invaders">✦ Invader</span><span>Blue lines: relay network</span></div>
    </div>
    <p id="stronghold-feedback" class="stronghold-feedback" role="status" aria-live="polite"></p>
    <div class="stronghold-squad">${ROLES.map((role, index) => `
      <section class="stronghold-player" data-role="${role}">
        <header><div><small id="stronghold-name-${role}">PLAYER ${index + 1}</small><h3>${ROLE_LABELS[role]}</h3></div><button class="text-btn stronghold-take-role" data-role="${role}" type="button">Take role</button></header>
        <div class="stronghold-player-progress"><div id="stronghold-progress-${role}"></div></div>
        <p id="stronghold-task-${role}" class="stronghold-player-task"></p>
        <p id="stronghold-typed-${role}" class="stronghold-peer-typed"></p>
        <div id="stronghold-actions-${role}" class="stronghold-actions">${ROLE_ACTIONS[role].map(action => `<button data-action="${action}" type="button" title="${ACTION_LABELS[action]} / ${COSTS[action]} supplies / tier ${MIN_TIER[action]}">${ACTION_LABELS[action]}<small>${COSTS[action] ? COSTS[action] + ' supplies' : 'Earn supplies'}${MIN_TIER[action] ? ' / T' + MIN_TIER[action] : ''}</small></button>`).join('')}</div>
      </section>`).join('')}</div>
    <section id="stronghold-typing" class="stronghold-typing surface">
      <div class="stronghold-typing-heading"><small id="stronghold-typing-label">YOUR PHRASE</small><span id="stronghold-typing-stats"></span></div>
      <div id="stronghold-phrase" class="text-display" tabindex="0" aria-label="Your phrase to type"></div>
      <div class="progress-track"><div id="stronghold-typing-progress"></div></div>
      <label class="sr-only" for="stronghold-input">Type your Stronghold phrase exactly</label>
      <div class="typed-area"><div id="stronghold-typed-bar" class="typed-bar" aria-hidden="true"></div><input id="stronghold-input" class="typing-input" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    </section>
    <section id="stronghold-army-orders" class="stronghold-army-orders surface is-hidden">
      <div><h3>Command the army</h3><p>Click a troop to select it; Shift-click adds troops. Click the field to move and attack nearby enemies.</p></div>
      <button id="stronghold-select-army" class="secondary-btn" type="button">Select all troops</button>
      <button id="stronghold-defend" class="secondary-btn" type="button">Defend castle</button>
      <button id="stronghold-assault" class="primary-btn" type="button">Assault enemy base</button>
      <label>Map order X<input id="stronghold-order-x" type="number" min="20" max="980" value="500"></label>
      <label>Y<input id="stronghold-order-y" type="number" min="20" max="630" value="450"></label>
      <button id="stronghold-order" class="secondary-btn" type="button">Move selected</button>
      <button id="stronghold-rally" class="text-btn" type="button">Set production rally</button>
      <p id="stronghold-selection"></p>
    </section>
    <div id="stronghold-placement" class="stronghold-placement is-hidden"><label>Build X<input id="stronghold-build-x" type="number" min="20" max="980" value="500"></label><label>Y<input id="stronghold-build-y" type="number" min="130" max="630" value="400"></label><button id="stronghold-build" class="primary-btn" type="button">Place building</button><p>Click the map or enter a location. Builders move to the site and construct it.</p></div>
    <details class="stronghold-guide surface"><summary>How your squad holds the line</summary>
      <p><b>Economy:</b> type for supplies, recruit autonomous gatherers, and connect resource nodes to the castle with relays (155 map units apart). Rich purple nodes yield twice as much but are exposed. Chunks stop if their relay route is destroyed.</p>
      <p><b>Army production:</b> unlock barracks and warriors at tier 1, archers at tier 2, and catapults at tier 3. Barracks continuously train units using shared supplies. New barracks produce the highest unit allowed by their construction tier.</p>
      <p><b>Army control:</b> no typing outside tier-up. Select your army and defend workers, or lead a push north. Units fight automatically; towers and the enemy base become stronger over time.</p>
      <p><b>Defenses:</b> recruit builders, type a construction phrase, then place walls or towers. Builders construct one project each and repair damaged buildings automatically. Walls intercept nearby invaders.</p>
      <p><b>Tier up:</b> ready up and your simulated teammates will lock in. The battle pauses while everyone completes three private phrases; teammate typed text and contributions remain visible. Higher tiers use fewer, longer words.</p>
      <p>Switch freely between roles; a teammate takes your previous role. World events introduce left-hand, vowel, number, symbol, and code drills. The match pauses when you leave Stronghold or hide the tab. Local simulation only: no room codes or online players yet.</p>
    </details>
    <dialog id="stronghold-tier-dialog" class="stronghold-tier-dialog">
      <small>EVERY VOICE COUNTS</small><h2 id="stronghold-tier-title">Advance together</h2><p>The battlefield is paused. Each player must finish three phrases.</p>
      <div id="stronghold-tier-contributions" class="stronghold-tier-contributions"></div>
      <div id="stronghold-tier-typing-slot"></div>
      <button id="stronghold-tier-pause" class="text-btn" type="button">Pause challenge</button>
    </dialog>
  </section>`;
}
