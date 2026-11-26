import { executeCommand, towerUpgradeBlocker } from '../src/stronghold/domain/actions.ts';
import { createStronghold, addBuilding, addUnit } from './stronghold-fixtures.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { phraseWork, taskWork, unitUpgrade, upgradeLimit } from '../src/stronghold/domain/technology.ts';
import type { Participant, StrongholdState } from '../src/stronghold/domain/types.ts';
import { equal, test } from './harness.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { TRAINING_SECONDS } from '../src/stronghold/domain/training.ts';
import { buildingMarkup, unitMarkup } from '../src/stronghold/ui/battlefield.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { selectedTowerAvailability } from '../src/stronghold/ui/view.ts';

test('Stronghold combat units gain a visible rank mark for every purchased upgrade without changing their silhouettes', () => {
  const state = createStronghold();
  for (const kind of ['warrior', 'archer', 'catapult'] as const) {
    const unit = addUnit(state, kind, { x: 500, y: 400 });
    for (let level = 0; level <= upgradeLimit(3, kind); level++) {
      const markup = unitMarkup(unit, false, true, level);
      equal((markup.match(/data-upgrade-mark=/g) ?? []).length, level);
      equal(markup.includes('data-health'), true);
      equal(markup.includes(kind === 'warrior' ? 'width="16"' : kind === 'archer' ? 'L0 10' : 'data-catapult-arm'), true);
    }
  }
  for (const kind of ['worker', 'builder', 'invader'] as const) {
    equal(unitMarkup(addUnit(state, kind, { x: 500, y: 400 }), false, true, 3).includes('data-upgrade-mark'), false);
  }
});

function self(state: StrongholdState): Participant {
  const player = state.players.find(candidate => candidate.id === 'you');
  if (!player) throw new Error('Missing local player.');
  return player;
}
function finish(state: StrongholdState): number {
  const player = self(state);
  let expected = player.work;
  for (let entry = 0; entry < taskWork(player) && expected < taskWork(player); entry++) {
    expected = Math.round((expected + phraseWork(player)) * 100) / 100;
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
    equal(player.work, expected);
  }
  equal(player.work >= taskWork(player), true);
  return expected;
}
function rejects(run: () => void): void {
  try { run(); } catch (error) { equal(error instanceof Error, true); return; }
  throw new Error('Expected command rejection.');
}

test('Stronghold free barracks require proportional tier-specific typing and retain their production tier', () => {
  const state = createStronghold();
  state.tier = 3;
  state.resources = 500;
  state.nodes = [];
  state.players.forEach(player => { player.simulated = false; });
  executeCommand(state, self(state), { type: 'ROLE', role: 'production' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'barracks', tier: 1 });
  finish(state);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'barracks', point: { x: 620, y: 570 } });
  equal(state.resources, 500);
  executeCommand(state, self(state), { type: 'ACTION', action: 'barracks', tier: 3 });
  let expected = 0;
  for (let entry = 0; entry < 2; entry++) {
    expected = Math.round((expected + phraseWork(self(state))) * 100) / 100;
    executeCommand(state, self(state), { type: 'TYPE', phraseId: self(state).phraseId, text: self(state).phrase });
  }
  equal(self(state).work, expected);
  rejects(() => executeCommand(state, self(state), { type: 'PLACE', kind: 'barracks', point: { x: 690, y: 570 } }));
  finish(state);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'barracks', point: { x: 690, y: 570 } });
  equal(state.resources, 500);
  const barracks = state.buildings.filter(building => building.kind === 'barracks');
  equal(barracks.map(building => building.tier), [1, 3]);
  equal(barracks.map(building => building.maxHp), [320, 520]);
  barracks.forEach(building => { building.progress = 1; });
  executeCommand(state, self(state), { type: 'ACTION', action: 'warrior' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'catapult' });
  for (let second = 0; second < TRAINING_SECONDS; second++) advanceStronghold(state, 1);
  equal(state.units.some(unit => unit.kind === 'catapult'), true);
  equal(state.units.filter(unit => unit.kind === 'warrior').length, 3);
  equal(state.resources, 260);
});

test('Stronghold towers start at T1 and upgrade individually while paid troops still require no typing', () => {
  const state = createStronghold();
  state.tier = 3; state.resources = 500;
  executeCommand(state, self(state), { type: 'ROLE', role: 'defenses' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'tower' });
  const points = phraseWork(self(state));
  executeCommand(state, self(state), { type: 'TYPE', phraseId: self(state).phraseId, text: self(state).phrase });
  equal(self(state).work, points);
  finish(state);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'tower', point: { x: 450, y: 425 } });
  const tower = state.buildings.find(building => building.kind === 'tower' && !building.enemy)!;
  equal(tower.tier, 1);
  equal(tower.maxHp, 600);
  equal(state.resources, 500);
  tower.progress = 1;
  executeCommand(state, self(state), { type: 'UPGRADE_TOWER', id: tower.id, tier: 2 });
  equal(tower.tier, 2);
  equal(tower.maxHp, 800);
  executeCommand(state, self(state), { type: 'ROLE', role: 'production' });
  addBuilding(state, 'barracks', { x: 650, y: 570 }, true, false, 3);
  const phraseId = self(state).phraseId;
  executeCommand(state, self(state), { type: 'ACTION', action: 'catapult' });
  equal(state.units.some(unit => unit.kind === 'catapult'), false);
  equal(state.buildings.some(building => building.trainingQueue.some(order => order.kind === 'catapult')), true);
  equal(self(state).phraseId, phraseId);
  equal(state.resources, 195);
});

