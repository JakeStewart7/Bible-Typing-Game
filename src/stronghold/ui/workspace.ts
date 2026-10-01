import { menuNavigationMarkup } from '../../ui/menu-navigation.ts';
import { ACTION_LABELS, COSTS, LENGTH_LABELS, MIN_TIER, ROLE_LABELS } from '../domain/rules.ts';
import { UPGRADE_OPTIONS } from '../domain/technology.ts';
import { PHRASE_LENGTHS, ROLES, type Action, type Role, type UpgradeTarget } from '../domain/types.ts';
import { taskShortcut } from './keyboard.ts';

export const PLAYER_IDS = ['you', 'bot-1', 'bot-2', 'bot-3'] as const;
function tile(action: Action, label: string, tier: number | undefined, shortcut: string): string {
  return `<button type="button" class="stronghold-build-tile" data-action="${action}"${tier ? ` data-tier="${tier}"` : ''} data-min-tier="${tier ?? MIN_TIER[action]}" data-shortcut="${shortcut}" aria-keyshortcuts="Alt+${shortcut}">
    <kbd class="stronghold-hotkey">Alt+${shortcut}</kbd><span class="stronghold-action-label">${label}</span>${action === 'resources' ? '' : `<span class="stronghold-cost">${COSTS[action] === 0 ? 'Free' : `${COSTS[action] * (tier ?? 1)}<span class="sr-only"> supplies</span>`}</span>`}</button>`;
}
function upgrade(target: UpgradeTarget, shortcut: string): string {
  const option = UPGRADE_OPTIONS[target];
  return `<button type="button" class="stronghold-upgrade-tile" data-action="upgrade" data-stronghold-upgrade="${target}" data-min-tier="${option.tier}" title="Upgrade ${option.label}" data-shortcut="${shortcut}" aria-keyshortcuts="Alt+${shortcut}">
    <kbd class="stronghold-hotkey">Alt+${shortcut}</kbd><span class="stronghold-action-label">Upgrade<span class="sr-only"> ${option.label}</span></span><span class="stronghold-cost">${option.cost}<span class="sr-only"> supplies</span></span><small data-upgrade-level="${target}">Level 0</small></button>`;
}
function roleActions(role: Role): string {
  let index = 0;
  const task = (action: Action, label = ACTION_LABELS[action], tier?: number) => tile(action, label, tier, taskShortcut(index++));
  const improvement = (target: UpgradeTarget) => upgrade(target, taskShortcut(index++));
  if (role === 'economy') return `<div class="stronghold-build-row">${task('resources', 'Supplies')}${task('worker', 'Gatherer')}${task('relay', 'Relay')}</div>${improvement('economy')}`;
  if (role === 'production') return `<div class="stronghold-build-row">${[1, 2, 3].map(tier => task('barracks', `Barracks<br>Tier ${tier}`, tier)).join('')}</div>
    <div class="stronghold-build-row">${task('resources', 'Supplies')}${task('warrior', 'Warrior')}${task('archer', 'Archer')}${task('catapult', 'Catapult')}</div>
    <div class="stronghold-build-row">${improvement('warrior')}${improvement('archer')}${improvement('catapult')}</div>`;
  if (role === 'defenses') return `<div class="stronghold-build-row">${task('builder', 'Builder')}${task('wall', 'Wall')}</div>
    <div class="stronghold-build-row">${[1, 2, 3].map(tier => task('tower', `Tower<br>Tier ${tier}`, tier)).join('')}</div>
    <div class="stronghold-build-row">${improvement('tower-1')}${improvement('tower-2')}${improvement('tower-3')}</div>`;
  return `${task('resources', 'Supplies')}<p class="stronghold-army-help">Drag to select troops, then click to move. Shift adds to your selection.</p>`;
}
function playerCard(id: string, index: number): string {
  return `<section class="stronghold-player" data-player="${id}">
    <div class="stronghold-player-frame">
      <header><h3>Player ${index + 1}</h3><label class="sr-only" for="stronghold-role-${id}">Player ${index + 1} role</label>
      <select id="stronghold-role-${id}" class="stronghold-role-select" data-player="${id}">${ROLES.map(role => `<option value="${role}">${ROLE_LABELS[role]}</option>`).join('')}</select></header>
      <small id="stronghold-name-${id}" class="sr-only"></small>
      <div class="stronghold-player-progress" role="progressbar" aria-label="Player ${index + 1} completed task work" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="stronghold-work-track"><div id="stronghold-progress-${id}"></div></div></div>
      <div class="stronghold-player-actions" id="stronghold-player-actions-${id}">${ROLES.map(role => `<div class="stronghold-actions" data-role="${role}">${roleActions(role)}</div>`).join('')}</div>
      <div id="stronghold-typed-slot-${id}" class="stronghold-typed-slot"><p id="stronghold-typed-${id}" class="stronghold-peer-typed"></p></div>
    </div>
  </section>`;
}
export function strongholdWorkspaceMarkup(): string {
  return `<section id="stronghold-screen" class="app-page stronghold-screen is-hidden">
    <div class="stronghold-stage">
      <div class="stronghold-battlefield">
        <svg id="stronghold-map" viewBox="0 0 1000 650" role="img" aria-label="Stronghold battlefield: select troops to issue army orders, or complete a construction task and click to place it." tabindex="0"></svg>
        <div id="stronghold-outcome" class="stronghold-outcome is-hidden"><h3 id="stronghold-outcome-title"></h3><p id="stronghold-outcome-copy"></p><button id="stronghold-play-again" class="primary-btn" type="button">Build again</button></div>
      </div>
      <nav class="stronghold-map-toolbar" aria-label="Stronghold controls">${menuNavigationMarkup()}
        <button id="stronghold-pause" type="button">Pause</button><button id="stronghold-restart" type="button">New game</button>
        <button id="stronghold-computers" type="button" aria-pressed="false">Stop computers</button>
      </nav>
      <div class="stronghold-map-camera" role="group" aria-label="Map zoom and navigation">
        <button id="stronghold-zoom-out" type="button" aria-label="Zoom out">-</button>
        <output id="stronghold-zoom">120%</output>
        <button id="stronghold-zoom-in" type="button" aria-label="Zoom in">+</button>
        <button id="stronghold-zoom-fit" type="button">Fit map</button>
        <span>Alt-drag or middle-drag to pan</span>
      </div>
      <button id="stronghold-ready" class="stronghold-tier" type="button"><span id="stronghold-tier-label">Tier 0</span><strong id="stronghold-tier-action">Tier Up</strong></button>
      <aside class="stronghold-hud" aria-label="Kingdom status">
        <div class="stronghold-populations">
          <span title="Towers"><span class="sr-only">Towers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--tower"></i><b id="stronghold-tower-count">0/8</b></span>
          <span title="Warriors"><span class="sr-only">Warriors: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--warrior"></i><b id="stronghold-warrior-count">2/18</b></span>
          <span title="Builders"><span class="sr-only">Builders: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--builder"></i><b id="stronghold-builder-count">1/4</b></span>
          <span title="Gatherers"><span class="sr-only">Gatherers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--worker"></i><b id="stronghold-worker-count">2/12</b></span>
          <span title="Shared supplies"><span class="sr-only">Supplies: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--resource"></i><b id="stronghold-resources">50</b></span>
        </div>
        <div class="stronghold-watch"><span>Castle <b id="stronghold-castle"></b></span><span>Enemy <b id="stronghold-enemy"></b></span><span id="stronghold-wave"></span></div>
      </aside>
      <details class="stronghold-guide"><summary>Help</summary>
        <div class="stronghold-legend"><span>Dark red: enemies</span><span>□ Warrior</span><span>◇ Archer</span><span>▲ Catapult</span><span>△ Builder</span><span>○ Gatherer</span></div>
        <p>Each completed entry adds work to your shared role bar. Fill it for supplies, free gatherers, units, upgrades or construction. Short uses tiny words, Medium long words, Long short phrases, and Extra Long full sentences; longer entries add more work.</p>
        <p>Relays need no typing: select Relay and click the map to place its shadow. Other buildings need a full work bar first. Escape cancels placement. Builders construct and repair automatically.</p>
        <p>Gatherers strike resource nodes and carry yellow supply chunks to the nearest relay or castle. Relays forward supplies through links within 155 map units. Purple nodes yield twice as much. Broken connections stop relay deliveries.</p>
        <p>In Unit Control, drag or click to select troops, then click to move. Shift adds troops. Join a role with Player 1's dropdown; everyone on that role shares the selected task and completed work.</p>
        <p>The Army teammate earns supplies at Tier 0, builds a barracks after Tier 1 unlocks, then trains troops. Unit Control can type for supplies while issuing orders.</p>
        <p>Each task keeps its completed work when you switch tasks or roles. Building tiers and upgrade types keep separate progress. Dev options sets the defaults for new matches.</p>
        <p>Use Left/Down for shorter text, Right/Up for longer text, or click the faded length options. Shift+arrows still selects typed text. Alt+number chooses the matching option in your current role; Alt+0 is the tenth option.</p>
        <p>The map starts zoomed toward the home base. Use +/- and Fit map to zoom, and Alt-drag or middle-drag to pan. Shift-drag still adds troops to your selection.</p>
        <p>Stop computers pauses simulated teammates and their barracks, not the battlefield. Resume them to finish a shared tier challenge.</p>
        <p>World events begin at 1, 3, 5 and subsequent odd minutes of battle time, last 35 seconds, and leave normal typing between events.</p>
        <p>Tier Up requires three phrases from each player. Barracks train their tier's units automatically. Destroy the enemy base to win.</p>
      </details>
      <details id="stronghold-dev-options" class="stronghold-dev-options">
        <summary>Dev options</summary>
        <form id="stronghold-dev-form" class="stronghold-dev-panel">
          <h3>New match defaults</h3>
          <label>Computers start
            <select id="stronghold-dev-computers"><option value="started">Started</option><option value="stopped">Stopped</option></select>
          </label>
          <label>Default text length
            <select id="stronghold-dev-length">${PHRASE_LENGTHS.map(length => `<option value="${length}">${LENGTH_LABELS[length]}</option>`).join('')}</select>
          </label>
          <label>Starting supplies <input id="stronghold-dev-resources" type="number" min="0" max="10000" step="1" required></label>
          <label>Starting map zoom <input id="stronghold-dev-zoom" type="number" min="1" max="2" step="0.1" required></label>
          <p>Saved on this device. Applying starts a new match; New game uses these defaults.</p>
          <button type="submit">Apply &amp; new game</button>
        </form>
      </details>
      <p id="stronghold-feedback" class="stronghold-feedback" role="status" aria-live="polite"></p>
      <aside class="stronghold-event-panel" aria-label="World event and history">
        <div id="stronghold-world-event" class="stronghold-world-event is-hidden" aria-live="polite"><strong id="stronghold-event"></strong><span id="stronghold-event-time"></span></div>
        <div id="stronghold-event-log" class="stronghold-event-log" role="log" aria-label="Stronghold events" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
      </aside>
      <div class="stronghold-squad">${PLAYER_IDS.map(playerCard).join('')}</div>
      <div id="stronghold-private-slot">
        <section id="stronghold-private" class="stronghold-private" aria-label="Your private typing area">
          <div class="stronghold-length-panel"><span id="stronghold-length-label">Length &#8593;/&#8595;</span>
            <div id="stronghold-length" class="stronghold-length-wheel" role="listbox" aria-labelledby="stronghold-length-label" aria-activedescendant="stronghold-length-medium" tabindex="0">
              ${PHRASE_LENGTHS.map(length => `<button id="stronghold-length-${length}" type="button" role="option" data-length="${length}" value="${length}" aria-selected="${length === 'medium'}" tabindex="-1">${LENGTH_LABELS[length]}</button>`).join('')}
            </div>
          </div>
          <section id="stronghold-typing" class="stronghold-typing">
            <div id="stronghold-phrase" class="text-display" tabindex="0" aria-label="Your private text to type"></div>
            <div class="progress-track is-hidden" aria-hidden="true"><div id="stronghold-typing-progress"></div></div>
          </section>
          <div id="stronghold-typed-area" class="typed-area stronghold-typed-area">
            <label class="sr-only" for="stronghold-input">Type your Stronghold text exactly</label>
            <div id="stronghold-typed-bar" class="typed-bar" aria-hidden="true"></div><input id="stronghold-input" class="typing-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type here">
          </div>
        </section>
      </div>
      <section id="stronghold-army-orders" class="stronghold-army-orders is-hidden">
        <button id="stronghold-select-army" type="button" data-shortcut="2" aria-keyshortcuts="Alt+2"><kbd class="stronghold-hotkey">Alt+2</kbd>Select all troops</button><button id="stronghold-defend" type="button" data-shortcut="3" aria-keyshortcuts="Alt+3"><kbd class="stronghold-hotkey">Alt+3</kbd>Defend</button><button id="stronghold-assault" type="button" data-shortcut="4" aria-keyshortcuts="Alt+4"><kbd class="stronghold-hotkey">Alt+4</kbd>Assault base</button>
        <button id="stronghold-rally" type="button" data-shortcut="5" aria-keyshortcuts="Alt+5"><kbd class="stronghold-hotkey">Alt+5</kbd>Set rally on map</button><p id="stronghold-selection"></p>
      </section>
      <div id="stronghold-placement" class="stronghold-placement is-hidden"><span>Click the map to place the shadow.</span><button id="stronghold-cancel-placement" type="button">Cancel</button></div>
    </div>
    <dialog id="stronghold-tier-dialog" class="stronghold-tier-dialog">
      <div id="stronghold-tier-typing-slot"></div>
      <div class="stronghold-tier-status"><h2 id="stronghold-tier-title">Tier Up</h2><p id="stronghold-tier-description"></p><button id="stronghold-tier-pause" type="button">Pause challenge</button><button id="stronghold-tier-computers" type="button" aria-pressed="false">Stop computers</button></div>
      <div id="stronghold-tier-contributions" class="stronghold-tier-contributions"></div>
    </dialog>
  </section>`;
}
