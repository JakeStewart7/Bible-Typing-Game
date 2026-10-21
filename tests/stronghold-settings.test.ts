import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { TIER_CHARACTER_GOAL } from '../src/stronghold/domain/rules.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { addBuilding, createStronghold } from './stronghold-fixtures.ts';
import { PLAYER_COLORS, type Participant, type StrongholdCommand, type StrongholdState } from '../src/stronghold/domain/types.ts';
import { equal, test } from './harness.ts';
import { AppStorage } from '../src/persistence/storage.ts';
import { DEFAULT_DEVELOPER_OPTIONS, readDeveloperOptions, writeDeveloperOptions } from '../src/stronghold/infrastructure/developer-options.ts';
import { isMatchOptions } from '../src/stronghold/domain/options.ts';
import { phraseWork, taskWork } from '../src/stronghold/domain/technology.ts';
import { readyBuilding } from '../src/stronghold/ui/map-controls.ts';

function human(state: StrongholdState): Participant {
  const player = state.players.find(player => player.id === 'you');
  if (!player) throw new Error('Missing human player.');
  return player;
}
function send(state: StrongholdState, command: StrongholdCommand): void {
  executeCommand(state, human(state), command);
}
function entry(state: StrongholdState, player = human(state)): number {
  const points = phraseWork(player);
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  return points;
}
function quietMatch(): StrongholdState {
  const state = createStronghold();
  send(state, { type: 'COMPUTERS', paused: true });
  state.waveIn = 10000;
  return state;
}

test('Stronghold developer defaults are validated, copied and reused by new matches', () => {
  const options = { resources: 175, length: 'short' as const, computersPaused: true };
  const engine = new StrongholdEngine(options);
  options.resources = 0;
  const initial = engine.snapshot('you');
  equal(initial.resources, 175);
  equal(initial.computersPaused, true);
  equal(initial.players.every(player => player.length === 'short'), true);
  engine.send('you', { type: 'COMPUTERS', paused: false });
  engine.restart();
  equal(engine.snapshot('you').resources, 175);
  equal(engine.snapshot('you').computersPaused, true);
  engine.restart({ resources: 0, length: 'extra-long', computersPaused: false });
  equal(engine.snapshot('you').resources, 0);
  equal(engine.snapshot('you').players.every(player => player.length === 'extra-long'), true);
  const before = engine.snapshot('you');
  let rejected = false;
  try { engine.restart({ resources: NaN, length: 'medium', computersPaused: true }); }
  catch (error) { rejected = error instanceof Error && error.message.includes('starting supplies'); }
  equal(rejected, true);
  equal(engine.snapshot('you'), before);
  for (const value of [null, {}, { resources: -1, length: 'short', computersPaused: false },
    { resources: 10001, length: 'short', computersPaused: false },
    { resources: 1.5, length: 'short', computersPaused: false },
    { resources: 50, length: 'invalid', computersPaused: false },
    { resources: 50, length: 'short', computersPaused: 'true' }]) equal(isMatchOptions(value), false);
});

test('Stronghold developer defaults persist independently of the current match and tolerate obsolete stored data', () => {
  const values = new Map<string, string>();
  const storage = new AppStorage({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); }
  });
  equal(readDeveloperOptions(storage), DEFAULT_DEVELOPER_OPTIONS);
  const options = { resources: 25, length: 'long' as const, computersPaused: true, mapZoom: 1.5, playerColor: PLAYER_COLORS.Green };
  writeDeveloperOptions(storage, options);
  equal(readDeveloperOptions(storage), options);
  const saved = readDeveloperOptions(storage);
  saved.resources = 100;
  equal(readDeveloperOptions(storage).resources, 25);
  values.set('stronghold-developer-options', '{"resources":25,"length":"long","computersPaused":true}');
  equal(readDeveloperOptions(storage), { ...options, mapZoom: 1.2, playerColor: PLAYER_COLORS.Red });
  values.set('stronghold-developer-options', JSON.stringify({ ...options, playerColor: 'invalid' }));
  equal(readDeveloperOptions(storage), DEFAULT_DEVELOPER_OPTIONS);
  values.set('stronghold-developer-options', '{"length":"obsolete"}');
  equal(readDeveloperOptions(storage), DEFAULT_DEVELOPER_OPTIONS);
});

