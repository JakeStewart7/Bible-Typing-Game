import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { actionProblem, executeCommand } from '../src/stronghold/domain/actions.ts';
import { updateCombat, spawnWave } from '../src/stronghold/domain/combat.ts';
import { connectedRelays, updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { addBuilding, addUnit, createStronghold } from './stronghold-fixtures.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { TEXT_LENGTH_RANGES, TIER_CHARACTER_GOAL } from '../src/stronghold/domain/rules.ts';
import { LocalStrongholdConnection } from '../src/stronghold/infrastructure/local-connection.ts';
import { themeForWorkspace } from '../src/ui/page-theme.ts';
import type { Participant, StrongholdState } from '../src/stronghold/domain/types.ts';
import { equal, test } from './harness.ts';
import { phraseWork, taskWork } from '../src/stronghold/domain/technology.ts';
import { EVENT_WORD_POOLS } from '../src/stronghold/domain/event-phrases.ts';
import { WORD_POOLS } from '../src/stronghold/domain/word-pools.ts';

function self(state: StrongholdState): Participant {
  const player = state.players.find(candidate => candidate.id === 'you');
  if (!player) throw new Error('Missing test player.');
  return player;
}
function finish(state: StrongholdState, player = self(state)): void {
  for (let entry = 0; entry < 100; entry++) {
    const done = state.phase === 'tier-up' || player.work + phraseWork(player) >= taskWork(player);
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
    if (done) return;
  }
  throw new Error('Typing task failed to complete.');
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
  equal(engine.snapshot('you').resources, 50);
  equal(engine.snapshot('you').units.length, 5);
  rejects(() => engine.snapshot('stranger'), 'Unknown');
});

test('Stronghold typing requires exact phrase and rejects expired phrase IDs', () => {
  const state = createStronghold();
  const player = self(state);
  const phraseId = player.phraseId;
  executeCommand(state, player, { type: 'TYPE', phraseId, text: player.phrase.toUpperCase() });
  equal(state.resources, 50);
  finish(state);
  equal(state.resources, 68);
  rejects(() => executeCommand(state, player, { type: 'TYPE', phraseId, text: 'old' }), 'expired');
  rejects(() => executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase + 'x' }), 'Invalid');
});

test('Stronghold role selection joins teammates without displacing them', () => {
  const state = createStronghold();
  executeCommand(state, self(state), { type: 'ROLE', role: 'army' });
  equal(self(state).role, 'army');
  equal(state.players.find(player => player.id === 'bot-2')?.role, 'army');
  equal(new Set(state.players.map(player => player.role)).size, 3);
  finish(state);
  equal(state.resources, 68);
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'tower' }), 'another role');
});

test('Stronghold tier-up waits for readiness, pauses battle and accepts unequal shared contributions', () => {
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
  let characters = 0;
  for (let index = 0; index < 5; index++) { characters += first.phrase.length; finish(state, first); }
  equal(first.contribution, characters);
  equal(state.tier, 0);
  for (let index = 0; state.phase === 'tier-up' && index < TIER_CHARACTER_GOAL; index++) finish(state, state.players[1]);
  equal(state.players.reduce((sum, player) => sum + player.contribution, 0), TIER_CHARACTER_GOAL);
  equal(state.tier, 1);
  equal(state.phase, 'playing');
  equal(state.players.every(player => !player.ready), true);
});

test('Stronghold simulated teammates ready up and finish their own tier phrases', () => {
  const state = createStronghold();
  executeCommand(state, self(state), { type: 'READY', ready: true });
  advanceStronghold(state, .25);
  equal(state.phase, 'tier-up');
  for (let index = 0; index < 5; index++) finish(state);
  for (let index = 0; index < 160; index++) advanceStronghold(state, .25);
  equal(state.tier, 1);
  equal(state.phase, 'playing');
});

