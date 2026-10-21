import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { spawnWave, updateCombat } from '../src/stronghold/domain/combat.ts';
import { updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { addBuilding, addUnit, createStronghold } from '../src/stronghold/domain/state.ts';
import { distance, UNIT_RULES } from '../src/stronghold/domain/rules.ts';
import { phraseWork } from '../src/stronghold/domain/technology.ts';
import { buildingMarkup, unitMarkup, unitMotionTransform } from '../src/stronghold/ui/battlefield.ts';
import { equal, test } from './harness.ts';

test('Stronghold opening waves give a full minute to prepare, fewer invaders and longer recovery', () => {
  const state = createStronghold();
  equal(state.waveIn, 60);
  for (let wave = 1; wave <= 25; wave++) {
    state.units = state.units.filter(unit => unit.kind !== 'invader');
    spawnWave(state);
    equal(state.wave, wave);
    equal(state.units.filter(unit => unit.kind === 'invader').length, Math.min(18, Math.max(1, wave - 1)));
    equal(state.waveIn, Math.max(45, 80 - wave * 2));
  }
  for (let index = 0; index < 5; index++) spawnWave(state);
  equal(state.units.filter(unit => unit.kind === 'invader').length, 40);
});

test('Stronghold starting warriors hold off both opening waves without reinforcements or computer help', () => {
  const state = createStronghold({ resources: 50, length: 'medium', computersPaused: true });
  const original = state.units.map(unit => unit.id);
  const warriors = state.units.filter(unit => unit.kind === 'warrior');
  for (let step = 0; step < 2000; step++) advanceStronghold(state, .1);
  equal(state.wave, 2);
  equal(state.phase, 'playing');
  equal(state.units.filter(unit => unit.kind === 'invader').length, 0);
  equal(state.units.map(unit => unit.id), original);
  equal(warriors.length, 2);
  equal(warriors.every(unit => unit.hp > 0), true);
  const castle = state.buildings.find(building => building.kind === 'castle');
  equal(castle?.hp, castle?.maxHp);
});

test('Stronghold Next Wave spawns immediately without advancing battle time or resetting player work', () => {
  const state = createStronghold();
  const player = state.players[0];
  if (!player) throw new Error('Missing player.');
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase.slice(0, 2) });
  const before = structuredClone(state);
  executeCommand(state, player, { type: 'NEXT_WAVE' });
  equal(state.wave, 1);
  equal(state.waveIn, 78);
  equal(state.units.filter(unit => unit.kind === 'invader').length, 1);
  equal(state.events.at(-1)?.text, 'Wave 1 approaching');
  for (const key of ['elapsed', 'event', 'eventIn', 'resources', 'players', 'roleTasks', 'computersPaused'] as const) {
    equal(state[key], before[key]);
  }
  advanceStronghold(state, .25);
  equal(state.wave, 1);
  equal(state.waveIn, 77.75);
  executeCommand(state, player, { type: 'NEXT_WAVE' });
  executeCommand(state, player, { type: 'NEXT_WAVE' });
  equal(state.wave, 3);
  equal(state.buildings.find(building => building.kind === 'enemy-base')?.tier, 2);
});

test('Stronghold Next Wave rejects computers, tier challenges and finished matches without mutation', () => {
  for (const phase of ['playing', 'tier-up', 'won', 'lost'] as const) {
    const state = createStronghold();
    state.phase = phase;
    const player = state.players[phase === 'playing' ? 1 : 0];
    if (!player) throw new Error('Missing player.');
    const before = structuredClone(state);
    let message = '';
    try { executeCommand(state, player, { type: 'NEXT_WAVE' }); }
    catch (error) {
      if (!(error instanceof Error)) throw error;
      message = error.message;
    }
    equal(message, phase === 'playing' ? 'Only a human player can advance waves.'
      : phase === 'tier-up' ? 'Finish the shared tier challenge before advancing waves.'
      : 'This match is over. Start a new stronghold.');
    equal(state, before);
  }
});