test('Stronghold saved player colors survive restarts and keep teammate colors distinct', () => {
  for (const playerColor of Object.values(PLAYER_COLORS)) {
    const engine = new StrongholdEngine({ ...DEFAULT_DEVELOPER_OPTIONS, playerColor });
    for (let match = 0; match < 2; match++) {
      const snapshot = engine.snapshot('you');
      equal(snapshot.players.find(player => player.id === 'you')?.color, playerColor);
      equal(new Set(snapshot.players.map(player => player.color)).size, 4);
      engine.restart();
    }
  }
  equal(isMatchOptions({ ...DEFAULT_DEVELOPER_OPTIONS, playerColor: '#ffffff' }), false);
});

test('Stronghold starts with 50 supplies, Medium text and running computers, and restart clears task banks', () => {
  const engine = new StrongholdEngine();
  engine.send('you', { type: 'SET_SEASON', season: 'summer' });
  const initial = engine.snapshot('you');
  equal(initial.resources, 50);
  equal(initial.tier, 0);
  equal(initial.buildings.every(building => building.tier === 1), true);
  equal(initial.event, 'peace');
  equal(initial.eventIn, 60);
  equal(initial.computersPaused, false);
  equal(initial.players.every(player => player.length === 'medium'), true);
  const player = initial.players.find(player => player.id === 'you');
  if (!player) throw new Error('Missing player.');
  const points = phraseWork(player);
  engine.send('you', { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  const snapshot = engine.snapshot('you');
  equal(snapshot.roleTasks.economy.progress.resources?.work, points);
  if (!snapshot.roleTasks.economy.progress.resources) throw new Error('Missing saved work.');
  snapshot.roleTasks.economy.progress.resources.work = 500;
  equal(engine.snapshot('you').roleTasks.economy.progress.resources?.work, points);
  equal(JSON.stringify(snapshot.roleTasks).includes('phrase'), false);
  engine.send('you', { type: 'COMPUTERS', paused: true });
  engine.restart();
  const restarted = engine.snapshot('you');
  equal(restarted.tier, 0);
  equal(restarted.buildings.every(building => building.tier === 1), true);
  equal(restarted.computersPaused, false);
  equal(restarted.roleTasks.economy.progress.resources?.work, 0);
  equal(restarted.players.every(player => player.work === 0 && player.length === 'medium'), true);
});

test('Stronghold each task retains completed work across task changes and a vacant role', () => {
  const state = quietMatch();
  const player = human(state);
  const suppliesWork = entry(state);
  const oldId = player.phraseId;
  send(state, { type: 'ACTION', action: 'worker' });
  equal(player.work, 0);
  let workerWork = Math.round((entry(state) + entry(state)) * 100) / 100;
  equal(player.work, workerWork);
  send(state, { type: 'ACTION', action: 'resources' });
  equal(player.work, suppliesWork);
  equal(player.actionPhrases, 1);
  send(state, { type: 'ROLE', role: 'army' });
  equal(state.players.some(other => other.role === 'economy'), false);
  equal(player.work, 0);
  const armyWork = entry(state);
  equal(player.work, armyWork);
  send(state, { type: 'ROLE', role: 'economy' });
  equal(player.action, 'resources');
  equal(player.work, suppliesWork);
  send(state, { type: 'ACTION', action: 'worker' });
  equal(player.work, workerWork);
  equal(player.actionPhrases, 2);
  equal(player.phraseId > oldId, true);
  send(state, { type: 'ROLE', role: 'defenses' });
  send(state, { type: 'ROLE', role: 'economy' });
  equal(player.action, 'worker');
  equal(player.work, workerWork);
  while (workerWork < 32) workerWork = Math.round((workerWork + entry(state)) * 100) / 100;
  workerWork = Math.round((workerWork - 32) * 100) / 100;
  equal(player.work, workerWork);
  equal(state.units.filter(unit => unit.kind === 'worker').length, 3);
  send(state, { type: 'ACTION', action: 'resources' });
  equal(player.work, suppliesWork);
  send(state, { type: 'ACTION', action: 'worker' });
  equal(player.work, workerWork);
});

test('Stronghold restored task work remains shared when teammates select tasks and join or leave roles', () => {
  const state = quietMatch();
  const you = human(state);
  const teammate = state.players.find(player => player.id === 'bot-1');
  if (!teammate) throw new Error('Missing teammate.');
  executeCommand(state, teammate, { type: 'ROLE', role: 'economy' });
  let suppliesWork = entry(state);
  executeCommand(state, teammate, { type: 'ACTION', action: 'worker' });
  let workerWork = entry(state, teammate);
  equal(you.work, workerWork);
  send(state, { type: 'ACTION', action: 'resources' });
  equal(teammate.work, suppliesWork);
  equal(teammate.action, 'resources');
  suppliesWork = Math.round((suppliesWork + entry(state, teammate)) * 100) / 100;
  equal(you.work, suppliesWork);
  send(state, { type: 'ROLE', role: 'army' });
  executeCommand(state, teammate, { type: 'ACTION', action: 'worker' });
  workerWork = Math.round((workerWork + entry(state, teammate)) * 100) / 100;
  send(state, { type: 'ROLE', role: 'economy' });
  equal(you.work, workerWork);
  equal(you.phrase !== teammate.phrase, true);
  send(state, { type: 'ACTION', action: 'resources' });
  equal(you.work, suppliesWork);
  equal(teammate.work, suppliesWork);
});

test('Stronghold construction tiers keep independent bars and instant upgrades leave typing progress untouched', () => {
  const state = quietMatch();
  state.tier = 3;
  state.resources = 1000;
  const player = human(state);
  send(state, { type: 'ROLE', role: 'defenses' });
  send(state, { type: 'ACTION', action: 'tower', tier: 1 });
  for (let index = 0; index < 4; index++) entry(state);
  const tower1Work = player.work;
  equal(tower1Work >= 25, true);
  send(state, { type: 'ACTION', action: 'tower', tier: 2 });
  const tower2Work = entry(state);
  equal(player.work, tower2Work);
  const phraseId = player.phraseId;
  const phrase = player.phrase;
  send(state, { type: 'TYPE', phraseId, text: phrase.slice(0, 2) });
  send(state, { type: 'ACTION', action: 'upgrade', upgrade: 'tower-1' });
  send(state, { type: 'ACTION', action: 'upgrade', upgrade: 'tower-2' });
  equal(state.resources, 800);
  equal(player.phraseId, phraseId);
  equal(player.typed, phrase.slice(0, 2));
  equal(player.work, tower2Work);
  equal(state.technology['tower-1'], 1);
  equal(state.technology['tower-2'], 1);
  equal(state.roleTasks.defenses.progress['upgrade:tower-1'], undefined);
  send(state, { type: 'ACTION', action: 'tower', tier: 1 });
  equal(player.work, tower1Work);
  send(state, { type: 'PLACE', kind: 'tower', point: { x: 300, y: 500 } });
  equal(player.work, Math.round((tower1Work - 25) * 100) / 100);
  equal(state.resources, 800);
  send(state, { type: 'ACTION', action: 'tower', tier: 2 });
  equal(player.work, tower2Work);
  send(state, { type: 'ACTION', action: 'upgrade', upgrade: 'tower-1' });
  equal(player.work, tower2Work);
  send(state, { type: 'ACTION', action: 'upgrade', upgrade: 'tower-2' });
  equal(player.work, tower2Work);
  equal(state.resources, 600);
  equal(state.technology['tower-2'], 2);
  send(state, { type: 'ROLE', role: 'production' });
  send(state, { type: 'ACTION', action: 'barracks', tier: 1 });
  const barracks1Work = entry(state);
  send(state, { type: 'ACTION', action: 'barracks', tier: 3 });
  const barracks3Work = Math.round((entry(state) + entry(state)) * 100) / 100;
  send(state, { type: 'ACTION', action: 'barracks', tier: 1 });
  equal(player.work, barracks1Work);
  send(state, { type: 'ACTION', action: 'barracks', tier: 3 });
  equal(player.work, barracks3Work);
});

test('Stronghold Army prepares Barracks at Tier 0 and places them after the first shared challenge', () => {
  const engine = new StrongholdEngine({ resources: 50, length: 'medium', computersPaused: false });
  const self = () => engine.snapshot('you').players.find(player => player.id === 'you')!;
  engine.send('you', { type: 'ROLE', role: 'production' });
  equal(self().action, 'barracks');
  equal(self().constructionTier, 1);
  const phrase = self().phrase;
  engine.send('you', { type: 'TYPE', phraseId: self().phraseId, text: phrase.slice(0, 2) });
  for (let second = 0; second < 15; second++) engine.advance(1);
  equal(self().work >= 40, true);
  equal(self().phrase, phrase);
  equal(self().typed, phrase.slice(0, 2));
  equal(engine.snapshot('you').events.some(event => event.playerId === 'bot-1' && event.text.includes('gathered Supplies')), false);
  equal(engine.snapshot('you').tier, 0);
  equal(readyBuilding(engine.snapshot('you')), null);
  let locked = false;
  try { engine.send('you', { type: 'PLACE', kind: 'barracks', point: { x: 620, y: 570 } }); }
  catch (error) { locked = error instanceof Error && error.message.includes('tier 1'); }
  equal(locked, true);
  const preparedWork = self().work;
  engine.send('you', { type: 'COMPUTERS', paused: true });
  engine.send('you', { type: 'READY', ready: true });
  for (let index = 0; engine.snapshot('you').phase === 'tier-up' && index < TIER_CHARACTER_GOAL; index++) {
    engine.send('you', { type: 'TYPE', phraseId: self().phraseId, text: self().phrase });
  }
  equal(engine.snapshot('you').tier, 1);
  equal(self().work, preparedWork);
  equal(readyBuilding(engine.snapshot('you')), 'barracks');
  const supplies = engine.snapshot('you').resources;
  const work = self().work;
  engine.send('you', { type: 'PLACE', kind: 'barracks', point: { x: 620, y: 570 } });
  equal(self().work, Math.round((work - 40) * 100) / 100);
  equal(engine.snapshot('you').resources, supplies);
  equal(engine.snapshot('you').buildings.some(building => building.kind === 'barracks' && building.tier === 1), true);
  engine.send('you', { type: 'ACTION', action: 'barracks', tier: 2 });
  for (let count = 0; self().work < 80; count++) {
    if (count > 20) throw new Error('Barracks task did not fill.');
    engine.send('you', { type: 'TYPE', phraseId: self().phraseId, text: self().phrase });
  }
  equal(readyBuilding(engine.snapshot('you')), null);
  let rejected = false;
  try { engine.send('you', { type: 'PLACE', kind: 'barracks', point: { x: 750, y: 570 } }); }
  catch (error) { rejected = error instanceof Error && error.message.includes('tier 2'); }
  equal(rejected, true);
});

test('Stronghold running computers contribute to each selected Barracks tier without replacing human selection or input', () => {
  const state = quietMatch();
  state.tier = 3;
  send(state, { type: 'ROLE', role: 'production' });
  send(state, { type: 'COMPUTERS', paused: false });
  const player = human(state);
  const partner = state.players.find(other => other.simulated && other.role === 'production')!;
  for (const tier of [1, 2, 3]) {
    send(state, { type: 'ACTION', action: 'barracks', tier });
    send(state, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase.slice(0, 2) });
    const privateInput = { phraseId: player.phraseId, phrase: player.phrase, typed: player.typed };
    const work = player.work, reward = phraseWork(partner), completed = partner.completed;
    for (let step = 0; step < 20 && partner.completed === completed; step++) advanceStronghold(state, .25);
    equal(partner.completed, completed + 1);
    equal([player.action, player.constructionTier, partner.action, partner.constructionTier], ['barracks', tier, 'barracks', tier]);
    equal([player.work, partner.work], [Math.round((work + reward) * 100) / 100, Math.round((work + reward) * 100) / 100]);
    equal({ phraseId: player.phraseId, phrase: player.phrase, typed: player.typed }, privateInput);
  }
});

test('Stronghold all three Barracks selections preserve independent shared progress and exact placement overflow', () => {
  const state = quietMatch();
  state.tier = 3;
  state.resources = 1000;
  send(state, { type: 'ROLE', role: 'production' });
  const player = human(state);
  const partner = state.players.find(other => other.id !== player.id && other.role === 'production');
  if (!partner) throw new Error('Missing production teammate.');
  const banks = new Map<number, number>();
  for (const tier of [1, 2, 3]) {
    send(state, { type: 'ACTION', action: 'barracks', tier });
    equal([player.action, partner.action], ['barracks', 'barracks']);
    equal([player.constructionTier, partner.constructionTier], [tier, tier]);
    equal([player.work, partner.work], [0, 0]);
    equal(taskWork(player), 40 * tier);
    send(state, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase.slice(0, 2) });
    const privateInput = { phrase: player.phrase, phraseId: player.phraseId, typed: player.typed };
    let work = entry(state, partner);
    equal({ phrase: player.phrase, phraseId: player.phraseId, typed: player.typed }, privateInput);
    equal([player.work, partner.work], [work, work]);
    work = Math.round((work + entry(state)) * 100) / 100;
    equal(state.roleTasks.production.progress[`barracks:${tier}`], { work, actionPhrases: 2 });
    banks.set(tier, work);
  }
  send(state, { type: 'ROLE', role: 'economy' });
  executeCommand(state, partner, { type: 'ACTION', action: 'barracks', tier: 2 });
  send(state, { type: 'ROLE', role: 'production' });
  equal(player.constructionTier, 2);
  equal(player.work, banks.get(2));
  for (const tier of [1, 2, 3]) {
    send(state, { type: 'ACTION', action: 'barracks', tier });
    let expected = banks.get(tier)!;
    equal([player.work, partner.work], [expected, expected]);
    for (let entries = 0; expected < 40 * tier && entries < 40 * tier; entries++) {
      expected = Math.round((expected + entry(state)) * 100) / 100;
      equal([player.work, partner.work], [expected, expected]);
    }
    equal(expected >= 40 * tier, true);
    entry(state, partner);
    equal([player.work, partner.work], [expected, expected]);
    send(state, { type: 'PLACE', kind: 'barracks', point: { x: 620 + (tier - 1) * 70, y: 570 } });
    expected = Math.round((expected - 40 * tier) * 100) / 100;
    equal([player.work, partner.work], [expected, expected]);
    equal(state.roleTasks.production.progress[`barracks:${tier}`], { work: expected, actionPhrases: 0 });
    equal(state.resources, 1000);
    banks.set(tier, expected);
  }
  equal(state.buildings.filter(building => building.kind === 'barracks').map(building => building.tier), [1, 2, 3]);
  for (const tier of [3, 1, 2]) {
    send(state, { type: 'ACTION', action: 'barracks', tier });
    equal([player.work, partner.work], [banks.get(tier), banks.get(tier)]);
  }
});