test('Stronghold each shared challenge advances exactly one tier without chaining or accepting the final phrase twice', () => {
  const state = createStronghold({ resources: 50, length: 'medium', computersPaused: true });
  state.waveIn = 10000;
  const player = self(state);
  equal(state.tier, 0);
  for (const tier of [1, 2, 3]) {
    executeCommand(state, player, { type: 'READY', ready: true });
    equal(state.phase, 'tier-up');
    equal(state.players.every(other => other.contribution === 0), true);
    for (let entry = 0; player.contribution + player.phrase.length < TIER_CHARACTER_GOAL && entry < TIER_CHARACTER_GOAL; entry++) finish(state);
    equal(state.phase, 'tier-up');
    equal(state.tier, tier - 1);
    const finalPhrase = { type: 'TYPE' as const, phraseId: player.phraseId, text: player.phrase };
    executeCommand(state, player, finalPhrase);
    equal(state.phase, 'playing');
    equal(state.tier, tier);
    equal(player.contribution, TIER_CHARACTER_GOAL);
    equal(state.players.every(other => !other.ready), true);
    rejects(() => executeCommand(state, player, finalPhrase), 'expired');
    executeCommand(state, player, { type: 'COMPUTERS', paused: false });
    for (let step = 0; step < 120; step++) advanceStronghold(state, .25);
    equal(state.phase, 'playing');
    equal(state.tier, tier);
    equal(state.players.every(other => !other.ready), true);
    equal(state.events.filter(event => /^Tier \d unlocked$/.test(event.text)).length, tier);
    executeCommand(state, player, { type: 'COMPUTERS', paused: true });
  }
  rejects(() => executeCommand(state, player, { type: 'READY', ready: true }), 'not available');
});

test('Stronghold building placement costs once and waits for a nearby builder', () => {
  const state = createStronghold({ resources: 100, length: 'medium', computersPaused: true });
  executeCommand(state, self(state), { type: 'ACTION', action: 'relay' });
  equal(state.resources, 100);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'relay', point: { x: 380, y: 540 } });
  equal(state.resources, 70);
  const relay = state.buildings.find(building => building.kind === 'relay');
  equal(relay?.progress, 0);
  for (let index = 0; index < 60; index++) updateLogistics(state, .25);
  equal(relay?.progress, 1);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'relay', point: { x: 650, y: 540 } });
  equal(state.resources, 40);
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
  state.resources = 1000;
  executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade' });
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade' }), 'Upgrade limit');
  equal(state.upgrades.economy, 2);
  equal(state.resources, 760);
  executeCommand(state, self(state), { type: 'ACTION', action: 'worker' });
  while (state.units.filter(unit => unit.kind === 'worker').length < 12) finish(state);
  const resources = state.resources;
  finish(state);
  equal(state.units.filter(unit => unit.kind === 'worker').length, 12);
  equal(state.resources, resources);
  equal(self(state).work >= 32, true);
  const cappedWork = self(state).work;
  finish(state);
  equal(self(state).work, cappedWork);
});

test('Stronghold towers have 50 percent more health across tiers, sides and construction states', () => {
  const state = createStronghold();
  for (const enemy of [false, true]) {
    for (const complete of [false, true]) {
      for (const tier of [1, 2, 3]) {
        const tower = addBuilding(state, 'tower', { x: 300, y: 400 }, complete, enemy, tier);
        const expected = (160 + 60 * (tier - 1)) * 1.5;
        equal(tower.hp, expected);
        equal(tower.maxHp, expected);
      }
    }
  }
  equal(state.buildings.filter(building => building.enemy && building.kind === 'tower').slice(0, 2).map(tower => tower.maxHp), [240, 240]);
  equal(addBuilding(state, 'barracks', { x: 300, y: 400 }, true, false, 3).maxHp, 240);
  equal(addBuilding(state, 'wall', { x: 300, y: 400 }).maxHp, 260);
  const waveState = createStronghold();
  waveState.wave = 2;
  spawnWave(waveState);
  equal(waveState.buildings.filter(building => building.enemy && building.kind === 'tower').map(tower => tower.maxHp), [240, 240, 240]);
});

test('Stronghold tower damage scales by 1.5 including upgrades and waves without changing attack timing', () => {
  for (const enemy of [false, true]) {
    for (const tier of [1, 2, 3]) {
      for (const upgrades of [0, 2]) {
        const state = createStronghold();
        state.units = [];
        state.buildings = [];
        state.wave = 4;
        state.technology['tower-1'] = upgrades;
        state.technology['tower-2'] = upgrades;
        state.technology['tower-3'] = upgrades;
        const tower = addBuilding(state, 'tower', { x: 500, y: 400 }, true, enemy, tier);
        const target = addUnit(state, enemy ? 'worker' : 'invader', { x: 550, y: 400 });
        const startingHp = target.hp;
        const damage = (enemy ? 8 + state.wave : 18 + tier * 3 + upgrades * 5) * 1.5;
        updateCombat(state, .1);
        equal(startingHp - target.hp, damage);
        equal(tower.cooldown, 1);
        equal(tower.attackTarget, { x: target.x, y: target.y });
        updateCombat(state, .5);
        equal(startingHp - target.hp, damage);
        updateCombat(state, .5);
        equal(startingHp - target.hp, damage * 2);
      }
    }
  }
});

