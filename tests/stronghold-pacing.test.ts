import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { updateCombat } from '../src/stronghold/domain/combat.ts';
import { updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { addBuilding, addUnit, createStronghold } from '../src/stronghold/domain/state.ts';
import { distance, UNIT_RULES } from '../src/stronghold/domain/rules.ts';
import { buildingMarkup, unitMarkup, unitMotionTransform } from '../src/stronghold/ui/battlefield.ts';
import { equal, test } from './harness.ts';

test('Stronghold every unit moves 70 percent slower and has double health, including wave bonuses', () => {
  const original = { worker: [42, 35], builder: [50, 55], warrior: [62, 100],
    archer: [55, 65], catapult: [32, 110], invader: [38, 60] } as const;
  const state = createStronghold();
  state.units = [];
  state.nodes = [{ id: 100, x: 100, y: 500, remaining: 100, rich: false }];
  addBuilding(state, 'wall', { x: 200, y: 500 });
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
    equal(unit.maxHp, (UNIT_RULES[formation ?? 'invader'].hp + 20) * 2);
  }
  equal(state.buildings.find(building => building.kind === 'castle')?.maxHp, 10000);
  equal(state.buildings.find(building => building.kind === 'enemy-base')?.maxHp, 1200);
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

test('Stronghold role members share typing, task phases and placement without duplicate costs', () => {
  const state = createStronghold();
  state.players.forEach(player => { player.simulated = false; });
  const [you, teammate] = state.players;
  if (!you || !teammate) throw new Error('Missing players.');
  executeCommand(state, you, { type: 'LENGTH', length: 'extra-long' });
  executeCommand(state, teammate, { type: 'ROLE', role: 'economy' });
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase.slice(0, 5) });
  equal(teammate.typed, you.typed);
  const oldId = you.phraseId;
  executeCommand(state, teammate, { type: 'TYPE', phraseId: teammate.phraseId, text: teammate.phrase });
  equal(state.resources, 50);
  equal(you.work, 4);
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  equal(state.resources, 68);
  equal(you.typed, '');
  equal(you.phrase, teammate.phrase);
  equal(you.phraseId > oldId, true);
  let rejected = false;
  try { executeCommand(state, you, { type: 'TYPE', phraseId: oldId, text: you.phrase }); }
  catch { rejected = true; }
  equal(rejected, true);
  state.tier = 3; state.resources = 500;
  executeCommand(state, you, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, teammate, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, you, { type: 'LENGTH', length: 'extra-long' });
  executeCommand(state, you, { type: 'ACTION', action: 'tower', tier: 2 });
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  equal(teammate.actionPhrases, 1);
  executeCommand(state, teammate, { type: 'TYPE', phraseId: teammate.phraseId, text: teammate.phrase });
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  executeCommand(state, teammate, { type: 'TYPE', phraseId: teammate.phraseId, text: teammate.phrase });
  equal(you.work, 16);
  equal(you.typed, '');
  executeCommand(state, teammate, { type: 'PLACE', kind: 'tower', point: { x: 300, y: 500 } });
  equal(state.resources, 450);
  equal(you.actionPhrases, 0);
  equal(you.typed, '');
  equal(state.buildings.filter(building => building.kind === 'tower' && !building.enemy).length, 1);
});

test('Stronghold simulated role mates help the chosen task without overriding errors or army orders', () => {
  const state = createStronghold();
  const you = state.players[0];
  if (!you) throw new Error('Missing player.');
  executeCommand(state, you, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, you, { type: 'ACTION', action: 'wall' });
  advanceStronghold(state, 1);
  equal(you.action, 'wall');
  equal(you.typed.length, 5);
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: '?' });
  advanceStronghold(state, 1);
  equal(you.typed, '?');
  executeCommand(state, you, { type: 'ROLE', role: 'army' });
  const warrior = state.units.find(unit => unit.kind === 'warrior');
  if (!warrior) throw new Error('Missing warrior.');
  executeCommand(state, you, { type: 'MOVE', ids: [warrior.id], point: { x: 200, y: 400 } });
  advanceStronghold(state, .1);
  equal(warrior.destination, { x: 200, y: 400 });
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
  equal(unitMotionTransform(worker, worker, 1), 'scale(1.15)');
  equal(unitMotionTransform(worker, worker, 1, true), '');
  equal(unitMarkup(worker, true).includes('data-attack'), true);
  equal(unitMarkup(worker, true).includes('data-selected'), true);
  equal(unitMarkup(worker, true).includes('data-health'), true);
});