test('Stronghold units retain slow movement and double health, with equal opposing warrior stats', () => {
  const original = { worker: [42, 35], builder: [50, 55], warrior: [62, 100],
    archer: [55, 65], catapult: [32, 110], invader: [62, 100] } as const;
  const state = createStronghold();
  state.units = [];
  state.nodes = [{ id: 100, x: 100, y: 500, remaining: 100, rich: false }];
  addBuilding(state, 'barracks', { x: 200, y: 500 });
  for (const kind of ['worker', 'builder', 'warrior', 'archer', 'catapult', 'invader'] as const) {
    equal(Math.abs(UNIT_RULES[kind].speed - original[kind][0] * .3) < .000001, true);
    const unit = addUnit(state, kind, { x: 100, y: 300 });
    equal(unit.maxHp, original[kind][1] * 2);
    unit.destination = { x: 100, y: 500 };
    const start = { x: unit.x, y: unit.y };
    state.units = [unit];
    if (kind === 'worker' || kind === 'builder') updateLogistics(state, 1);
    else updateCombat(state, 1);
    equal(Math.abs(distance(unit, start) - UNIT_RULES[kind].speed) < .000001, true);
  }
  state.wave = 4;
  for (const formation of [null, 'warrior', 'archer', 'catapult'] as const) {
    const unit = addUnit(state, 'invader', { x: 100, y: 100 }, formation);
    equal(unit.maxHp, UNIT_RULES[formation ?? 'invader'].hp * 2);
  }
  equal(state.buildings.find(building => building.kind === 'castle')?.maxHp, 4000);
  equal(state.buildings.find(building => building.kind === 'enemy-base')?.maxHp, 4000);
});

test('Stronghold both bases keep a 4000 HP maximum through enemy upgrades without healing damage', () => {
  const state = createStronghold();
  equal(state.events[0]?.text, 'Game started');
  const bases = state.buildings.filter(building => building.kind === 'castle' || building.kind === 'enemy-base');
  equal(bases.map(base => [base.hp, base.maxHp]), [[4000, 4000], [4000, 4000]]);
  bases.forEach(base => { base.hp -= 100; });
  for (let wave = 0; wave < 6; wave++) spawnWave(state);
  equal(bases.map(base => [base.hp, base.maxHp]), [[3900, 4000], [3900, 4000]]);
});

test('Stronghold gatherers and builders follow move orders then resume nearest work after two idle seconds', () => {
  for (const kind of ['worker', 'builder'] as const) {
    const state = createStronghold();
    const player = state.players[0];
    if (!player) throw new Error('Missing player.');
    executeCommand(state, player, { type: 'ROLE', role: 'army' });
    state.units = [];
    const unit = addUnit(state, kind, { x: 500, y: 300 });
    state.nodes = [{ id: 100, x: 530, y: 300, rich: false, remaining: 100 }];
    const project = addBuilding(state, 'barracks', { x: 530, y: 300 });
    const point = { x: 500, y: 300 + UNIT_RULES[kind].speed };
    executeCommand(state, player, { type: 'MOVE', ids: [unit.id], point });
    updateLogistics(state, .5);
    equal(unit.y > 300 && unit.y < point.y, true);
    equal(unit.destination, point);
    updateLogistics(state, .5);
    equal(unit.destination, null);
    equal(unit.y, point.y);
    for (let step = 0; step < 4; step++) updateLogistics(state, .5);
    equal(unit.x, 500);
    equal(unit.y, point.y);
    equal(project.progress, 0);
    equal(state.nodes[0]?.remaining, 100);
    updateLogistics(state, .1);
    equal(unit.x > 500, true);
    equal(unit.idleTime, null);
    if (kind === 'worker') equal(unit.task, 100);
    for (let step = 0; step < 40; step++) updateLogistics(state, .1);
    if (kind === 'builder') {
      equal(project.progress > 0, true);
      equal(unit.attackTarget, { x: project.x, y: project.y });
      equal(unitMotionTransform(unit, unit, .1).startsWith('translate(0 '), true);
      equal(unitMotionTransform(unit, unit, .1, true), '');
      equal(unitMotionTransform(unit, unit, .1) !== unitMotionTransform(unit, unit, .2), true);
    } else equal(state.nodes[0]?.remaining < 100, true);
  }
});

