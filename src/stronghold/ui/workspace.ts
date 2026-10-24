import { menuNavigationMarkup } from '../../ui/menu-navigation.ts';
import { ACTION_LABELS, COSTS, isTypingAction, LENGTH_LABELS, MIN_TIER, ROLE_LABELS, TEXT_LENGTH_BONUSES } from '../domain/rules.ts';
import { UPGRADE_OPTIONS } from '../domain/technology.ts';
import { PHRASE_LENGTHS, PLAYER_COLORS, ROLES, SEASONS, STARTING_ENTITIES, type Action, type Role, type UpgradeTarget } from '../domain/types.ts';
import { STARTING_LIMITS } from '../domain/options.ts';
import { SEASON_LABELS } from '../domain/environment.ts';
import { taskShortcut } from './keyboard.ts';
import { weatherMarkup } from './environment.ts';
import { creditsMarkup } from './credits.ts';
import { isArmyUnit } from '../domain/training.ts';
import { UNIT_CONTROL_ICON } from './player-theme.ts';

export const PLAYER_IDS = ['you', 'bot-1', 'bot-2', 'bot-3'] as const;
const ROLE_ICONS: Record<Exclude<Role, 'economy'>, string> = {
  production: '<path d="M7 15L17 3L22 2L21 7L11 19Z"/><path d="M4 13L13 22M4 22L8 18"/>',
  army: UNIT_CONTROL_ICON,
  defenses: '<path d="M3 21V5h4v4h3V3h4v6h3V5h4v16ZM10 21v-6h4v6"/>'
};
const LOCK_ICON = '<svg class="stronghold-lock is-hidden" data-tier-lock viewBox="0 0 16 18" aria-hidden="true"><path d="M4 8V5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2" y="7" width="12" height="10" rx="1" fill="currentColor"/></svg>';
function costMarkup(value: number, id?: string): string {
  return `<span class="stronghold-cost"${id ? ` id="${id}"` : ''}><i class="stronghold-symbol stronghold-symbol--resource" aria-hidden="true"></i><span${id ? ' id="stronghold-tier-price"' : ''}>${value}</span><span class="sr-only"> supplies</span></span>`;
}
function orderButton(id: string, label: string, shortcut: number, icon: string): string {
  return `<button id="stronghold-${id}" type="button" data-shortcut="${shortcut}" aria-keyshortcuts="Alt+${shortcut}" data-tooltip="${label} (Alt+${shortcut})"${id === 'rally' ? ' aria-pressed="false"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${icon}</svg><span>${label}</span><kbd aria-hidden="true">${shortcut}</kbd></button>`;
}
function tile(action: Action, label: string, tier: number | undefined, shortcut: string): string {
  return `<button type="button" class="stronghold-build-tile${COSTS[action] > 0 ? ' has-cost' : ''}" data-action="${action}"${tier ? ` data-tier="${tier}"` : ''} data-min-tier="${tier ?? MIN_TIER[action]}" data-shortcut="${shortcut}" aria-keyshortcuts="Alt+${shortcut}">
    ${LOCK_ICON}<span class="stronghold-action-label">${label}</span>${COSTS[action] > 0 ? costMarkup(COSTS[action] * (tier ?? 1)) : ''}${action === 'worker' || action === 'builder' || isArmyUnit(action) ? '<small data-unit-population></small>' : ''}${isArmyUnit(action) ? '<small data-training-queued>0 queued</small>' : ''}${isTypingAction(action) ? `<span class="stronghold-task-progress" data-task-progress role="progressbar" aria-label="${ACTION_LABELS[action]}${tier ? ` tier ${tier}` : ''} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-task-fill></span></span>` : ''}</button>`;
}
function upgrade(target: UpgradeTarget, shortcut: string): string {
  const option = UPGRADE_OPTIONS[target];
  return `<button type="button" class="stronghold-upgrade-tile has-cost" data-action="upgrade" data-stronghold-upgrade="${target}" data-min-tier="${option.tier}" data-shortcut="${shortcut}" aria-keyshortcuts="Alt+${shortcut}">
    ${LOCK_ICON}<span class="stronghold-action-label">Upgrade <span class="stronghold-upgrade-kind">${option.label}</span></span>${costMarkup(option.cost)}<small data-upgrade-level="${target}">Level 0</small></button>`;
}
function roleActions(role: Role): string {
  let index = 0;
  const task = (action: Action, label = ACTION_LABELS[action], tier?: number) => tile(action, label, tier, taskShortcut(index++));
  const improvement = (target: UpgradeTarget) => upgrade(target, taskShortcut(index++));
  if (role === 'economy') return `<div class="stronghold-build-row">${task('worker', 'Gatherer')}${task('resources', 'Supplies')}</div>
    <div class="stronghold-build-row">${task('relay', 'Relay')}</div>
    <div class="stronghold-build-row">${improvement('economy')}</div>`;
  if (role === 'production') return `<div class="stronghold-build-row">${[1, 2, 3].map(tier => task('barracks', `Barracks T${tier}`, tier)).join('')}</div>
    <div class="stronghold-build-row">${task('warrior', 'Warrior')}${task('archer', 'Archer')}${task('catapult', 'Catapult')}</div>
    <div class="stronghold-build-row">${improvement('warrior')}${improvement('archer')}${improvement('catapult')}</div>`;
  if (role === 'defenses') return `<div class="stronghold-build-row">${task('builder', 'Builder')}${task('wall', 'Wall')}</div>
    <div class="stronghold-build-row">${[1, 2, 3].map(tier => task('tower', `Tower T${tier}`, tier)).join('')}</div>
    <div class="stronghold-build-row">${improvement('tower-1')}${improvement('tower-2')}${improvement('tower-3')}</div>`;
  return '<p class="stronghold-army-help"><strong>Typing produces shared supplies.</strong><br>Click or drag to select. Right-click to move. Shift adds units.</p>';
}
function playerCard(id: string, index: number): string {
  return `<section class="stronghold-player" data-player="${id}">
    <div class="stronghold-player-frame">
      <header><h3>Player ${index + 1}</h3>
      <div class="stronghold-role-buttons" role="group" aria-label="Player ${index + 1} role">${ROLES.map(role => `<button id="stronghold-role-${id}-${role}" type="button" data-role-button="${role}" aria-label="${ROLE_LABELS[role]}" aria-pressed="false" data-tooltip="${ROLE_LABELS[role]}">${role === 'economy' ? '<i class="stronghold-symbol stronghold-symbol--resource" aria-hidden="true"></i>' : `<svg viewBox="0 0 24 ${role === 'army' ? 30 : 24}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${ROLE_ICONS[role]}</svg>`}</button>`).join('')}</div></header>
      <small id="stronghold-name-${id}" class="sr-only"></small>
      <div class="stronghold-player-progress" role="progressbar" aria-label="Player ${index + 1} selected task progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="stronghold-work-track"><div id="stronghold-progress-${id}"></div></div><span id="stronghold-progress-label-${id}" class="stronghold-progress-label">0%</span></div>
      <div class="stronghold-player-actions" id="stronghold-player-actions-${id}">${ROLES.map(role => `<div class="stronghold-actions" data-role="${role}">${roleActions(role)}</div>`).join('')}</div>
      <div id="stronghold-typed-slot-${id}" class="stronghold-typed-slot"><p id="stronghold-typed-${id}" class="stronghold-peer-typed"></p></div>
    </div>
  </section>`;
}
export function strongholdWorkspaceMarkup(): string {
  return `<section id="stronghold-screen" class="app-page stronghold-screen is-hidden">
    <div class="stronghold-stage">
      ${weatherMarkup()}
      <div class="stronghold-battlefield">
        <svg id="stronghold-map" viewBox="0 0 1000 650" role="img" aria-label="Stronghold battlefield: left-click or drag to select friendly units, right-click to move, or left-click to place a prepared building." tabindex="0"></svg>
        <div id="stronghold-outcome" class="stronghold-outcome is-hidden"><h3 id="stronghold-outcome-title"></h3><p id="stronghold-outcome-copy"></p><button id="stronghold-play-again" class="primary-btn" type="button">Build again</button></div>
      </div>
      <header class="stronghold-command-bar" aria-label="Kingdom command bar">
      <nav class="stronghold-map-toolbar" aria-label="Stronghold controls">${menuNavigationMarkup()}
        <button id="stronghold-pause" type="button">Pause</button><button id="stronghold-restart" type="button">New game</button>
        <button id="stronghold-computers" type="button" aria-pressed="false">Stop computers</button>
      </nav>
      <div class="stronghold-tier-mount"><button id="stronghold-ready" class="stronghold-tier" type="button"><span id="stronghold-tier-label">Tier 0</span><strong id="stronghold-tier-action">Tier Up</strong>${costMarkup(300, 'stronghold-tier-cost')}</button></div>
      <aside class="stronghold-hud" aria-label="Kingdom status">
        <div class="stronghold-populations">
          <span class="stronghold-supplies" title="Shared supplies"><span class="sr-only">Shared supplies: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--resource"></i><b id="stronghold-resources">50</b></span>
          <span title="Towers"><span class="sr-only">Towers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--tower"></i><b id="stronghold-tower-count">0/8</b></span>
          <span title="Warriors"><span class="sr-only">Warriors: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--warrior"></i><b id="stronghold-warrior-count">2/18</b></span>
          <span title="Archers"><span class="sr-only">Archers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--archer"></i><b id="stronghold-archer-count">0/12</b></span>
          <span title="Catapults"><span class="sr-only">Catapults: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--catapult"></i><b id="stronghold-catapult-count">0/6</b></span>
          <span title="Builders"><span class="sr-only">Builders: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--builder"></i><b id="stronghold-builder-count">1/4</b></span>
          <span title="Gatherers"><span class="sr-only">Gatherers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--worker"></i><b id="stronghold-worker-count">2/12</b></span>
        </div>
      </aside>
      <div class="stronghold-utilities">
      <span class="stronghold-match-clock" title="Battle time; pauses during tier challenges"><span class="sr-only">Battle time: </span><time id="stronghold-timer" datetime="PT0S">0:00</time></span>
      <details class="stronghold-guide"><summary>Help</summary>
        <div class="stronghold-guide-content">
        <div class="stronghold-legend"><span>Dark red: enemies</span><span>□ Warrior</span><span>◇ Archer</span><span>▲ Catapult</span><span>△ Builder</span><span>○ Gatherer</span></div>
        <p>Completed characters, including spaces, advance your selected free task. Short is 1-5 characters at 1x, Medium 6-11 at 1.1x, Long 12-24 at 1.25x, and Extra Long 25-40 at 1.5x. All lengths use normal words or word groups.</p>
        <p>Relays need no typing: select Relay and click the map to place its shadow. Other buildings need a full work bar first. Escape cancels placement. Builders construct and repair automatically.</p>
        <p>Scroll while placing or selecting a wall to rotate through 16 angles, 22.5 degrees apart, without zooming. Done or Escape finishes editing. Units prefer routes around buildings, but can escape buildings placed over them or pass through when no route exists.</p>
        <p>Gatherers carry blue or purple chunks matching their resource node to the nearest relay or castle. Neutral glowing chunks travel through completed relay links. Hover a relay or castle, or place a relay, to see the 155-unit ranges of nearby completed and unfinished relays. Green previews reach the castle network; amber previews are disconnected or planned. Unfinished relays never transport supplies. Purple nodes yield twice as much. Broken connections stop relay deliveries.</p>
        <p>In Unit Control, left-click or drag to select friendly units, right-click to move, and left-click empty ground to deselect. Shift adds units. Manual move orders take priority over combat and automatic rally orders until arrival; units then resume fighting. Right-click cancels placement or rally targeting; left-click places the building or rally point. A plus badge on the cursor shows targeting mode.</p>
        <p>Gatherers and builders resume nearest work after two idle seconds at their destination. Builders and walls cost no supplies, only typing work.</p>
        <p>Supplies, Gatherers, Barracks, Builders, Walls and Towers need typing, not supplies. Each typing option has a small progress bar; select it to show its progress in the main player-colored bar. More expensive buildings fill more slowly. Excess progress from a completed entry carries into the next bar. Once construction is ready, further entries do not bank more completions. Troops, upgrades and relays cost supplies without typing.</p>
        <p>Matches normally start at Tier 0, with T1 starting units and buildings. Complete the first shared tier challenge to unlock T1 Barracks and towers. Locked tasks cannot be selected or typed for. Army types for supplies at Tier 0 and selects Barracks work when you join after unlocking T1. Fill the work bar, then click the map to place. Each player chooses tasks independently; matching tasks share work, and prepared work survives tier challenges. Unit Control can type for supplies while issuing orders.</p>
        <p>Each typing task keeps its progress when you switch tasks or roles. Building tiers keep separate progress. Dev options automatically saves defaults in this browser for new matches and refreshes.</p>
        <p>Use the resource circle, sword, hollow cursor and castle buttons, or Ctrl+Tab / Ctrl+Shift+Tab, to switch roles. Tab selects the next unlocked task; Shift+Tab selects the previous one. There is no default rally point. Select a friendly castle or barracks and right-click to set its rally. Unit Control can set a shared rally for production buildings. Towers, walls and relays never have rally points.</p>
        <p>The command bar timer shows battle time, stopping during pauses, tier challenges and the match outcome. Build again and New game reset the battlefield, timer, typing, selections and camera using your saved new-match defaults.</p>
        <p>Arrow keys pan the map. Page Up selects longer text and Page Down shorter text, or click a length option. Shift+arrows still selects typed text. Alt+number chooses the matching displayed option in your current role.</p>
        <p>The map starts zoomed toward the home base. Scroll to zoom; Alt-drag, middle-drag or arrow keys pan. Moving the pointer to a map edge does not scroll. Right-click moves units or cancels placement, never pans. Shift-drag still adds troops to your selection.</p>
        <p>Stop computers pauses simulated teammates and their barracks, not the battlefield. Resume them to finish a shared tier challenge.</p>
        <p>World events begin at 1, 3, 5 and subsequent odd minutes of battle time, last 35 seconds, and leave normal typing between events.</p>
        <p>Tier Up costs 300, 600, then 1500 shared supplies, paid once when each challenge starts. It is unavailable until the team can afford it. Complete correct phrases to fill the shared bar; partial or incorrect entries do not count. The first challenge uses letters, the next letters and numbers, and the last adds symbols and punctuation. Anyone can contribute, even with computers stopped. Pause challenge keeps your progress; Resume challenge continues it.</p>
        <p>Summer makes all friendly and enemy units 15% faster. Winter makes all units 15% slower and both gathered and typed supplies worth 20% less. Spring makes both resource sources worth 20% more. Fall adds 15% to every completed typing task, including world events and Tier Up. Bonuses apply immediately; partial phrases still add no work.</p>
        <p>Queue Warriors (60 supplies) at completed T1 Barracks, Archers (100) at T2 and Catapults (180) at T3. Supplies are paid when queued; each unit trains for 24 seconds, then stays nearby unless a rally is set. Gatherers and builders need 64 typing work; Barracks need 60 per tier and Towers 50 per tier. Units have tougher health and lower damage: melee is faster than archers, and siege is slowest. Enemies use the same formation stats. Waves grow every two waves, up to 12 invaders, with at least 65 seconds between waves. Empty barracks do not train automatically. Queues count toward population caps. Destroy the enemy base to win.</p>
        </div>
      </details>
      <details id="stronghold-dev-options" class="stronghold-dev-options">
        <summary>Dev options</summary>
        <form id="stronghold-dev-form" class="stronghold-dev-panel">
          <h3>New game</h3>
          <label>Computers
            <select id="stronghold-dev-computers"><option value="started">Started</option><option value="stopped">Stopped</option></select>
          </label>
          <label>Text length
            <select id="stronghold-dev-length">${PHRASE_LENGTHS.map(length => `<option value="${length}">${LENGTH_LABELS[length]}</option>`).join('')}</select>
          </label>
          <label>Player color
            <select id="stronghold-dev-color">${Object.entries(PLAYER_COLORS).map(([name, color]) => `<option value="${color}">${name}</option>`).join('')}</select>
          </label>
          <label>Supplies <input id="stronghold-dev-resources" type="number" min="0" max="10000" step="1" required></label>
          <label>Tier <select id="stronghold-dev-tier">${[0, 1, 2, 3].map(tier => `<option value="${tier}">Tier ${tier}</option>`).join('')}</select></label>
          <fieldset class="stronghold-dev-counts"><legend class="sr-only">Starting forces</legend>${STARTING_ENTITIES.map(kind => {
            const labels = { worker: 'Gatherers', builder: 'Builders', warrior: 'Warriors', tower: 'Towers', archer: 'Archers', catapult: 'Catapults' };
            return `<label>${labels[kind]} <input id="stronghold-dev-${kind}" type="number" min="0" max="${STARTING_LIMITS[kind]}" step="1" required></label>`;
          }).join('')}</fieldset>
          <label>Season <select id="stronghold-dev-starting-season"><option value="random">Random each game</option>${SEASONS.map(season => `<option value="${season}">${SEASON_LABELS[season]}</option>`).join('')}</select></label>
          <label>Time <select id="stronghold-dev-period"><option value="day">Day</option><option value="night">Night</option></select></label>
          <button type="submit">Apply &amp; new game</button>
          <h3>Current match</h3>
          <label>Season <select id="stronghold-dev-season">${SEASONS.map(season => `<option value="${season}">${SEASON_LABELS[season]}</option>`).join('')}</select></label>
          <div class="stronghold-dev-time"><button id="stronghold-next-night" type="button">Skip to Night</button><button id="stronghold-next-day" type="button">Skip to Day</button></div>
          <button id="stronghold-next-wave" type="button">Next Wave</button>
        </form>
      </details>
      <div class="stronghold-atmosphere-controls" role="group" aria-label="Soundtrack and credits">
        <button id="stronghold-music" type="button" aria-pressed="true">Music on</button>
        <label class="sr-only" for="stronghold-volume">Stronghold music volume</label>
        <input id="stronghold-volume" type="range" min="0" max="0.5" step="0.01" value="0.18">
        <button id="stronghold-open-credits" type="button">Credits</button>
        <output id="stronghold-music-status" class="stronghold-music-status is-hidden" role="status"></output>
      </div>
      </div>
      </header>
      <p id="stronghold-feedback" class="stronghold-feedback" role="status" aria-live="polite"></p>
      <aside class="stronghold-event-panel" aria-label="World event and history">
        <div id="stronghold-world-event" class="stronghold-world-event is-hidden" aria-live="polite"><strong id="stronghold-event"></strong><span id="stronghold-event-time"></span></div>
        <div id="stronghold-event-log" class="stronghold-event-log" role="log" aria-label="Stronghold events" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
      </aside>
      <div class="stronghold-squad">${PLAYER_IDS.map(playerCard).join('')}</div>
      <div id="stronghold-private-slot">
        <section id="stronghold-private" class="stronghold-private" aria-label="Your private typing area">
          <div class="stronghold-length-panel"><span id="stronghold-length-label" class="sr-only">Text length</span>
            <small class="stronghold-length-keys"><span>PgUp</span><span>PgDn</span></small>
            <div id="stronghold-length" class="stronghold-length-wheel" role="listbox" aria-labelledby="stronghold-length-label" aria-activedescendant="stronghold-length-medium" aria-keyshortcuts="PageUp PageDown" tabindex="0">
              ${PHRASE_LENGTHS.map(length => `<button id="stronghold-length-${length}" type="button" role="option" data-length="${length}" value="${length}" aria-selected="${length === 'medium'}" tabindex="-1">${LENGTH_LABELS[length]} <small class="stronghold-length-bonus">${TEXT_LENGTH_BONUSES[length]}x</small></button>`).join('')}
            </div>
          </div>
          <div id="stronghold-typed-area" class="typed-area stronghold-typed-area">
            <label class="sr-only" for="stronghold-input">Type your Stronghold text exactly</label>
            <div id="stronghold-typed-bar" class="typed-bar" aria-hidden="true"></div><input id="stronghold-input" class="typing-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type here">
          </div>
          <section id="stronghold-typing" class="stronghold-typing">
            <div id="stronghold-phrase" class="text-display" data-horizontal-scroll="true" tabindex="0" aria-label="Your private text to type"></div>
            <div class="progress-track is-hidden" aria-hidden="true"><div id="stronghold-typing-progress"></div></div>
          </section>
        </section>
      </div>
      <section id="stronghold-army-orders" class="stronghold-army-orders is-hidden">
        ${orderButton('select-army', 'Select all troops', 1, '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/>')}
        ${orderButton('defend', 'Defend', 2, '<path d="M12 2L3 6v6c0 5 9 10 9 10s9-5 9-10V6Z"/><path d="M8 12l3 3 5-6"/>')}
        ${orderButton('assault', 'Assault base', 3, ROLE_ICONS.production)}
        ${orderButton('rally', 'Rally production', 4, '<path d="M5 22V3l14 5-14 5"/><path d="M2 22h6"/>')}<p id="stronghold-selection"></p>
      </section>
      <div id="stronghold-placement" class="stronghold-placement is-hidden"><span id="stronghold-placement-label">Click the map to place.</span><button id="stronghold-cancel-placement" type="button">Cancel</button></div>
    </div>
    ${creditsMarkup()}
    <dialog id="stronghold-tier-dialog" class="stronghold-tier-dialog">
      <div id="stronghold-tier-typing-slot"></div>
      <div class="stronghold-tier-status"><h2 id="stronghold-tier-title">Tier Up</h2><p id="stronghold-tier-description"></p><button id="stronghold-tier-pause" type="button">Pause challenge</button><button id="stronghold-tier-computers" type="button" aria-pressed="false">Stop computers</button></div>
      <div id="stronghold-tier-progress" class="stronghold-tier-progress" role="progressbar" aria-label="Shared tier challenge progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
      <div id="stronghold-tier-contributions" class="stronghold-tier-contributions"></div>
    </dialog>
  </section>`;
}
