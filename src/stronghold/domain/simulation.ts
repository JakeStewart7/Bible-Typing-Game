import { actionProblem, actionUnlockProblem, executeCommand } from './actions.ts';
import { rallyArmy, spawnWave, updateCombat } from './combat.ts';
import { updateLogistics } from './logistics.ts';
import { assignPhrase } from './phrases.ts';
import { addUnit } from './state.ts';
import { distance, isTypingAction, MIN_TIER, TIER_MAX, UNIT_CAPS } from './rules.ts';
import { taskWork } from './technology.ts';
import { ENTITY_LABELS, recordEvent } from './events.ts';
import type { Action, Participant, Point, StrongholdState } from './types.ts';
import { updateWorldEvent } from './world-events.ts';
import { queuedUnits, TRAINING_SECONDS } from './training.ts';
import { unitRadius, unitSpawnPoint } from './navigation.ts';

const BOT_RELAY_SITES = [
  { x: 360, y: 540 }, { x: 640, y: 540 }, { x: 250, y: 435 }, { x: 760, y: 435 },
  { x: 390, y: 390 }, { x: 650, y: 390 }, { x: 650, y: 255 },
  { x: 140, y: 340 }, { x: 140, y: 215 }, { x: 770, y: 240 }
];
function nextRelaySite(state: StrongholdState): Point | undefined {
  return BOT_RELAY_SITES.find(site => !state.buildings.some(building => building.hp > 0 && distance(site, building) < 38));
}
function botTroop(state: StrongholdState): 'warrior' | 'archer' | 'catapult' {
  const count = (kind: 'warrior' | 'archer' | 'catapult') => state.units.filter(unit => unit.kind === kind).length + queuedUnits(state, kind);
  if (count('warrior') < 6) return 'warrior';
  if (state.tier >= 2 && count('archer') < 5) return 'archer';
  if (state.tier >= 3 && count('catapult') < 3) return 'catapult';
  return 'warrior';
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
  const troop = botTroop(state);
  if (state.tier < MIN_TIER[troop]) return 'resources';
  if (!state.buildings.some(building => building.kind === 'barracks' && building.hp > 0 && building.tier === MIN_TIER[troop])) return 'barracks';
  return troop;
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
    if (!isTypingAction(action) && action !== 'relay') {
      if (actionProblem(state, { ...player, action }, action)) return;
      player.typingCredit += seconds;
      if (player.typingCredit < 1) return;
      player.typingCredit = 0;
      executeCommand(state, player, { type: 'ACTION', action });
      return;
    }
    const tier = !humanOnRole && action === 'barracks' ? MIN_TIER[botTroop(state)] : player.constructionTier;
    if (actionUnlockProblem(state, { ...player, action, constructionTier: tier })) return;
    if (action !== player.action || (action === 'barracks' && player.constructionTier !== tier)) {
      executeCommand(state, player, { type: 'ACTION', action, tier });
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
  }
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
    const order = barracks.trainingQueue[0];
    if (!order) continue;
    if (state.computersPaused && state.players.some(player => player.id === order.playerId && player.simulated)) continue;
    barracks.cooldown = Math.max(0, barracks.cooldown - seconds);
    if (barracks.cooldown < 1e-9) barracks.cooldown = 0;
    if (barracks.cooldown > 0 || state.units.filter(unit => unit.kind === order.kind && unit.hp > 0).length >= UNIT_CAPS[order.kind]) continue;
    const spawn = unitSpawnPoint(state, barracks, unitRadius(order));
    if (!spawn) continue;
    const unit = addUnit(state, order.kind, spawn);
    unit.destination = { ...(barracks.rally ?? state.rally) };
    const owner = state.players.find(player => player.id === order.playerId);
    recordEvent(state, `${owner ? `Player ${state.players.indexOf(owner) + 1}` : 'Barracks'} created ${ENTITY_LABELS[order.kind]}`, order.playerId);
    barracks.trainingQueue.shift();
    barracks.cooldown = barracks.trainingQueue.length ? TRAINING_SECONDS : 0;
  }
}
export function advanceStronghold(state: StrongholdState, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1) throw new Error('Simulation steps must be between zero and one second.');
  if (state.phase === 'won' || state.phase === 'lost') return;
  for (const player of state.players) {
    if (player.simulated && !state.computersPaused) updateBot(state, player, seconds);
  }
  if (state.phase !== 'playing') return;
  state.elapsed += seconds;
  state.environmentElapsed += seconds;
  state.waveIn -= seconds;
  if (state.waveIn <= 0) spawnWave(state);
  if (updateWorldEvent(state)) {
    state.players.forEach(player => {
      if (player.typed.length === 0) assignPhrase(state, player);
    });
  }
  updateLogistics(state, seconds);
  produceArmy(state, seconds);
  updateCombat(state, seconds);
}
