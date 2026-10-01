import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { actionProblem, executeCommand } from '../src/stronghold/domain/actions.ts';
import { updateCombat, spawnWave } from '../src/stronghold/domain/combat.ts';
import { connectedRelays, updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { assignPhrase } from '../src/stronghold/domain/phrases.ts';
import { addBuilding, addUnit, createStronghold } from '../src/stronghold/domain/state.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { TIER_QUOTA } from '../src/stronghold/domain/rules.ts';
import { LocalStrongholdConnection } from '../src/stronghold/infrastructure/local-connection.ts';
import { themeForWorkspace } from '../src/ui/page-theme.ts';
import type { Participant, StrongholdState } from '../src/stronghold/domain/types.ts';
import { equal, test } from './harness.ts';

function self(state: StrongholdState): Participant {
  const player = state.players.find(candidate => candidate.id === 'you');
  if (!player) throw new Error('Missing test player.');
  return player;
}
function finish(state: StrongholdState, player = self(state)): void {
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
}
function rejects(run: () => void, message: string): void {
  try { run(); } catch (error) { equal(error instanceof Error && error.message.includes(message), true); return; }
  throw new Error(`Expected rejection: ${message}`);
}
function noBots(state: StrongholdState): void {
  state.players.forEach(player => { player.simulated = false; });
}

test('Stronghold snapshots are independent and expose only each player private phrase', () => {
  const engine = new StrongholdEngine();
  const snapshot = engine.snapshot('you');
  equal(snapshot.players.every(player => player.id === 'you' || player.phrase === ''), true);
  equal(snapshot.players.find(player => player.id === 'you')?.phrase.length !== 0, true);
  snapshot.resources = 0;
  snapshot.units.length = 0;
  equal(engine.snapshot('you').resources, 100);
  equal(engine.snapshot('you').units.length, 5);
  rejects(() => engine.snapshot('stranger'), 'Unknown');
});

test('Stronghold typing requires exact phrase and rejects expired phrase IDs', () => {
  const state = createStronghold();
  const player = self(state);
  const phraseId = player.phraseId;
  executeCommand(state, player, { type: 'TYPE', phraseId, text: player.phrase.toLowerCase() });
  equal(state.resources, 100);
  finish(state);
  equal(state.resources, 118);
  rejects(() => executeCommand(state, player, { type: 'TYPE', phraseId, text: 'old' }), 'expired');
  rejects(() => executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase + 'x' }), 'Invalid');
});

test('Stronghold role selection joins teammates without displacing them', () => {
  const state = createStronghold();
  executeCommand(state, self(state), { type: 'ROLE', role: 'army' });
  equal(self(state).role, 'army');
  equal(state.players.find(player => player.id === 'bot-2')?.role, 'army');
  equal(new Set(state.players.map(player => player.role)).size, 3);
  rejects(() => finish(state), 'map orders');
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'tower' }), 'another role');
});

test('Stronghold tier-up waits for everyone, pauses battle and requires each contribution', () => {
  const state = createStronghold();
  noBots(state);
  executeCommand(state, self(state), { type: 'READY', ready: true });
  equal(state.phase, 'playing');
  for (const player of state.players.slice(1)) executeCommand(state, player, { type: 'READY', ready: true });
  equal(state.phase, 'tier-up');
  const time = state.elapsed;
  advanceStronghold(state, .5);
  equal(state.elapsed, time);
  const first = self(state);
  for (let index = 0; index < TIER_QUOTA + 2; index++) finish(state, first);
  equal(first.contribution, TIER_QUOTA);
  equal(state.tier, 0);
  for (const player of state.players.slice(1)) for (let index = 0; index < TIER_QUOTA; index++) finish(state, player);
  equal(state.tier, 1);
  equal(state.phase, 'playing');
  equal(state.players.every(player => !player.ready), true);
});

test('Stronghold simulated teammates ready up and finish their own tier phrases', () => {
  const state = createStronghold();
  executeCommand(state, self(state), { type: 'READY', ready: true });
  advanceStronghold(state, .25);
  equal(state.phase, 'tier-up');
  for (let index = 0; index < TIER_QUOTA; index++) finish(state);
  for (let index = 0; index < 120; index++) advanceStronghold(state, .25);
  equal(state.tier, 1);
  equal(state.phase, 'playing');
});

test('Stronghold building placement costs once and waits for a nearby builder', () => {
  const state = createStronghold();
  executeCommand(state, self(state), { type: 'ACTION', action: 'relay' });
  finish(state);
  equal(state.resources, 100);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'relay', point: { x: 380, y: 540 } });
  equal(state.resources, 85);
  const relay = state.buildings.find(building => building.kind === 'relay');
  equal(relay?.progress, 0);
  for (let index = 0; index < 60; index++) updateLogistics(state, .25);
  equal(relay?.progress, 1);
  rejects(() => executeCommand(state, self(state), { type: 'PLACE', kind: 'relay', point: { x: 650, y: 540 } }), 'phrase first');
});