test('Stronghold manual gatherer movement keeps carried supplies attached and reorders restart the idle timer', () => {
  const state = createStronghold();
  const player = state.players[0];
  if (!player) throw new Error('Missing player.');
  state.units = [];
  const worker = addUnit(state, 'worker', { x: 500, y: 500 });
  state.nodes = [{ id: 100, x: 500, y: 500, rich: false, remaining: 100 }];
  updateLogistics(state, .1);
  executeCommand(state, player, { type: 'ROLE', role: 'army' });
  executeCommand(state, player, { type: 'MOVE', ids: [worker.id], point: { x: 450, y: 500 } });
  updateLogistics(state, 1);
  equal(state.chunks[0]?.x, worker.x);
  equal(state.chunks[0]?.y, worker.y);
  executeCommand(state, player, { type: 'MOVE', ids: [worker.id], point: { x: worker.x, y: worker.y } });
  updateLogistics(state, 1);
  equal(worker.idleTime, 1);
  executeCommand(state, player, { type: 'MOVE', ids: [worker.id], point: { x: worker.x, y: worker.y } });
  updateLogistics(state, 1);
  equal(worker.idleTime, 1);
});

test('Stronghold construction selects the nearest free builder regardless of unit order', () => {
  for (const reverse of [false, true]) {
    const state = createStronghold();
    state.units = [];
    const far = addUnit(state, 'builder', { x: 800, y: 500 });
    const near = addUnit(state, 'builder', { x: 110, y: 300 });
    if (reverse) state.units.reverse();
    const project = addBuilding(state, 'barracks', { x: 100, y: 300 });
    updateLogistics(state, .1);
    equal(near.task, project.id);
    equal(near.attackTarget, { x: project.x, y: project.y });
    equal(project.progress, .1 / 8);
    equal(far.task, null);
    equal({ x: far.x, y: far.y }, { x: 800, y: 500 });
  }
});

test('Stronghold construction assigns distinct nearest builders to multiple pending sites', () => {
  const state = createStronghold();
  state.units = [];
  const right = addUnit(state, 'builder', { x: 800, y: 400 });
  const left = addUnit(state, 'builder', { x: 100, y: 400 });
  const first = addBuilding(state, 'barracks', { x: 110, y: 400 });
  const second = addBuilding(state, 'barracks', { x: 790, y: 400 });
  updateLogistics(state, .1);
  equal(left.task, first.id);
  equal(right.task, second.id);
  equal(first.progress, .1 / 8);
  equal(second.progress, .1 / 8);
});

test('Stronghold busy, manually moving, waiting and dead builders cannot steal a new construction job', () => {
  const state = createStronghold();
  state.units = [];
  const busy = addUnit(state, 'builder', { x: 100, y: 300 });
  const original = addBuilding(state, 'barracks', { x: 105, y: 300 });
  updateLogistics(state, .1);
  const moving = addUnit(state, 'builder', { x: 110, y: 300 });
  moving.destination = { x: 300, y: 300 }; moving.idleTime = 0;
  const waiting = addUnit(state, 'builder', { x: 110, y: 300 });
  waiting.idleTime = 1;
  const dead = addUnit(state, 'builder', { x: 110, y: 300 });
  dead.hp = 0;
  const available = addUnit(state, 'builder', { x: 700, y: 300 });
  const next = addBuilding(state, 'barracks', { x: 110, y: 300 });
  updateLogistics(state, .1);
  equal(busy.task, original.id);
  equal(available.task, next.id);
  equal(moving.task, null);
  equal(waiting.task, null);
  equal(dead.task, null);
  equal(next.progress, 0);
  equal(available.x < 700, true);
});

test('Stronghold builders release completed or destroyed jobs before the next nearest assignment', () => {
  for (const finished of [true, false]) {
    const state = createStronghold();
    state.units = [];
    const near = addUnit(state, 'builder', { x: 110, y: 300 });
    const original = addBuilding(state, 'barracks', { x: 100, y: 300 });
    updateLogistics(state, .1);
    if (finished) original.progress = 1;
    else original.hp = 0;
    const far = addUnit(state, 'builder', { x: 800, y: 500 });
    const next = addBuilding(state, 'barracks', { x: 120, y: 300 });
    updateLogistics(state, .1);
    equal(near.task, next.id);
    equal(far.task, null);
    equal(next.progress, .1 / 8);
  }
});

