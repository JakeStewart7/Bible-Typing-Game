import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { createStronghold, addUnit } from '../src/stronghold/domain/state.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { taskPhrases, unitUpgrade, upgradeLimit } from '../src/stronghold/domain/technology.ts';
import type { Participant, StrongholdState } from '../src/stronghold/domain/types.ts';
import { equal, test } from './harness.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';

function self(state: StrongholdState): Participant {
  const player = state.players.find(candidate => candidate.id === 'you');
  if (!player) throw new Error('Missing local player.');
  return player;
}
function finish(state: StrongholdState): void {
  const player = self(state);
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
}
function rejects(run: () => void): void {
  try { run(); } catch (error) { equal(error instanceof Error, true); return; }
  throw new Error('Expected command rejection.');
}

test('Stronghold tier-specific barracks require their own typing work, cost and production tier', () => {
  const state = createStronghold();
  state.tier = 3;
  state.resources = 500;
  state.players.forEach(player => { player.simulated = false; });
  executeCommand(state, self(state), { type: 'ROLE', role: 'production' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'barracks', tier: 1 });
  finish(state);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'barracks', point: { x: 620, y: 570 } });
  equal(state.resources, 460);
  executeCommand(state, self(state), { type: 'ACTION', action: 'barracks', tier: 3 });
  finish(state); finish(state);
  equal(self(state).actionPhrases, 2);
  rejects(() => executeCommand(state, self(state), { type: 'PLACE', kind: 'barracks', point: { x: 770, y: 570 } }));
  finish(state);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'barracks', point: { x: 770, y: 570 } });
  equal(state.resources, 340);
  const barracks = state.buildings.filter(building => building.kind === 'barracks');
  equal(barracks.map(building => building.tier), [1, 3]);
  equal(barracks.map(building => building.maxHp), [160, 240]);
  barracks.forEach(building => { building.progress = 1; });
  advanceStronghold(state, .1);
  equal(state.units.some(unit => unit.kind === 'catapult'), true);
  equal(state.units.filter(unit => unit.kind === 'warrior').length, 3);
  equal(state.resources, 295);
});

test('Stronghold towers retain selected tiers and advanced units require more phrases', () => {
  const state = createStronghold();
  state.tier = 3; state.resources = 500;
  executeCommand(state, self(state), { type: 'ROLE', role: 'defenses' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'tower', tier: 2 });
  finish(state);
  equal(self(state).actionPhrases, 1);
  finish(state);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'tower', point: { x: 360, y: 425 } });
  equal(state.buildings.find(building => building.kind === 'tower' && !building.enemy)?.tier, 2);
  equal(state.buildings.find(building => building.kind === 'tower' && !building.enemy)?.maxHp, 220);
  equal(state.resources, 450);
  executeCommand(state, self(state), { type: 'ROLE', role: 'production' });
  executeCommand(state, self(state), { type: 'ACTION', action: 'catapult' });
  equal(taskPhrases(self(state)), 3);
  finish(state); finish(state);
  equal(state.units.some(unit => unit.kind === 'catapult'), false);
  finish(state);
  equal(state.units.some(unit => unit.kind === 'catapult'), true);
  equal(state.resources, 415);
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
  finish(state);
  equal(state.technology.warrior, 1);
  equal(warrior.maxHp, oldHp + 10);
  equal(state.resources, 490);
  finish(state);
  equal(state.technology.warrior, 1);
  equal(state.resources, 490);
  executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade', upgrade: 'archer' });
  finish(state);
  equal(state.technology.archer, 0);
  equal(unitUpgrade(state, { kind: 'archer' }), 0);
  equal(addUnit(state, 'warrior', { x: 500, y: 500 }).maxHp, oldHp + 10);
});

test('Stronghold rejects invalid construction tiers and upgrades from the wrong role atomically', () => {
  const state = createStronghold();
  const phraseId = self(state).phraseId;
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'relay', tier: 4 }));
  rejects(() => executeCommand(state, self(state), { type: 'ACTION', action: 'upgrade', upgrade: 'catapult' }));
  equal(self(state).phraseId, phraseId);
  equal(self(state).action, 'resources');
  equal(state.resources, 100);
});

test('Stronghold sketch controls do not collide with Arcade upgrade selectors', () => {
  const markup = strongholdWorkspaceMarkup();
  equal(markup.includes(' data-upgrade='), false);
  equal(markup.includes(' data-stronghold-upgrade="warrior"'), true);
  equal(markup.includes('data-tier="3"'), true);
  equal(markup.includes('id="stronghold-role-you"'), true);
});

test('Stronghold completed construction freezes its phrase until placement without duplicate credit', () => {
  const state = createStronghold();
  executeCommand(state, self(state), { type: 'ACTION', action: 'relay' });
  finish(state);
  const completed = self(state).completed;
  finish(state);
  equal(self(state).actionPhrases, 1);
  equal(self(state).completed, completed);
  rejects(() => executeCommand(state, self(state), { type: 'TYPE', phraseId: self(state).phraseId, text: '' }));
  equal(self(state).typed, self(state).phrase);
  executeCommand(state, self(state), { type: 'PLACE', kind: 'relay', point: { x: 360, y: 540 } });
  equal(state.resources, 85);
  equal(self(state).actionPhrases, 0);
});