test('Stronghold rejects illegal sites, insufficient resources and locked actions without spending', () => {
  const state = createStronghold();
  executeCommand(state, self(state), { type: 'ROLE', role: 'production' });
  equal(actionProblem(state, self(state), 'archer')?.includes('tier 2'), true);
  executeCommand(state, self(state), { type: 'ROLE', role: 'economy' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'relay' });
  finish(state);
  rejects(() => executeCommand(state, self(state), { type: 'PLACE', kind: 'relay', point: { x: NaN, y: 500 } }), 'inside');
  rejects(() => executeCommand(state, self(state), { type: 'PLACE', kind: 'relay', point: { x: 500, y: 595 } }), 'space');
  state.resources = 0;
  rejects(() => executeCommand(state, self(state), { type: 'PLACE', kind: 'relay', point: { x: 380, y: 540 } }), 'supplies');
  equal(state.buildings.filter(building => building.kind === 'relay').length, 0);
});

test('Stronghold upgrades obey per-tier limits and population caps', () => {
  const state = createStronghold();
  executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade' });
  state.resources = 1000;
  finish(state); finish(state); finish(state);
  equal(state.upgrades.economy, 2);
  equal(state.resources, 880);
  executeCommand(state, self(state), { type: 'ACTION', action: 'worker' });
  while (state.units.filter(unit => unit.kind === 'worker').length < 12) finish(state);
  const resources = state.resources;
  finish(state);
  equal(state.units.filter(unit => unit.kind === 'worker').length, 12);
  equal(state.resources, resources);
  equal(self(state).typed, '');
});

test('Stronghold relay destruction disconnects upstream resources until a route is restored', () => {
  const state = createStronghold();
  state.units = [];
  const first = addBuilding(state, 'relay', { x: 500, y: 450 }, true);
  const upstream = addBuilding(state, 'relay', { x: 500, y: 305 }, true);
  equal(connectedRelays(state).length, 3);
  state.chunks = [{ id: 99, x: 500, y: 305, amount: 8, target: upstream.id, carrier: null }];
  first.hp = 0;
  updateLogistics(state, .5);
  equal(state.chunks[0]?.y, 305);
  equal(state.resources, 100);
  first.hp = first.maxHp;
  for (let index = 0; index < 60; index++) updateLogistics(state, .25);
  equal(state.resources, 108);
  equal(state.chunks.length, 0);
});

test('Stronghold rich nodes yield twice the resources and depleted nodes stop mining', () => {
  function mine(rich: boolean): number {
    const state = createStronghold();
    state.units = [];
    state.nodes = [{ id: 50, x: 500, y: 540, rich, remaining: 100 }];
    addUnit(state, 'worker', { x: 500, y: 540 });
    updateLogistics(state, .1);
    return state.chunks[0]?.amount ?? 0;
  }
  equal(mine(true), mine(false) * 2);
  const state = createStronghold();
  state.nodes.forEach(node => { node.remaining = 0; });
  updateLogistics(state, .5);
  equal(state.chunks.length, 0);
});

test('Stronghold invaders aggro warriors before workers and towers defend their own side', () => {
  const state = createStronghold();
  state.units = [];
  const invader = addUnit(state, 'invader', { x: 500, y: 400 });
  const worker = addUnit(state, 'worker', { x: 500, y: 401 });
  const warrior = addUnit(state, 'warrior', { x: 500, y: 420 });
  updateCombat(state, .1);
  equal(worker.hp, worker.maxHp);
  equal(warrior.hp < warrior.maxHp, true);
  const tower = addBuilding(state, 'tower', { x: 500, y: 400 }, true);
  const before = invader.hp;
  updateCombat(state, .1);
  equal(invader.hp < before, true);
  equal(tower.hp > 0, true);
});

test('Stronghold only army role orders friendly troops and rejects nonfinite map coordinates', () => {
  const state = createStronghold();
  const warrior = state.units.find(unit => unit.kind === 'warrior');
  if (!warrior) throw new Error('Missing warrior.');
  rejects(() => executeCommand(state, self(state), { type: 'MOVE', ids: [warrior.id], point: { x: 500, y: 100 } }), 'Army control');
  executeCommand(state, self(state), { type: 'ROLE', role: 'army' });
  executeCommand(state, self(state), { type: 'MOVE', ids: [warrior.id], point: { x: 500, y: 100 } });
  equal(warrior.destination, { x: 500, y: 100 });
  rejects(() => executeCommand(state, self(state), { type: 'RALLY', point: { x: Infinity, y: 100 } }), 'inside');
  rejects(() => executeCommand(state, self(state), { type: 'MOVE', ids: [99999], point: { x: 500, y: 100 } }), 'friendly');
});

test('Stronghold completed barracks train units and consume supplies, unfinished ones do not', () => {
  const state = createStronghold();
  noBots(state); state.tier = 2;
  state.units = [];
  const barracks = addBuilding(state, 'barracks', { x: 650, y: 570 });
  advanceStronghold(state, .1);
  equal(state.units.length, 0);
  barracks.progress = 1;
  advanceStronghold(state, .1);
  equal(state.units[0]?.kind, 'archer');
  equal(state.resources, 80);
  equal(state.units[0]?.destination, state.rally);
});