test('Stronghold troop upgrades retain independent once-per-tier limits', () => {
  equal(upgradeLimit(0, 'economy'), 2);
  equal(upgradeLimit(3, 'economy'), 5);
  equal(upgradeLimit(1, 'warrior'), 1);
  equal(upgradeLimit(1, 'archer'), 0);
  equal(upgradeLimit(3, 'warrior'), 3);
  equal(upgradeLimit(3, 'archer'), 2);
  equal(upgradeLimit(3, 'catapult'), 1);
  const state = createStronghold();
  state.tier = 1; state.resources = 500;
  executeCommand(state, self(state), { type: 'ROLE', role: 'production' });
  const warrior = state.units.find(unit => unit.kind === 'warrior');
  if (!warrior) throw new Error('Missing warrior.');
  const oldHp = warrior.maxHp;
  executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade', upgrade: 'warrior' });
  equal(state.technology.warrior, 1);
  equal(warrior.maxHp, oldHp + 30);
  equal(state.resources, 440);
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade', upgrade: 'warrior' }));
  equal(state.technology.warrior, 1);
  equal(state.resources, 440);
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade', upgrade: 'archer' }));
  equal(state.technology.archer, 0);
  equal(unitUpgrade(state, { kind: 'archer' }), 0);
  equal(addUnit(state, 'warrior', { x: 500, y: 500 }).maxHp, oldHp + 30);
});

test('Stronghold individual tower upgrades preserve damage and typing, leave other towers alone and update tier silhouettes', () => {
  const state = createStronghold();
  state.tier = 3; state.resources = 1000; state.nodes = [];
  const player = self(state);
  executeCommand(state, player, { type: 'ROLE', role: 'defenses' });
  const tower = addBuilding(state, 'tower', { x: 450, y: 500 }, true);
  const other = addBuilding(state, 'tower', { x: 650, y: 500 }, true);
  tower.hp -= 200; tower.cooldown = .6;
  const beforePlayer = structuredClone(player), beforeTasks = structuredClone(state.roleTasks);
  for (const tier of [2, 3] as const) {
    executeCommand(state, player, { type: 'UPGRADE_TOWER', id: tower.id, tier });
    equal(tower.tier, tier);
    equal(tower.maxHp, tier === 2 ? 800 : 1000);
    equal(tower.maxHp - tower.hp, 200);
    equal(tower.cooldown, .6);
    equal(player, beforePlayer);
    equal(state.roleTasks, beforeTasks);
    const markup = buildingMarkup(tower);
    equal((markup.match(/data-tower-band=/g) ?? []).length, tier);
    equal(markup.includes(tier === 2 ? '#d6dce3' : '#677584'), true);
  }
  equal([other.tier, other.hp, other.maxHp], [1, 600, 600]);
  equal(state.resources, 695);
  equal(addBuilding(state, 'tower', { x: 750, y: 500 }, true).tier, 1);
  const before = structuredClone(state);
  rejects(() => executeCommand(state, player, { type: 'UPGRADE_TOWER', id: tower.id, tier: 3 }));
  equal(state, before);
});

test('Stronghold tower upgrades reject locks, wrong roles, invalid targets, unfinished towers and unaffordable or skipped stages atomically', () => {
  for (const problem of ['tier', 'role', 'dead', 'enemy', 'unfinished', 'supplies', 'skip', 'missing', 'invalid-tier', 'phase']) {
    const state = createStronghold();
    state.tier = 3; state.resources = 1000; state.nodes = [];
    const player = self(state);
    executeCommand(state, player, { type: 'ROLE', role: 'defenses' });
    const tower = addBuilding(state, 'tower', { x: 450, y: 500 }, true);
    if (problem === 'tier') state.tier = 1;
    if (problem === 'role') player.role = 'economy';
    if (problem === 'dead') tower.hp = 0;
    if (problem === 'enemy') tower.enemy = true;
    if (problem === 'unfinished') tower.progress = .5;
    if (problem === 'supplies') state.resources = 124;
    if (problem === 'phase') state.phase = 'tier-up';
    const before = structuredClone(state);
    rejects(() => executeCommand(state, player, { type: 'UPGRADE_TOWER', id: problem === 'missing' ? -1 : tower.id,
      tier: problem === 'skip' ? 3 : problem === 'invalid-tier' ? 1 : 2 }));
    equal(state, before);
  }
});