test('Stronghold shared tier challenges preserve normal task banks and the chosen text length', () => {
  const state = quietMatch();
  const player = human(state);
  const suppliesWork = entry(state);
  send(state, { type: 'ACTION', action: 'worker' });
  const workerWork = Math.round((entry(state) + entry(state)) * 100) / 100;
  send(state, { type: 'READY', ready: true });
  equal(state.phase, 'tier-up');
  send(state, { type: 'LENGTH', length: 'long' });
  for (let index = 0; state.phase === 'tier-up' && index < TIER_CHARACTER_GOAL; index++) entry(state, state.players[index % state.players.length]!);
  equal(state.phase, 'playing');
  equal(state.tier, 1);
  equal(player.action, 'worker');
  equal(player.work, workerWork);
  equal(player.length, 'long');
  send(state, { type: 'ACTION', action: 'resources' });
  equal(player.work, suppliesWork);
  equal(player.length, 'long');
});

test('Stronghold stopping computers freezes their decisions and barracks, but not human typing or the battlefield', () => {
  const state = createStronghold();
  state.tier = 1;
  state.waveIn = 10000;
  const computerBarracks = addBuilding(state, 'barracks', { x: 650, y: 550 }, true);
  computerBarracks.ownerId = 'bot-1';
  computerBarracks.cooldown = 5;
  computerBarracks.trainingQueue.push({ kind: 'warrior', playerId: 'bot-1' });
  const humanBarracks = addBuilding(state, 'barracks', { x: 350, y: 550 }, true);
  humanBarracks.ownerId = 'you';
  humanBarracks.trainingQueue.push({ kind: 'warrior', playerId: 'you' });
  humanBarracks.cooldown = 10;
  advanceStronghold(state, .1);
  send(state, { type: 'COMPUTERS', paused: true });
  const computers = structuredClone(state.players.filter(player => player.simulated));
  const cooldown = computerBarracks.cooldown;
  humanBarracks.cooldown = 0;
  const units = state.units.length;
  const time = state.elapsed;
  advanceStronghold(state, .25);
  equal(state.players.filter(player => player.simulated), computers);
  equal(computerBarracks.cooldown, cooldown);
  equal(state.units.length, units + 1);
  equal(state.elapsed, time + .25);
  equal(state.events.at(-1)?.playerId, 'you');
  const beforeWork = human(state).work;
  const points = entry(state);
  equal(human(state).work, Math.round((beforeWork + points) * 100) / 100);
  send(state, { type: 'COMPUTERS', paused: false });
  advanceStronghold(state, .1);
  equal(computerBarracks.cooldown < cooldown, true);
  equal(state.players.some(player => player.simulated && player.typingCredit !== computers.find(other => other.id === player.id)?.typingCredit), true);
  equal(state.events.some(event => event.text === 'Computers stopped' && event.playerId === null), true);
  equal(state.events.some(event => event.text === 'Computers resumed' && event.playerId === null), true);
});

