import { menuNavigationMarkup } from '../../ui/menu-navigation.ts';
import { ACTION_LABELS, COSTS, MIN_TIER, ROLE_LABELS } from '../domain/rules.ts';
import { UPGRADE_OPTIONS } from '../domain/technology.ts';
import { ROLES, type Action, type Role, type UpgradeTarget } from '../domain/types.ts';

export const PLAYER_IDS = ['you', 'bot-1', 'bot-2', 'bot-3'] as const;
function tile(action: Action, label = ACTION_LABELS[action], tier?: number): string {
  return `<button type="button" class="stronghold-build-tile" data-action="${action}"${tier ? ` data-tier="${tier}"` : ''} data-min-tier="${tier ?? MIN_TIER[action]}">
    ${label}${action === 'resources' ? '' : `<small>${COSTS[action] * (tier ?? 1)}<span class="sr-only"> supplies</span></small>`}</button>`;
}
function upgrade(target: UpgradeTarget): string {
  const option = UPGRADE_OPTIONS[target];
  return `<button type="button" class="stronghold-upgrade-tile" data-action="upgrade" data-stronghold-upgrade="${target}" data-min-tier="${option.tier}" title="Upgrade ${option.label}">
    Upgrade ${option.cost}<span class="sr-only"> supplies: ${option.label}</span><small data-upgrade-level="${target}">Level 0</small></button>`;
}
function roleActions(role: Role): string {
  if (role === 'economy') return `<div class="stronghold-build-row">${tile('resources', 'Supplies')}${tile('worker', 'Gatherer')}${tile('relay', 'Relay')}</div>${upgrade('economy')}`;
  if (role === 'production') return `<div class="stronghold-build-row">${[1, 2, 3].map(tier => tile('barracks', `Barracks<br>Tier ${tier}`, tier)).join('')}</div>
    <div class="stronghold-build-row">${tile('warrior', 'Warrior')}${tile('archer', 'Archer')}${tile('catapult', 'Catapult')}</div>
    <div class="stronghold-build-row">${upgrade('warrior')}${upgrade('archer')}${upgrade('catapult')}</div>`;
  if (role === 'defenses') return `<div class="stronghold-build-row">${tile('builder', 'Builder')}${tile('wall', 'Wall')}</div>
    <div class="stronghold-build-row">${[1, 2, 3].map(tier => tile('tower', `Tower<br>Tier ${tier}`, tier)).join('')}</div>
    <div class="stronghold-build-row">${upgrade('tower-1')}${upgrade('tower-2')}${upgrade('tower-3')}</div>`;
  return '<p class="stronghold-army-help">Select troops, then click to move.</p>';
}
function playerCard(id: string, index: number): string {
  return `<section class="stronghold-player" data-player="${id}">
    <div class="stronghold-phrase-slot" id="stronghold-phrase-slot-${id}"></div>
    <div class="stronghold-player-frame">
      <header><h3>Player ${index + 1}</h3><label class="sr-only" for="stronghold-role-${id}">Player ${index + 1} role</label>
      <select id="stronghold-role-${id}" class="stronghold-role-select" data-player="${id}">${ROLES.map(role => `<option value="${role}">${ROLE_LABELS[role]}</option>`).join('')}</select></header>
      <small id="stronghold-name-${id}" class="sr-only"></small>
      <div class="stronghold-player-progress"><div id="stronghold-progress-${id}"></div></div>
      <div class="stronghold-player-actions" id="stronghold-player-actions-${id}">${ROLES.map(role => `<div class="stronghold-actions" data-role="${role}">${roleActions(role)}</div>`).join('')}</div>
      <p id="stronghold-task-${id}" class="stronghold-player-task"></p>
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
      </nav>
      <button id="stronghold-ready" class="stronghold-tier" type="button"><span id="stronghold-tier-label">Tier 0</span><strong id="stronghold-tier-action">Tier Up</strong></button>
      <aside class="stronghold-hud" aria-label="Kingdom status">
        <div class="stronghold-populations">
          <span title="Towers"><span class="sr-only">Towers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--tower"></i><b id="stronghold-tower-count">0/8</b></span>
          <span title="Warriors"><span class="sr-only">Warriors: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--warrior"></i><b id="stronghold-warrior-count">2/18</b></span>
          <span title="Builders"><span class="sr-only">Builders: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--builder"></i><b id="stronghold-builder-count">1/4</b></span>
          <span title="Gatherers"><span class="sr-only">Gatherers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--worker"></i><b id="stronghold-worker-count">2/12</b></span>
          <span title="Shared supplies"><span class="sr-only">Supplies: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--resource"></i><b id="stronghold-resources">100</b></span>
        </div>
        <div class="stronghold-watch"><span>Castle <b id="stronghold-castle"></b></span><span>Enemy <b id="stronghold-enemy"></b></span><span id="stronghold-wave"></span><span id="stronghold-event"></span></div>
      </aside>
      <details class="stronghold-guide"><summary>Help</summary>
        <div class="stronghold-legend"><span>Dark red: enemies</span><span>□ Warrior</span><span>◇ Archer</span><span>▲ Catapult</span><span>△ Builder</span><span>○ Gatherer</span></div>
        <p>Type phrases for supplies and units. Finish a building's phrases, then click the map to place it. Builders construct and repair automatically.</p>
        <p>Connect blue resource nodes to the castle with relays within 155 map units. Purple nodes yield twice as much. Broken connections stop deliveries.</p>
        <p>Select troops, then click to move. Shift-click adds troops. Change your role with Player 1's dropdown.</p>
        <p>Tier Up requires three phrases from each player. Barracks train their tier's units automatically. Destroy the enemy base to win.</p>
      </details>
      <p id="stronghold-feedback" class="stronghold-feedback" role="status" aria-live="polite"></p>
      <div class="stronghold-squad">${PLAYER_IDS.map(playerCard).join('')}</div>
      <section id="stronghold-typing" class="stronghold-typing">
        <div class="stronghold-typing-heading"><small id="stronghold-typing-label">Your phrase to type</small><span id="stronghold-typing-stats"></span></div>
        <div id="stronghold-phrase" class="text-display" tabindex="0" aria-label="Your private phrase to type"></div>
        <div class="progress-track"><div id="stronghold-typing-progress"></div></div>
      </section>
      <div id="stronghold-typed-area" class="typed-area stronghold-typed-area">
        <label class="sr-only" for="stronghold-input">Type your Stronghold phrase exactly</label>
        <div id="stronghold-typed-bar" class="typed-bar" aria-hidden="true"></div><input id="stronghold-input" class="typing-input" autocomplete="off" autocapitalize="off" spellcheck="false">
      </div>
      <section id="stronghold-army-orders" class="stronghold-army-orders is-hidden">
        <button id="stronghold-select-army" type="button">Select all troops</button><button id="stronghold-defend" type="button">Defend</button><button id="stronghold-assault" type="button">Assault base</button>
        <details><summary>Coordinate orders</summary><label>X<input id="stronghold-order-x" type="number" min="20" max="980" value="500"></label><label>Y<input id="stronghold-order-y" type="number" min="20" max="630" value="450"></label>
          <button id="stronghold-order" type="button">Move selected</button><button id="stronghold-rally" type="button">Set rally</button></details><p id="stronghold-selection"></p>
      </section>
      <div id="stronghold-placement" class="stronghold-placement is-hidden"><span>Click to build, or enter coordinates:</span><label>X<input id="stronghold-build-x" type="number" min="20" max="980" value="500"></label><label>Y<input id="stronghold-build-y" type="number" min="130" max="630" value="400"></label><button id="stronghold-build" type="button">Build</button></div>
    </div>
    <dialog id="stronghold-tier-dialog" class="stronghold-tier-dialog">
      <div id="stronghold-tier-typing-slot"></div>
      <div class="stronghold-tier-status"><h2 id="stronghold-tier-title">Tier Up</h2><p id="stronghold-tier-description"></p><button id="stronghold-tier-pause" type="button">Pause challenge</button></div>
      <div id="stronghold-tier-contributions" class="stronghold-tier-contributions"></div>
    </dialog>
  </section>`;
}