test('Stronghold relay destruction disconnects upstream resources until a route is restored', () => {
  const state = createStronghold();
  state.units = [];
  const first = addBuilding(state, 'relay', { x: 500, y: 450 }, true);
  const upstream = addBuilding(state, 'relay', { x: 500, y: 305 }, true);
  equal(connectedRelays(state).length, 3);
  state.chunks = [{ id: 99, x: 500, y: 305, amount: 8, rich: true, target: upstream.id, carrier: null }];
  first.hp = 0;
  updateLogistics(state, .5);
  equal(state.chunks[0]?.y, 305);
  equal(state.resources, 50);
  first.hp = first.maxHp;
  for (let index = 0; index < 60; index++) updateLogistics(state, .25);
  equal(state.resources, 58);
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
  rejects(() => executeCommand(state, self(state), { type: 'MOVE', ids: [warrior.id], point: { x: 500, y: 100 } }), 'Unit Control');
  executeCommand(state, self(state), { type: 'ROLE', role: 'army' });
  executeCommand(state, self(state), { type: 'MOVE', ids: [warrior.id], point: { x: 500, y: 100 } });
  equal(warrior.destination, { x: 500, y: 100 });
  rejects(() => executeCommand(state, self(state), { type: 'RALLY', point: { x: Infinity, y: 100 } }), 'inside');
  rejects(() => executeCommand(state, self(state), { type: 'MOVE', ids: [99999], point: { x: 500, y: 100 } }), 'friendly');
});

test('Stronghold barracks require explicit paid queues and completed matching construction', () => {
  const state = createStronghold();
  noBots(state); state.tier = 2;
  state.units = [];
  const barracks = addBuilding(state, 'barracks', { x: 650, y: 570 });
  advanceStronghold(state, .1);
  equal(state.units.length, 0);
  executeCommand(state, self(state), { type: 'ROLE', role: 'production' });
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'archer' }), 'Barracks');
  barracks.progress = 1;
  executeCommand(state, self(state), { type: 'ACTION', action: 'archer' });
  equal(state.units.length, 0);
  for (let second = 0; second < 12; second++) advanceStronghold(state, 1);
  equal(state.units[0]?.kind, 'archer');
  equal(state.resources, 5);
  equal(state.units[0]?.destination, state.rally);
});

test('Stronghold waves grow enemy defenses, world events change drills and terminal outcomes stop simulation', () => {
  const state = createStronghold();
  noBots(state);
  spawnWave(state); spawnWave(state); spawnWave(state);
  equal(state.wave, 3);
  equal(state.buildings.find(building => building.kind === 'enemy-base')?.tier, 2);
  state.elapsed = 59.9; state.eventIn = .1;
  advanceStronghold(state, .25);
  equal(state.event, 'left-hand');
  equal(/^[a-z]+(?: [a-z]+)*$/.test(self(state).phrase), true);
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

test('Stronghold length selection uses event-specific pools within the requested character ranges', () => {
  const state = createStronghold();
  const player = self(state);
  for (const phase of ['playing', 'tier-up'] as const) for (const event of ['peace', 'left-hand', 'vowels', 'numbers', 'symbols', 'code'] as const) {
    state.phase = phase;
    state.event = event;
    for (const length of ['short', 'medium', 'long', 'extra-long'] as const) {
      for (let index = 0; index < 12; index++) {
        executeCommand(state, player, { type: 'LENGTH', length });
        const [min, max] = TEXT_LENGTH_RANGES[length];
        equal(player.phrase.length >= min && player.phrase.length <= max, true);
        const pool = phase === 'tier-up' || event === 'peace' ? WORD_POOLS[length] : EVENT_WORD_POOLS[event][length];
        equal(pool.includes(player.phrase), true);
      }
    }
  }
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
  equal(/^[a-z]+(?: [a-z]+)*$/.test(player.phrase), true);
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
    if (state.phase === 'tier-up' && player.contribution < TIER_CHARACTER_GOAL / 4 && step % 10 === 0) finish(state);
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
  equal(resources, 50);
  equal(emissions, 3);
  unsubscribe();
  await connection.send({ type: 'READY', ready: true });
  equal(emissions, 3);
  connection.dispose();
  equal(themeForWorkspace('stronghold'), 'stronghold');
});
