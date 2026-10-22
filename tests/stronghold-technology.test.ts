import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { createStronghold, addBuilding, addUnit } from './stronghold-fixtures.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { phraseWork, taskWork, unitUpgrade, upgradeLimit } from '../src/stronghold/domain/technology.ts';
import type { Participant, StrongholdState } from '../src/stronghold/domain/types.ts';
import { equal, test } from './harness.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';

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
  rejects(() => executeCommand(state, self(state), { type: 'PLACE', kind: 'barracks', point: { x: 770, y: 570 } }));
  finish(state);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'barracks', point: { x: 770, y: 570 } });
  equal(state.resources, 500);
  const barracks = state.buildings.filter(building => building.kind === 'barracks');
  equal(barracks.map(building => building.tier), [1, 3]);
  equal(barracks.map(building => building.maxHp), [160, 240]);
  barracks.forEach(building => { building.progress = 1; });
  executeCommand(state, self(state), { type: 'ACTION', action: 'warrior' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'catapult' });
  for (let second = 0; second < 12; second++) advanceStronghold(state, 1);
  equal(state.units.some(unit => unit.kind === 'catapult'), true);
  equal(state.units.filter(unit => unit.kind === 'warrior').length, 3);
  equal(state.resources, 395);
});

test('Stronghold free towers retain their tier and paid troops are purchased without typing', () => {
  const state = createStronghold();
  state.tier = 3; state.resources = 500;
  executeCommand(state, self(state), { type: 'ROLE', role: 'defenses' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'tower', tier: 2 });
  const points = phraseWork(self(state));
  executeCommand(state, self(state), { type: 'TYPE', phraseId: self(state).phraseId, text: self(state).phrase });
  equal(self(state).work, points);
  finish(state);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'tower', point: { x: 360, y: 425 } });
  equal(state.buildings.find(building => building.kind === 'tower' && !building.enemy)?.tier, 2);
  equal(state.buildings.find(building => building.kind === 'tower' && !building.enemy)?.maxHp, 330);
  equal(state.resources, 500);
  executeCommand(state, self(state), { type: 'ROLE', role: 'production' });
  addBuilding(state, 'barracks', { x: 650, y: 570 }, true, false, 3);
  const phraseId = self(state).phraseId;
  executeCommand(state, self(state), { type: 'ACTION', action: 'catapult' });
  equal(state.units.some(unit => unit.kind === 'catapult'), false);
  equal(state.buildings.some(building => building.trainingQueue.some(order => order.kind === 'catapult')), true);
  equal(self(state).phraseId, phraseId);
  equal(state.resources, 420);
});

test('Stronghold upgrades are tracked independently for each troop and tower tier', () => {
  equal(upgradeLimit(0, 'economy'), 2);
  equal(upgradeLimit(3, 'economy'), 5);
  equal(upgradeLimit(1, 'warrior'), 1);
  equal(upgradeLimit(1, 'archer'), 0);
  equal(upgradeLimit(3, 'warrior'), 3);
  equal(upgradeLimit(3, 'archer'), 2);
  equal(upgradeLimit(3, 'catapult'), 1);
  equal(upgradeLimit(3, 'tower-1'), 3);
  equal(upgradeLimit(3, 'tower-2'), 2);
  equal(upgradeLimit(3, 'tower-3'), 1);
  const state = createStronghold();
  state.tier = 1; state.resources = 500;
  executeCommand(state, self(state), { type: 'ROLE', role: 'production' });
  const warrior = state.units.find(unit => unit.kind === 'warrior');
  if (!warrior) throw new Error('Missing warrior.');
  const oldHp = warrior.maxHp;
  executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade', upgrade: 'warrior' });
  equal(state.technology.warrior, 1);
  equal(warrior.maxHp, oldHp + 20);
  equal(state.resources, 440);
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade', upgrade: 'warrior' }));
  equal(state.technology.warrior, 1);
  equal(state.resources, 440);
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade', upgrade: 'archer' }));
  equal(state.technology.archer, 0);
  equal(unitUpgrade(state, { kind: 'archer' }), 0);
  equal(addUnit(state, 'warrior', { x: 500, y: 500 }).maxHp, oldHp + 20);
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
  executeCommand(state, self(state), { type: 'PLACE', kind: 'wall', point: { x: 410, y: 540 } });
  equal(self(state).work, Math.round((secondReadyWork - 32) * 100) / 100);
  equal(state.resources, 50);
});