test('Stronghold stopped computers do not block a solo shared tier challenge', () => {
  const state = quietMatch();
  send(state, { type: 'READY', ready: true });
  for (let index = 0; index < 10; index++) advanceStronghold(state, .25);
  equal(state.phase, 'tier-up');
  equal(state.players.filter(player => player.simulated).every(player => player.ready && player.typingCredit === 0), true);
  const computers = structuredClone(state.players.filter(player => player.simulated));
  for (let index = 0; index < 5; index++) entry(state);
  const time = state.elapsed;
  for (let index = 0; index < 10; index++) advanceStronghold(state, .25);
  equal(state.elapsed, time);
  equal(state.players.filter(player => player.simulated), computers);
  for (let index = 0; state.phase === 'tier-up' && index < TIER_CHARACTER_GOAL; index++) entry(state);
  equal(state.tier, 1);
  equal(state.phase, 'playing');
});

test('Stronghold world events start exactly at odd minutes and end after 35 seconds without timer drift', () => {
  const state = quietMatch();
  state.elapsed = 59.998;
  advanceStronghold(state, .001);
  equal(state.event, 'peace');
  advanceStronghold(state, .001);
  equal(state.event, 'left-hand');
  equal(state.eventIn, 35);
  state.elapsed = 94.998;
  advanceStronghold(state, .001);
  equal(state.event, 'left-hand');
  advanceStronghold(state, .001);
  equal(state.event, 'peace');
  equal(state.eventIn, 85);
  for (const [start, event] of [[180, 'vowels'], [300, 'numbers'], [420, 'symbols'], [540, 'code'], [660, 'left-hand']] as const) {
    state.elapsed = start - .001;
    advanceStronghold(state, .001);
    equal(state.event, event);
    equal(state.eventIn, 35);
    state.elapsed = start + 35 - .001;
    advanceStronghold(state, .001);
    equal(state.event, 'peace');
    equal(state.eventIn, 85);
  }
  equal(state.events.filter(event => event.text === 'World event ended').length, 6);
  const frames = quietMatch();
  for (let index = 0; index < 3600; index++) advanceStronghold(frames, 1 / 60);
  equal(frames.event, 'left-hand');
  equal(frames.eventIn, 35);
});

test('Stronghold event end preserves in-progress typing and keeps subsequent entries as normal words', () => {
  const state = quietMatch();
  state.elapsed = 59.999;
  advanceStronghold(state, .001);
  const player = human(state);
  const { phrase, phraseId } = player;
  send(state, { type: 'TYPE', phraseId, text: phrase.slice(0, 2) });
  state.elapsed = 94.999;
  advanceStronghold(state, .001);
  equal(state.event, 'peace');
  equal(player.phrase, phrase);
  equal(player.phraseId, phraseId);
  equal(player.typed, phrase.slice(0, 2));
  equal(state.message, '');
  const points = entry(state);
  equal(player.work, points);
  equal(/^[a-z]+(?: [a-z]+)*$/.test(player.phrase), true);
});