test('Stronghold waves grow enemy defenses, world events change drills and terminal outcomes stop simulation', () => {
  const state = createStronghold();
  noBots(state);
  spawnWave(state); spawnWave(state); spawnWave(state);
  equal(state.wave, 3);
  equal(state.buildings.find(building => building.kind === 'enemy-base')?.tier, 1);
  state.elapsed = 59.9; state.eventIn = .1;
  advanceStronghold(state, .25);
  equal(state.event, 'left-hand');
  equal(self(state).phrase.includes('We ') || self(state).phrase.includes('Steward'), true);
  const enemyBase = state.buildings.find(building => building.kind === 'enemy-base');
  if (!enemyBase) throw new Error('Missing enemy base.');
  enemyBase.hp = 0;
  updateCombat(state, .1);
  equal(state.phase, 'won');
  const elapsed = state.elapsed;
  advanceStronghold(state, .5);
  equal(state.elapsed, elapsed);
  rejects(() => executeCommand(state, self(state), { type: 'READY', ready: true }), 'over');
  const loss = createStronghold();
  const castle = loss.buildings.find(building => building.kind === 'castle');
  if (!castle) throw new Error('Missing castle.');
  castle.hp = 0; updateCombat(loss, .1);
  equal(loss.phase, 'lost');
});

test('Stronghold higher-tier scripture uses fewer longer words', () => {
  const state = createStronghold();
  const player = self(state);
  player.phraseId = 0; assignPhrase(state, player);
  const initialWords = player.phrase.split(' ').length;
  state.tier = 3;
  player.phraseId = 0; assignPhrase(state, player);
  equal(player.phrase.split(' ').length < initialWords, true);
  equal(Math.max(...player.phrase.split(' ').map(word => word.length)) >= 12, true);
});

test('Stronghold event changes preserve an in-progress typing phrase', () => {
  const state = createStronghold();
  noBots(state);
  const player = self(state);
  const phrase = player.phrase;
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: phrase.slice(0, 3) });
  state.elapsed = 59.9; state.eventIn = .1;
  advanceStronghold(state, .25);
  equal(player.phrase, phrase);
  equal(player.typed, phrase.slice(0, 3));
  finish(state);
  equal(state.event, 'left-hand');
  equal(player.phrase.includes('We ') || player.phrase.includes('Steward'), true);
});

test('Stronghold simulated economy builds a connected relay network while the human commands the army', () => {
  const state = createStronghold();
  state.resources = 2000;
  state.waveIn = 10000;
  executeCommand(state, self(state), { type: 'ROLE', role: 'army' });
  const teammate = state.players.find(player => player.id === 'bot-2');
  if (!teammate) throw new Error('Missing teammate.');
  executeCommand(state, teammate, { type: 'ROLE', role: 'economy' });
  for (let index = 0; index < 400; index++) advanceStronghold(state, .5);
  equal(state.buildings.some(building => building.kind === 'relay'), true);
  equal(connectedRelays(state).length > 1, true);
  equal(state.units.filter(unit => unit.kind === 'worker').length, 5);
});

test('Stronghold later waves introduce ranged and siege enemy formations', () => {
  const state = createStronghold();
  state.wave = 2;
  spawnWave(state);
  equal(state.units.some(unit => unit.kind === 'invader' && unit.formation === 'archer'), true);
  state.units = [];
  state.wave = 5;
  spawnWave(state);
  equal(state.units.some(unit => unit.kind === 'invader' && unit.formation === 'catapult'), true);
});

test('Stronghold can win a complete match with human supply typing and a simulated squad', () => {
  const state = createStronghold();
  const player = self(state);
  for (let step = 0; step < 2400 && state.phase !== 'won' && state.phase !== 'lost'; step++) {
    if (state.phase === 'playing' && state.tier < 3 && !player.ready) executeCommand(state, player, { type: 'READY', ready: true });
    if (state.phase === 'tier-up' && player.contribution < TIER_QUOTA && step % 10 === 0) finish(state);
    if (state.phase === 'playing' && state.tier === 3 && step % 16 === 0) finish(state);
    advanceStronghold(state, .25);
  }
  equal(state.phase, 'won');
  equal(state.tier, 3);
  equal(state.elapsed < 600, true);
});

test('Stronghold local transport publishes detached snapshots, reports rejections and restarts cleanly', async () => {
  const connection = new LocalStrongholdConnection();
  let emissions = 0;
  let resources = 0;
  const unsubscribe = connection.subscribe(snapshot => {
    emissions++;
    resources = snapshot.resources;
  });
  equal(emissions, 1);
  await connection.send({ type: 'ROLE', role: 'army' });
  equal(emissions, 2);
  let rejected = false;
  try { await connection.send({ type: 'MOVE', ids: [99999], point: { x: 500, y: 100 } }); }
  catch (error) { rejected = error instanceof Error && error.message.includes('friendly'); }
  equal(rejected, true);
  connection.restart();
  equal(resources, 100);
  equal(emissions, 3);
  unsubscribe();
  await connection.send({ type: 'READY', ready: true });
  equal(emissions, 3);
  connection.dispose();
  equal(themeForWorkspace('stronghold'), 'stronghold');
});