test('Stronghold gatherers carry a single harvested chunk before returning to a resource node', () => {
  const state = createStronghold();
  state.units = [];
  state.nodes = [{ id: 100, x: 500, y: 500, remaining: 100, rich: false }];
  const worker = addUnit(state, 'worker', { x: 500, y: 500 });
  updateLogistics(state, .1);
  equal(state.resources, 50);
  equal(state.nodes[0]?.remaining, 96);
  equal(state.chunks[0]?.carrier, worker.id);
  equal(worker.attackTarget, { x: 500, y: 500 });
  updateLogistics(state, 1);
  equal(state.chunks.length, 1);
  equal(state.chunks[0]?.y, worker.y);
  equal(state.nodes[0]?.remaining, 96);
  equal(state.resources, 50);
  for (let step = 0; step < 70; step++) updateLogistics(state, .1);
  equal(state.resources, 54);
  equal(state.chunks.length, 0);
  equal(state.nodes[0]?.remaining, 96);
});

test('Stronghold gatherers choose the nearest completed depot and reroute when it is destroyed', () => {
  const state = createStronghold();
  state.units = [];
  state.nodes = [{ id: 100, x: 500, y: 300, remaining: 100, rich: false }];
  const relay = addBuilding(state, 'relay', { x: 500, y: 350 }, true);
  addBuilding(state, 'relay', { x: 500, y: 301 });
  const worker = addUnit(state, 'worker', { x: 500, y: 300 });
  updateLogistics(state, .1);
  for (let step = 0; step < 30; step++) updateLogistics(state, .1);
  equal(state.chunks[0]?.carrier, null);
  equal(state.chunks[0]?.target, relay.id);
  equal(state.chunks[0]?.y, relay.y);
  equal(state.resources, 50);
  relay.hp = 0;
  state.chunks = [];
  worker.x = 500; worker.y = 300; worker.cooldown = 0;
  updateLogistics(state, .1);
  const y = worker.y;
  updateLogistics(state, 1);
  equal(worker.y > y, true);
  equal(state.chunks[0]?.carrier, worker.id);
  equal(state.resources, 50);
});

test('Stronghold dropped cargo survives a gatherer death and routes without duplicate supplies', () => {
  const state = createStronghold();
  state.units = [];
  state.nodes = [{ id: 100, x: 500, y: 540, remaining: 100, rich: false }];
  const worker = addUnit(state, 'worker', { x: 500, y: 540 });
  updateLogistics(state, .1);
  worker.hp = 0;
  for (let step = 0; step < 20; step++) updateLogistics(state, .1);
  equal(state.chunks.length, 0);
  equal(state.resources, 54);
  updateLogistics(state, 1);
  equal(state.resources, 54);
});

test('Stronghold role members keep private text and share completed work and placement without duplicate costs', () => {
  const state = createStronghold();
  state.players.forEach(player => { player.simulated = false; });
  const [you, teammate] = state.players;
  if (!you || !teammate) throw new Error('Missing players.');
  executeCommand(state, you, { type: 'LENGTH', length: 'medium' });
  executeCommand(state, teammate, { type: 'ROLE', role: 'economy' });
  executeCommand(state, teammate, { type: 'LENGTH', length: 'medium' });
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase.slice(0, 5) });
  equal(teammate.typed, '');
  equal(you.phrase !== teammate.phrase, true);
  const partial = you.typed;
  const phrase = you.phrase;
  const oldId = you.phraseId;
  let sharedWork = phraseWork(teammate);
  executeCommand(state, teammate, { type: 'TYPE', phraseId: teammate.phraseId, text: teammate.phrase });
  equal(state.resources, 50);
  equal(you.work, sharedWork);
  equal(you.typed, partial);
  equal(you.phrase, phrase);
  equal(you.phraseId, oldId);
  const teammatePhrase = teammate.phrase;
  const teammateId = teammate.phraseId;
  executeCommand(state, teammate, { type: 'TYPE', phraseId: teammateId, text: teammatePhrase.slice(0, 2) });
  sharedWork = Math.round((sharedWork + phraseWork(you)) * 100) / 100;
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  equal(state.resources, 50);
  equal(you.typed, '');
  equal(teammate.phrase, teammatePhrase);
  equal(teammate.phraseId, teammateId);
  equal(teammate.typed, teammatePhrase.slice(0, 2));
  for (const player of [you, teammate]) {
    sharedWork = Math.round((sharedWork + phraseWork(player)) * 100) / 100;
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  }
  while (sharedWork < 32) {
    sharedWork = Math.round((sharedWork + phraseWork(you)) * 100) / 100;
    executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  }
  equal(state.resources, 68);
  equal(you.work, Math.round((sharedWork - 32) * 100) / 100);
  equal(you.phraseId > oldId, true);
  let rejected = false;
  try { executeCommand(state, you, { type: 'TYPE', phraseId: oldId, text: you.phrase }); }
  catch { rejected = true; }
  equal(rejected, true);
  state.tier = 3; state.resources = 500;
  executeCommand(state, you, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, teammate, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, you, { type: 'LENGTH', length: 'medium' });
  executeCommand(state, you, { type: 'ACTION', action: 'tower', tier: 2 });
  let towerWork = phraseWork(you);
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  equal(teammate.actionPhrases, 1);
  for (const player of [teammate, you, teammate, you, teammate]) {
    if (towerWork < 50) towerWork = Math.round((towerWork + phraseWork(player)) * 100) / 100;
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  }
  while (towerWork < 50) {
    towerWork = Math.round((towerWork + phraseWork(you)) * 100) / 100;
    executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  }
  equal(you.work, towerWork);
  equal(you.typed, '');
  const constructionPhrase = you.phrase;
  const constructionId = you.phraseId;
  executeCommand(state, you, { type: 'TYPE', phraseId: constructionId, text: constructionPhrase.slice(0, 3) });
  executeCommand(state, teammate, { type: 'PLACE', kind: 'tower', point: { x: 300, y: 500 } });
  equal(state.resources, 500);
  equal(you.work, Math.round((towerWork - 50) * 100) / 100);
  equal(you.actionPhrases, 0);
  equal(you.typed, constructionPhrase.slice(0, 3));
  equal(you.phraseId, constructionId);
  equal(state.buildings.filter(building => building.kind === 'tower' && !building.enemy).length, 1);
});

