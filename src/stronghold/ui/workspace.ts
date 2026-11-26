import { menuNavigationMarkup } from '../../ui/menu-navigation.ts';
import { ACTION_LABELS, COSTS, isTypingAction, LENGTH_LABELS, MIN_TIER, ROLE_LABELS, TEXT_LENGTH_BONUSES, TEXT_LENGTH_RANGES } from '../domain/rules.ts';
import { TOWER_UPGRADE_COSTS, UPGRADE_OPTIONS } from '../domain/technology.ts';
import { PHRASE_LENGTHS, PLAYER_COLORS, ROLES, SEASONS, STARTING_ENTITIES, type Action, type PhraseLength, type Role, type UpgradeTarget } from '../domain/types.ts';
import { SEASON_LABELS } from '../domain/environment.ts';
import { taskShortcut } from './keyboard.ts';
import { weatherMarkup } from './environment.ts';
import { creditsMarkup } from './credits.ts';
import { isArmyUnit } from '../domain/training.ts';
import { UNIT_CONTROL_ICON } from './player-theme.ts';

export const PLAYER_IDS = ['you', 'bot-1', 'bot-2', 'bot-3'] as const;
export const LENGTH_CONTROL_HELP = 'Click a text length. Page Up selects longer text; Page Down selects shorter text.';
const UNIT_CONTROL_HELP = 'Typing produces shared supplies. Issue army orders or set a shared rally. Units can be selected and moved in any role.';
export function lengthTooltip(length: PhraseLength): string {
  const [minimum, maximum] = TEXT_LENGTH_RANGES[length];
  return `${LENGTH_LABELS[length]} text: ${minimum}-${maximum} characters. Correct entries earn ${TEXT_LENGTH_BONUSES[length]}x typing work.`;
}
export function orderTooltip(id: string): string {
  if (id === 'stronghold-select-army') return 'Select all friendly combat troops. Gatherers and builders are not included.';
  if (id === 'stronghold-defend') return 'Gather all friendly combat troops in front of your castle to defend the approach.';
  if (id === 'stronghold-assault') return 'Send all friendly combat troops toward the enemy base.';
  if (id === 'stronghold-rally') return 'Choose a destination for newly trained troops. Updates the rally points of all castles and barracks.';
  throw new Error(`Unknown Stronghold order: ${id}`);
}
const ROLE_HELP: Record<Role, string> = {
  economy: 'Recruit gatherers, earn shared supplies and connect relays.',
  production: 'Build barracks, train combat units and upgrade them.',
  army: UNIT_CONTROL_HELP,
  defenses: 'Recruit builders, place defenses and upgrade selected towers.'
};
const ROLE_ICONS: Record<Exclude<Role, 'economy'>, string> = {
  production: '<path d="M7 15L17 3L22 2L21 7L11 19Z"/><path d="M4 13L13 22M4 22L8 18"/>',
  army: UNIT_CONTROL_ICON,
  defenses: '<path d="M3 21V5h4v4h3V3h4v6h3V5h4v16ZM10 21v-6h4v6"/>'
};
function lockIcon(marker = 'data-tier-lock'): string {
  return `<svg class="stronghold-lock is-hidden" ${marker} viewBox="0 0 16 18" aria-hidden="true"><path d="M4 8V5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2" y="7" width="12" height="10" rx="1" fill="currentColor"/></svg>`;
}
function costMarkup(value: number, id?: string): string {
  return `<span class="stronghold-cost"${id ? ` id="${id}"` : ''}><i class="stronghold-symbol stronghold-symbol--resource" aria-hidden="true"></i><span${id ? ' id="stronghold-tier-price"' : ''}>${value}</span><span class="sr-only"> supplies</span></span>`;
}
function orderButton(id: string, label: string, shortcut: number, icon: string): string {
  return `<button id="stronghold-${id}" type="button" data-shortcut="${shortcut}" aria-keyshortcuts="Alt+${shortcut}" data-tooltip="${orderTooltip(`stronghold-${id}`)} (Alt+${shortcut})"${id === 'rally' ? ' aria-pressed="false"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${icon}</svg><span class="stronghold-action-label">${label}</span><small data-order-blocker class="stronghold-action-blocker is-hidden"></small><kbd aria-hidden="true">${shortcut}</kbd></button>`;
}
function taskIndicators(): string {
  return `<span class="stronghold-task-players" data-task-players role="img">${PLAYER_IDS.map(id => `<i data-task-player="${id}" aria-hidden="true" style="visibility:hidden"></i>`).join('')}</span>`;
}
function tile(action: Action, label: string, tier: number | undefined, shortcut: string): string {
  return `<button type="button" class="stronghold-build-tile${COSTS[action] > 0 ? ' has-cost' : ''}" data-action="${action}"${tier ? ` data-tier="${tier}"` : ''} data-min-tier="${tier ?? MIN_TIER[action]}" data-shortcut="${shortcut}" aria-keyshortcuts="Alt+${shortcut}">
    ${lockIcon()}<span class="stronghold-action-label">${label}</span>${COSTS[action] > 0 ? costMarkup(COSTS[action] * (tier ?? 1)) : ''}${action === 'worker' || action === 'builder' || isArmyUnit(action) ? '<small data-unit-population></small>' : ''}${isArmyUnit(action) ? '<small data-training-queued>0 queued</small>' : ''}${isTypingAction(action) ? `<span class="stronghold-task-progress" data-task-progress role="progressbar" aria-label="${ACTION_LABELS[action]}${tier ? ` tier ${tier}` : ''} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-task-fill></span></span>` : ''}<small data-action-blocker class="stronghold-action-blocker is-hidden"></small>${taskIndicators()}</button>`;
}
function upgrade(target: UpgradeTarget, shortcut: string): string {
  const option = UPGRADE_OPTIONS[target];
  return `<button type="button" class="stronghold-upgrade-tile has-cost" data-action="upgrade" data-stronghold-upgrade="${target}" data-min-tier="${option.tier}" data-shortcut="${shortcut}" aria-keyshortcuts="Alt+${shortcut}">
    ${lockIcon()}<span class="stronghold-action-label">Upgrade <span class="stronghold-upgrade-kind">${option.label}</span></span>${costMarkup(option.cost)}<small data-upgrade-level="${target}">Level 0</small><small data-action-blocker class="stronghold-action-blocker is-hidden"></small>${taskIndicators()}</button>`;
}
function towerUpgrade(tier: 2 | 3, shortcut: string): string {
  return `<button type="button" class="stronghold-upgrade-tile has-cost" data-tower-upgrade="${tier}" data-shortcut="${shortcut}" aria-keyshortcuts="Alt+${shortcut}">
    ${lockIcon()}<span class="stronghold-action-label">Upgrade to T${tier}</span>${costMarkup(TOWER_UPGRADE_COSTS[tier])}<small data-tower-blocker class="stronghold-action-blocker">Select one tower</small>${taskIndicators()}</button>`;
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
    <div class="stronghold-build-row">${task('tower', 'Tower T1', 1)}</div>
    <small data-tower-status class="stronghold-player-status sr-only is-hidden"></small>
    <div class="stronghold-build-row">${towerUpgrade(2, taskShortcut(index++))}${towerUpgrade(3, taskShortcut(index++))}</div>`;
  return `<div class="stronghold-supply-summary"><span class="stronghold-action-label" data-supply-output>+8 Supplies</span>${taskIndicators()}</div>`;
}
function playerCard(id: string, index: number): string {
  return `<section class="stronghold-player" data-player="${id}">
    <div class="stronghold-player-frame">
      <div class="stronghold-player-actions" id="stronghold-player-actions-${id}">
      <div class="stronghold-player-overview">
      <header><h3 id="stronghold-name-${id}">Player ${index + 1}</h3>
      <div class="stronghold-role-buttons" role="group" aria-label="Player ${index + 1} role">${ROLES.map(role => `<button id="stronghold-role-${id}-${role}" type="button" data-role-button="${role}" aria-label="${ROLE_LABELS[role]}" aria-pressed="false" data-tooltip="${ROLE_LABELS[role]}. ${ROLE_HELP[role]}">${role === 'economy' ? '<i class="stronghold-symbol stronghold-symbol--resource" aria-hidden="true"></i>' : `<svg viewBox="0 0 24 ${role === 'army' ? 30 : 24}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${ROLE_ICONS[role]}</svg>`}<span class="stronghold-role-caption" aria-hidden="true">${role === 'army' ? 'Control' : ROLE_LABELS[role]}</span></button>`).join('')}</div></header>
      <div class="stronghold-player-progress" role="progressbar" aria-label="Player ${index + 1} selected task progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><div class="stronghold-work-track"><div id="stronghold-progress-${id}"></div></div><span id="stronghold-progress-label-${id}" class="stronghold-progress-label">0%</span>${lockIcon('data-progress-lock')}</div>
      </div>
      ${ROLES.map(role => `<div class="stronghold-actions" data-role="${role}">${roleActions(role)}</div>`).join('')}</div>
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
        <div id="stronghold-outcome" class="stronghold-outcome is-hidden"><h3 id="stronghold-outcome-title"></h3><p id="stronghold-outcome-copy"></p><button id="stronghold-play-again" class="primary-btn" type="button" title="Start a fresh match using your saved defaults.">Build again</button></div>
      </div>
      <header class="stronghold-command-bar" aria-label="Kingdom command bar">
      <nav class="stronghold-map-toolbar" aria-label="Stronghold controls">${menuNavigationMarkup()}
        <button id="stronghold-pause" type="button" title="Pause the battle and typing without losing progress.">Pause</button><button id="stronghold-restart" type="button" title="Start a new match using your saved defaults. Resets the battlefield and typing progress.">New game</button>
        <button id="stronghold-computers" type="button" aria-pressed="false">Stop computers</button>
      </nav>
      <div class="stronghold-tier-mount"><button id="stronghold-ready" class="stronghold-tier" type="button" aria-pressed="false"><span id="stronghold-tier-label">Tier 0</span>${costMarkup(300, 'stronghold-tier-cost')}</button></div>
      <aside class="stronghold-hud" aria-label="Kingdom status">
        <div class="stronghold-populations">
          <span class="stronghold-supplies" title="Shared team supplies. Spend them on troops, relays, upgrades and tier challenges."><span class="sr-only">Shared supplies: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--resource"></i><b id="stronghold-resources">50</b></span>
          <span title="Friendly towers on the map. Towers defend automatically once constructed; no tower limit."><span class="sr-only">Towers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--tower"></i><b id="stronghold-tower-count">0</b></span>
          <span title="Living Warriors. Melee troops for close combat; no population limit."><span class="sr-only">Warriors: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--warrior"></i><b id="stronghold-warrior-count">2</b></span>
          <span title="Living Archers. Ranged troops that attack from a distance; no population limit."><span class="sr-only">Archers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--archer"></i><b id="stronghold-archer-count">0</b></span>
          <span title="Living Catapults. Siege units that specialize in destroying buildings; no population limit."><span class="sr-only">Catapults: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--catapult"></i><b id="stronghold-catapult-count">0</b></span>
          <span title="Living Builders. Automatically construct and repair your buildings; no population limit."><span class="sr-only">Builders: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--builder"></i><b id="stronghold-builder-count">1</b></span>
          <span title="Living Gatherers. Automatically collect and deliver supplies; no population limit."><span class="sr-only">Gatherers: </span><i aria-hidden="true" class="stronghold-symbol stronghold-symbol--worker"></i><b id="stronghold-worker-count">2</b></span>
        </div>
        <span id="stronghold-season" class="stronghold-season" aria-label="Seasonal effects" aria-live="polite" tabindex="0"></span>
      </aside>
      <div class="stronghold-utilities">
      <span class="stronghold-match-clock" title="Elapsed battle time. Stops during pauses and shared tier challenges."><span class="sr-only">Battle time: </span><time id="stronghold-timer" datetime="PT0S">0:00</time></span>
      <details class="stronghold-guide"><summary title="View game rules, controls and unit abilities.">Help</summary>
        <div class="stronghold-guide-content">
        <div class="stronghold-legend"><span>Dark red: enemies</span><span>□ Warrior</span><span>◇ Archer</span><span>Catapult: siege cart</span><span>△ Builder</span><span>○ Gatherer</span></div>
        <p><strong>Controls.</strong> Click or drag to select units in any role; Shift adds units. Right-click to move, or assign a selected builder to an unfinished or damaged friendly building. Scroll zooms or rotates a selected wall. Alt-drag, middle-drag or arrows pan. Escape cancels placement.</p>
        <p><strong>Tasks and teamwork.</strong> Type correct text to recruit workers, earn supplies or prepare buildings. At 100%, choose Place and click the map. Work survives task and role changes. Activity color marks identify players selecting that task; hover for names. Construction uses thin bars, with details on hover.</p>
        <p><strong>Supplies.</strong> Typed supplies start at +8. Nodes hold 600 supplies; blue packs start at 3, rich purple packs at 6, with one harvest every 0.8 seconds. Upgrades and seasons adjust income. Gatherers deliver to a castle or connected relay: green links are connected; amber links are planned or disconnected.</p>
        <p><strong>Army and defenses.</strong> Buy troops at matching barracks; each trains for 24 seconds. Build T1 towers, then select one in Defenses to buy T2/T3 upgrades. Both teams have no unit or tower count limits; supplies, tier and clear space still apply. Hover for costs, abilities and range.</p>
        <p><strong>Progression and vision.</strong> Destroy the enemy base to win. Shared tier challenges unlock units and buildings; complete phrases to contribute. Unavailable actions explain why. Enemy attacks show beams and briefly reveal their sources. Shadows show last-seen information, not live targets. Seasonal effects stay in the HUD.</p>
        <p><strong>Shortcuts and settings.</strong> Ctrl+Tab changes role; Tab changes task; Shift reverses either. Alt+number selects an activity. Page Up/Down changes text length. Select a castle or barracks and right-click to set its rally. Pause freezes play; Stop computers freezes teammates only. Dev options saves new-game defaults.</p>
        </div>
      </details>
      <details id="stronghold-dev-options" class="stronghold-dev-options">
        <summary title="Set saved defaults for new matches or preview the current season, time and next wave.">Dev options</summary>
        <form id="stronghold-dev-form" class="stronghold-dev-panel">
          <h3>New game</h3>
          <label>Computers
            <select id="stronghold-dev-computers" title="Choose whether computer teammates begin new matches active or paused."><option value="started">Started</option><option value="stopped">Stopped</option></select>
          </label>
          <label>Text length
            <select id="stronghold-dev-length" title="Default typing length for new matches. Longer text earns more work per character.">${PHRASE_LENGTHS.map(length => `<option value="${length}">${LENGTH_LABELS[length]}</option>`).join('')}</select>
          </label>
          <label>Player color
            <select id="stronghold-dev-color" title="Your player, selection and cursor color in new matches.">${Object.entries(PLAYER_COLORS).map(([name, color]) => `<option value="${color}">${name}</option>`).join('')}</select>
          </label>
          <label>Supplies <input id="stronghold-dev-resources" title="Shared supplies available at the start of new matches." type="number" min="0" max="10000" step="1" required></label>
          <label>Tier <select id="stronghold-dev-tier" title="Team tier unlocked at the start of new matches.">${[0, 1, 2, 3].map(tier => `<option value="${tier}">Tier ${tier}</option>`).join('')}</select></label>
          <fieldset class="stronghold-dev-counts"><legend class="sr-only">Starting forces</legend>${STARTING_ENTITIES.map(kind => {
            const labels = { worker: 'Gatherers', builder: 'Builders', warrior: 'Warriors', tower: 'Towers', archer: 'Archers', catapult: 'Catapults' };
            return `<label>${labels[kind]} <input id="stronghold-dev-${kind}" title="${labels[kind]} available at the start of new matches. Enter a nonnegative whole number; forces must fit on the map." type="number" min="0" step="1" required></label>`;
          }).join('')}</fieldset>
          <label>Season <select id="stronghold-dev-starting-season" title="Starting season for new matches. Random chooses a new season each game."><option value="random">Random each game</option>${SEASONS.map(season => `<option value="${season}">${SEASON_LABELS[season]}</option>`).join('')}</select></label>
          <label>Time <select id="stronghold-dev-period" title="Choose whether new matches begin during the day or at night."><option value="day">Day</option><option value="night">Night</option></select></label>
          <button type="submit" title="Save these defaults and start a fresh match.">Apply &amp; new game</button>
          <h3>Current match</h3>
          <p id="stronghold-dev-status" class="stronghold-control-blocker is-hidden"></p>
          <label>Season <select id="stronghold-dev-season">${SEASONS.map(season => `<option value="${season}">${SEASON_LABELS[season]}</option>`).join('')}</select></label>
          <div class="stronghold-dev-time"><button id="stronghold-next-night" type="button">Skip to Night</button><button id="stronghold-next-day" type="button">Skip to Day</button></div>
          <button id="stronghold-next-wave" type="button">Next Wave</button>
        </form>
      </details>
      <div class="stronghold-atmosphere-controls" role="group" aria-label="Soundtrack and credits">
        <button id="stronghold-music" type="button" aria-pressed="true" title="Mute or enable the seasonal soundtrack.">Music on</button>
        <label class="sr-only" for="stronghold-volume">Stronghold music volume</label>
        <input id="stronghold-volume" title="Adjust the seasonal soundtrack volume." type="range" min="0" max="0.5" step="0.01" value="0.18">
        <button id="stronghold-open-credits" type="button" title="View soundtrack artists, tracks and license information.">Credits</button>
        <output id="stronghold-music-status" class="stronghold-music-status is-hidden" role="status"></output>
      </div>
      </div>
      </header>
      <p id="stronghold-feedback" class="stronghold-feedback" role="status" aria-live="polite"></p>
      <p id="stronghold-selection" class="stronghold-selection is-hidden" aria-label="Current selection" title="Right-click to move selected units in any role or set rally points on selected castles and barracks. Shift adds to the selection." tabindex="0"></p>
      <aside class="stronghold-event-panel" aria-label="World event and history">
        <div id="stronghold-world-event" class="stronghold-world-event is-hidden" aria-live="polite"><strong id="stronghold-event"></strong><span id="stronghold-event-time"></span></div>
        <div id="stronghold-event-log" class="stronghold-event-log" role="log" aria-label="Stronghold events" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
      </aside>
      <div class="stronghold-squad">${PLAYER_IDS.map(playerCard).join('')}</div>
      <div id="stronghold-private-slot">
        <section id="stronghold-private" class="stronghold-private" aria-label="Your private typing area">
          <div class="stronghold-length-panel"><span id="stronghold-length-label" class="sr-only">Text length</span>
            <div id="stronghold-length" class="stronghold-length-wheel" role="listbox" aria-labelledby="stronghold-length-label" aria-activedescendant="stronghold-length-medium" aria-keyshortcuts="PageUp PageDown" title="${LENGTH_CONTROL_HELP}" tabindex="0">
              ${PHRASE_LENGTHS.map(length => `<button id="stronghold-length-${length}" title="${lengthTooltip(length)}" type="button" role="option" data-length="${length}" value="${length}" aria-selected="${length === 'medium'}" tabindex="-1">${LENGTH_LABELS[length]} <small class="stronghold-length-bonus">${TEXT_LENGTH_BONUSES[length]}x</small></button>`).join('')}
            </div>
          </div>
          <div id="stronghold-typed-area" class="typed-area stronghold-typed-area">
            <label class="sr-only" for="stronghold-input">Type your Stronghold text exactly</label>
            <div id="stronghold-typed-bar" class="typed-bar" aria-hidden="true"></div><input id="stronghold-input" class="typing-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type here">
          </div>
          <section id="stronghold-typing" class="stronghold-typing">
            <div id="stronghold-phrase" class="text-display" data-horizontal-scroll="true" tabindex="0" aria-label="Your private text to type" title="Type this text exactly. Correct entries advance your selected task or the shared tier challenge."></div>
            <div id="stronghold-typing-lock" class="stronghold-typing-lock is-hidden">${lockIcon('data-typing-lock')}<span id="stronghold-typing-lock-label">Needs Tier 1</span></div>
            <div class="progress-track is-hidden" aria-hidden="true"><div id="stronghold-typing-progress"></div></div>
          </section>
        </section>
      </div>
      <section id="stronghold-army-orders" class="stronghold-army-orders is-hidden">
        ${orderButton('select-army', 'Select all troops', 1, '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/>')}
        ${orderButton('defend', 'Defend', 2, '<path d="M12 2L3 6v6c0 5 9 10 9 10s9-5 9-10V6Z"/><path d="M8 12l3 3 5-6"/>')}
        ${orderButton('assault', 'Assault base', 3, ROLE_ICONS.production)}
        ${orderButton('rally', 'Rally production', 4, '<path d="M5 22V3l14 5-14 5"/><path d="M2 22h6"/>')}
      </section>
      <div id="stronghold-placement" class="stronghold-placement is-hidden"><span id="stronghold-placement-label" tabindex="0">Place building</span><button id="stronghold-cancel-placement" type="button" title="Cancel placement with Escape or right-click.">Cancel</button></div>
    </div>
    ${creditsMarkup()}
    <dialog id="stronghold-tier-dialog" class="stronghold-tier-dialog">
      <div id="stronghold-tier-typing-slot"></div>
      <div class="stronghold-tier-status"><h2 id="stronghold-tier-title">Tier Up</h2><p id="stronghold-tier-description"></p><button id="stronghold-tier-pause" type="button">Pause challenge</button><button id="stronghold-tier-computers" type="button" aria-pressed="false">Stop computers</button></div>
      <div id="stronghold-tier-progress" class="stronghold-tier-progress" role="progressbar" aria-label="Shared tier challenge progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"></div>
      <div id="stronghold-tier-contributions" class="stronghold-tier-contributions"></div>
    </dialog>
  </section>`;
}
