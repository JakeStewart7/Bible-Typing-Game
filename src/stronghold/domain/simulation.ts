import { actionProblem, executeCommand } from './actions.ts';
import { rallyArmy, spawnWave, updateCombat } from './combat.ts';
import { updateLogistics } from './logistics.ts';
import { assignPhrase } from './phrases.ts';
import { addUnit } from './state.ts';
import { distance, EVENT_LABELS, TIER_MAX, TIER_QUOTA, UNIT_CAPS } from './rules.ts';
import { taskWork } from './technology.ts';
import { ENTITY_LABELS, recordEvent } from './events.ts';
import type { Action, Participant, Point, StrongholdState, WorldEvent } from './types.ts';

const EVENTS: readonly WorldEvent[] = ['peace', 'left-hand', 'vowels', 'numbers', 'symbols', 'code'];
const BOT_RELAY_SITES = [
  { x: 360, y: 540 }, { x: 640, y: 540 }, { x: 250, y: 435 }, { x: 760, y: 435 },
  { x: 390, y: 390 }, { x: 650, y: 390 }, { x: 650, y: 255 },
  { x: 140, y: 340 }, { x: 140, y: 215 }, { x: 770, y: 240 }
];
function nextRelaySite(state: StrongholdState): Point | undefined {
  return BOT_RELAY_SITES.find(site => !state.buildings.some(building => building.hp > 0 && distance(site, building) < 38));
}
function botAction(state: StrongholdState, player: Participant): Action {
  if (player.role === 'army') return 'resources';
  if (player.role === 'economy') {
    if (state.resources < 75) return 'resources';
    if (state.units.filter(unit => unit.kind === 'worker').length < 5) return 'worker';
    if (nextRelaySite(state)) return 'relay';
    if (state.upgrades.economy < state.tier + 2 && state.resources >= 120) return 'upgrade';
    return 'resources';
  }
  if (player.role === 'defenses') {
    if (state.units.filter(unit => unit.kind === 'builder').length < 2) return 'builder';
    if (state.tier > 0 && state.buildings.filter(building => building.kind === 'tower' && !building.enemy).length < 3) return 'tower';
    if (state.upgrades.defenses < state.tier) return 'upgrade';
    return state.buildings.filter(building => building.kind === 'wall').length < 8 ? 'wall' : 'builder';
  }
  if (state.tier === 0) return 'resources';
  if (!state.buildings.some(building => building.kind === 'barracks') && state.tier > 0) return 'barracks';
  if (state.tier === 3 && state.units.filter(unit => unit.kind === 'catapult').length < 3) return 'catapult';
  if (state.tier >= 2 && state.units.filter(unit => unit.kind === 'archer').length < 5) return 'archer';
  return 'warrior';
}
function updateBot(state: StrongholdState, player: Participant, seconds: number): void {
  if (state.phase === 'playing') {
    if (state.players.find(other => !other.simulated)?.ready && state.tier < TIER_MAX && !player.ready) {
      executeCommand(state, player, { type: 'READY', ready: true });
    }
    if (state.players.every(other => other.ready)) return;
    const humanOnRole = state.players.some(other => !other.simulated && other.role === player.role);
    if (player.role === 'army') {
      if (!humanOnRole) {
        const soldiers = state.units.filter(unit => ['warrior', 'archer', 'catapult'].includes(unit.kind));
        rallyArmy(state, state.tier >= 2 && soldiers.length >= 8 ? { x: 500, y: 100 } : state.rally);
      }
    }
    const action = humanOnRole ? player.action : botAction(state, player);
    if (action !== player.action) {
      executeCommand(state, player, { type: 'ACTION', action });
    }
    if (actionProblem(state, player, action)) return;
    if (['relay', 'barracks', 'tower', 'wall'].includes(action) && (action === 'relay' || player.work >= taskWork(player))) {
      if (humanOnRole) return;
      const count = state.buildings.filter(building => building.kind === action && !building.enemy).length;
      const point = action === 'relay' ? nextRelaySite(state) : action === 'barracks'
        ? { x: 620 + count * 48, y: 575 }
        : action === 'tower' ? { x: 360 + count * 140, y: 425 } : { x: 340 + count * 45, y: 480 };
      if (point && (action === 'barracks' || action === 'tower' || action === 'wall' || action === 'relay')) {
        // Legal placement failures are visible in the room; select a fresh task afterwards.
        try { executeCommand(state, player, { type: 'PLACE', kind: action, point }); }
        catch (error) {
          state.message = `${player.name}: ${error instanceof Error ? error.message : String(error)}`;
          assignPhrase(state, player);
        }
      }
      return;
    }
  } else if (player.contribution >= TIER_QUOTA) return;
  if (!player.phrase.startsWith(player.typed)) return;
  player.typingCredit += seconds * 5;
  const characters = Math.floor(player.typingCredit);
  if (characters === 0) return;
  player.typingCredit -= characters;
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId,
    text: player.phrase.slice(0, player.typed.length + characters) });
}
function produceArmy(state: StrongholdState, seconds: number): void {
  for (const barracks of state.buildings.filter(building => building.kind === 'barracks' && building.progress === 1 && building.hp > 0)) {
    barracks.cooldown = Math.max(0, barracks.cooldown - seconds);
    const kind = state.tier >= 3 && barracks.tier >= 3 ? 'catapult' : state.tier >= 2 && barracks.tier >= 2 ? 'archer' : 'warrior';
    const cost = kind === 'catapult' ? 35 : kind === 'archer' ? 20 : 10;
    if (barracks.cooldown > 0 || state.resources < cost || state.units.filter(unit => unit.kind === kind).length >= UNIT_CAPS[kind]) continue;
    state.resources -= cost;
    const unit = addUnit(state, kind, { x: barracks.x, y: barracks.y - 30 });
    unit.destination = { ...state.rally };
    const owner = state.players.find(player => player.id === barracks.ownerId);
    recordEvent(state, `${owner ? `Player ${state.players.indexOf(owner) + 1}` : 'Barracks'} created ${ENTITY_LABELS[kind]}`, barracks.ownerId);
    barracks.cooldown = 12;
  }
}
export function advanceStronghold(state: StrongholdState, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1) throw new Error('Simulation steps must be between zero and one second.');
  if (state.phase === 'won' || state.phase === 'lost') return;
  for (const player of state.players) {
    if (player.simulated) updateBot(state, player, seconds);
  }
  if (state.phase !== 'playing') return;
  state.elapsed += seconds;
  state.waveIn -= seconds;
  state.eventIn -= seconds;
  if (state.waveIn <= 0) spawnWave(state);
  if (state.eventIn <= 0) {
    state.event = EVENTS[(Math.floor(state.elapsed / 60)) % EVENTS.length] ?? 'peace';
    state.eventIn = 60;
    const refreshedRoles = new Set<string>();
    state.players.forEach(player => {
      if (player.typed.length === 0 && !refreshedRoles.has(player.role)) {
        assignPhrase(state, player);
        refreshedRoles.add(player.role);
      }
    });
    state.message = 'The world event changed. New phrases use the next drill; finish any phrase already in progress.';
    recordEvent(state, EVENT_LABELS[state.event]);
  }
  updateLogistics(state, seconds);
  produceArmy(state, seconds);
  updateCombat(state, seconds);
}