test('Stronghold tower upgrade geometry reserves the larger footprint without requiring another building slot or builder', () => {
  const state = createStronghold();
  state.tier = 3; state.resources = 1000; state.nodes = []; state.units = [];
  const player = self(state);
  executeCommand(state, player, { type: 'ROLE', role: 'defenses' });
  const tower = addBuilding(state, 'tower', { x: 450, y: 500 }, true);
  const wall = addBuilding(state, 'wall', { x: 492, y: 500 }, true);
  equal(towerUpgradeBlocker(state, player, tower.id, 2)?.label, 'Needs more space');
  const before = structuredClone(state);
  rejects(() => executeCommand(state, player, { type: 'UPGRADE_TOWER', id: tower.id, tier: 2 }));
  equal(state, before);
  wall.hp = 0;
  for (let index = 0; index < 7; index++) addBuilding(state, 'tower', { x: 150 + index * 65, y: 300 }, true);
  executeCommand(state, player, { type: 'UPGRADE_TOWER', id: tower.id, tier: 2 });
  equal(tower.tier, 2);
  equal(state.buildings.filter(building => building.kind === 'tower' && !building.enemy).length, 8);
  state.nodes = [{ id: 900, x: tower.x + 46, y: tower.y, rich: false, remaining: 10 }];
  equal(towerUpgradeBlocker(state, player, tower.id, 3)?.label, 'Needs more space');
});

test('Stronghold tower controls expose selection and tier blockers and replace the old construction and global upgrade tiles', () => {
  const markup = strongholdWorkspaceMarkup();
  equal((markup.match(/data-action="tower"/g) ?? []).length, 4);
  equal(markup.includes('Tower T2'), false);
  equal(markup.includes('Tower T3'), false);
  equal(markup.includes('data-stronghold-upgrade="tower-'), false);
  equal((markup.match(/data-tower-upgrade="2"/g) ?? []).length, 4);
  equal((markup.match(/data-tower-upgrade="3"/g) ?? []).length, 4);
  const engine = new StrongholdEngine({ tier: 3, resources: 500, computersPaused: true, length: 'short', startingCounts: { tower: 2 } });
  engine.send('you', { type: 'ROLE', role: 'defenses' });
  const snapshot = engine.snapshot('you'), player = snapshot.players[0]!;
  snapshot.nodes = [];
  const towers = snapshot.buildings.filter(building => building.kind === 'tower' && !building.enemy);
  equal(towers.map(tower => tower.tier), [1, 1]);
  equal(selectedTowerAvailability(snapshot, player, new Set(), 2, true).blocker?.label, 'Select one tower');
  equal(selectedTowerAvailability(snapshot, player, new Set(towers.map(tower => tower.id)), 2, true).disabled, true);
  const selected = new Set([towers[0]!.id]);
  equal(selectedTowerAvailability(snapshot, player, selected, 2, true).disabled, false);
  equal(selectedTowerAvailability(snapshot, player, selected, 3, true).blocker?.label, 'Upgrade to T2 first');
  equal(selectedTowerAvailability(snapshot, player, selected, 2, false).blocker?.label, 'Paused');
  snapshot.tier = 1; snapshot.resources = 0;
  equal(selectedTowerAvailability(snapshot, player, selected, 2, true).blocker?.label, 'Needs Tier 2');
  for (const tier of [2, 3]) {
    const before = structuredClone(engine.snapshot('you'));
    rejects(() => engine.send('you', { type: 'ACTION', action: 'tower', tier }));
    equal(engine.snapshot('you'), before);
  }
});

test('Stronghold rejects invalid construction tiers and upgrades from the wrong role atomically', () => {
  const state = createStronghold();
  const phraseId = self(state).phraseId;
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'relay', tier: 4 }));
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade', upgrade: 'catapult' }));
  equal(self(state).phraseId, phraseId);
  equal(self(state).action, 'worker');
  equal(state.resources, 50);
});

test('Stronghold sketch controls do not collide with Arcade upgrade selectors', () => {
  const markup = strongholdWorkspaceMarkup();
  equal(markup.includes(' data-upgrade='), false);
  equal(markup.includes(' data-stronghold-upgrade="warrior"'), true);
  equal(markup.includes('data-tier="3"'), true);
  equal(markup.includes('id="stronghold-role-you-production"'), true);
});

test('Stronghold completed construction holds one bar and requires refilling after every free wall', () => {
  const state = createStronghold();
  executeCommand(state, self(state), { type: 'ROLE', role: 'defenses' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'wall' });
  const readyWork = finish(state);
  const phraseId = self(state).phraseId;
  finish(state);
  equal(self(state).work, readyWork);
  equal(self(state).phraseId, phraseId);
  equal(state.resources, 50);
  executeCommand(state, self(state), { type: 'TYPE', phraseId: self(state).phraseId, text: '' });
  equal(self(state).typed, '');
  executeCommand(state, self(state), { type: 'PLACE', kind: 'wall', point: { x: 360, y: 540 } });
  equal(state.resources, 50);
  equal(self(state).work, Math.round((readyWork - 32) * 100) / 100);
  rejects(() => executeCommand(state, self(state), { type: 'PLACE', kind: 'wall', point: { x: 410, y: 540 } }));
  const secondReadyWork = finish(state);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'wall', point: { x: 420, y: 540 } });
  equal(self(state).work, Math.round((secondReadyWork - 32) * 100) / 100);
  equal(state.resources, 50);
});