test('Stronghold simulated role mates contribute work without editing human text or overriding army orders', () => {
  const state = createStronghold();
  const you = state.players[0];
  if (!you) throw new Error('Missing player.');
  executeCommand(state, you, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, you, { type: 'ACTION', action: 'wall' });
  const phrase = you.phrase;
  const phraseId = you.phraseId;
  const partner = state.players.find(player => player.simulated && player.role === 'defenses')!;
  const points = phraseWork(partner);
  const completed = partner.completed;
  for (let frame = 0; frame < 40 && partner.completed === completed; frame++) advanceStronghold(state, .1);
  equal(you.action, 'wall');
  equal(you.typed, '');
  equal(you.phrase, phrase);
  equal(you.phraseId, phraseId);
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: '?' });
  advanceStronghold(state, .1);
  equal(you.typed, '?');
  equal(you.work, points);
  equal(you.phraseId, phraseId);
  executeCommand(state, you, { type: 'ROLE', role: 'army' });
  const armyPhrase = you.phrase;
  const armyId = you.phraseId;
  const warrior = state.units.find(unit => unit.kind === 'warrior');
  if (!warrior) throw new Error('Missing warrior.');
  executeCommand(state, you, { type: 'MOVE', ids: [warrior.id], point: { x: 200, y: 400 } });
  advanceStronghold(state, .1);
  equal(warrior.destination, { x: 200, y: 400 });
  equal(you.typed, '');
  equal(you.phrase, armyPhrase);
  equal(you.phraseId, armyId);
});

test('Stronghold square castle, T towers and basic animations preserve health and selection markup', () => {
  const state = createStronghold();
  const castle = state.buildings.find(building => building.kind === 'castle');
  const tower = state.buildings.find(building => building.kind === 'tower');
  const worker = state.units[0];
  if (!castle || !tower || !worker) throw new Error('Missing entities.');
  equal(buildingMarkup(castle).includes('v-10 h10'), false);
  equal(buildingMarkup(castle).includes('width="68" height="68"'), true);
  equal(buildingMarkup(tower).includes('M-16 -20 H16 V-10 H5 V20 H-5 V-10 H-16 Z'), true);
  equal(unitMotionTransform(worker, { x: worker.x - 1, y: worker.y }, 1).includes('rotate'), true);
  equal(unitMotionTransform(worker, worker, 1), '');
  worker.attackTarget = { x: 100, y: 100 }; worker.cooldown = 3;
  equal(unitMotionTransform(worker, worker, 1), 'scale(1.04)');
  equal(unitMotionTransform(worker, worker, 1, true), '');
  equal(unitMarkup(worker, true).includes('data-work'), true);
  equal(unitMarkup(worker, true).includes('data-attack'), false);
  equal(unitMarkup(worker, true).includes('data-selected'), true);
  equal(unitMarkup(worker, true).includes('data-health'), true);
});
