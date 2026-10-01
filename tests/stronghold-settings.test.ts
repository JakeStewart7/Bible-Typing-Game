import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { TIER_QUOTA } from '../src/stronghold/domain/rules.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { addBuilding, createStronghold } from '../src/stronghold/domain/state.ts';
import type { Participant, StrongholdCommand, StrongholdState } from '../src/stronghold/domain/types.ts';
import { equal, test } from './harness.ts';

function human(state: StrongholdState): Participant {
  const player = state.players.find(player => player.id === 'you');
  if (!player) throw new Error('Missing human player.');
  return player;
}
function send(state: StrongholdState, command: StrongholdCommand): void {
  executeCommand(state, human(state), command);
}
function entry(state: StrongholdState, player = human(state)): void {
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
}
function quietMatch(): StrongholdState {
  const state = createStronghold();
  send(state, { type: 'COMPUTERS', paused: true });
  state.waveIn = 10000;
  return state;
}

test('Stronghold starts with 50 supplies, Medium text and running computers, and restart clears task banks', () => {
  const engine = new StrongholdEngine();
  const initial = engine.snapshot('you');
  equal(initial.resources, 50);
  equal(initial.event, 'peace');
  equal(initial.eventIn, 60);
  equal(initial.computersPaused, false);
  equal(initial.players.every(player => player.length === 'medium'), true);
  const player = initial.players.find(player => player.id === 'you');
  if (!player) throw new Error('Missing player.');
  engine.send('you', { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  const snapshot = engine.snapshot('you');
  equal(snapshot.roleTasks.economy.progress.resources?.work, 2);
  if (!snapshot.roleTasks.economy.progress.resources) throw new Error('Missing saved work.');
  snapshot.roleTasks.economy.progress.resources.work = 500;
  equal(engine.snapshot('you').roleTasks.economy.progress.resources?.work, 2);
  equal(JSON.stringify(snapshot.roleTasks).includes('phrase'), false);
  engine.send('you', { type: 'COMPUTERS', paused: true });
  engine.restart();
  const restarted = engine.snapshot('you');
  equal(restarted.computersPaused, false);
  equal(restarted.roleTasks.economy.progress.resources?.work, 0);
  equal(restarted.players.every(player => player.work === 0 && player.length === 'medium'), true);
});

test('Stronghold each task retains completed work across task changes and a vacant role', () => {
  const state = quietMatch();
  const player = human(state);
  entry(state);
  const oldId = player.phraseId;
  send(state, { type: 'ACTION', action: 'worker' });
  equal(player.work, 0);
  entry(state);
  entry(state);
  equal(player.work, 4);
  send(state, { type: 'ACTION', action: 'resources' });
  equal(player.work, 2);
  equal(player.actionPhrases, 1);
  send(state, { type: 'ROLE', role: 'army' });
  equal(state.players.some(other => other.role === 'economy'), false);
  equal(player.work, 0);
  entry(state);
  equal(player.work, 2);
  send(state, { type: 'ROLE', role: 'economy' });
  equal(player.action, 'resources');
  equal(player.work, 2);
  send(state, { type: 'ACTION', action: 'worker' });
  equal(player.work, 4);
  equal(player.actionPhrases, 2);
  equal(player.phraseId > oldId, true);
  send(state, { type: 'ROLE', role: 'defenses' });
  send(state, { type: 'ROLE', role: 'economy' });
  equal(player.action, 'worker');
  equal(player.work, 4);
  entry(state);
  entry(state);
  equal(player.work, 0);
  equal(state.units.filter(unit => unit.kind === 'worker').length, 3);
  send(state, { type: 'ACTION', action: 'resources' });
  equal(player.work, 2);
  send(state, { type: 'ACTION', action: 'worker' });
  equal(player.work, 0);
});

test('Stronghold restored task work remains shared when teammates select tasks and join or leave roles', () => {
  const state = quietMatch();
  const you = human(state);
  const teammate = state.players.find(player => player.id === 'bot-1');
  if (!teammate) throw new Error('Missing teammate.');
  executeCommand(state, teammate, { type: 'ROLE', role: 'economy' });
  entry(state);
  executeCommand(state, teammate, { type: 'ACTION', action: 'worker' });
  entry(state, teammate);
  equal(you.work, 2);
  send(state, { type: 'ACTION', action: 'resources' });
  equal(teammate.work, 2);
  equal(teammate.action, 'resources');
  entry(state, teammate);
  equal(you.work, 4);
  send(state, { type: 'ROLE', role: 'army' });
  executeCommand(state, teammate, { type: 'ACTION', action: 'worker' });
  entry(state, teammate);
  send(state, { type: 'ROLE', role: 'economy' });
  equal(you.work, 4);
  equal(you.phrase, teammate.phrase);
  send(state, { type: 'ACTION', action: 'resources' });
  equal(you.work, 4);
  equal(teammate.work, 4);
});

test('Stronghold construction tiers and individual upgrade targets have independent saved progress', () => {
  const state = quietMatch();
  state.tier = 3;
  state.resources = 1000;
  const player = human(state);
  send(state, { type: 'ROLE', role: 'defenses' });
  send(state, { type: 'ACTION', action: 'tower', tier: 1 });
  for (let index = 0; index < 4; index++) entry(state);
  equal(player.work, 8);
  send(state, { type: 'ACTION', action: 'tower', tier: 2 });
  entry(state);
  equal(player.work, 2);
  send(state, { type: 'ACTION', action: 'upgrade', upgrade: 'tower-1' });
  entry(state);
  send(state, { type: 'ACTION', action: 'upgrade', upgrade: 'tower-2' });
  entry(state);
  entry(state);
  send(state, { type: 'ACTION', action: 'tower', tier: 1 });
  equal(player.work, 8);
  send(state, { type: 'PLACE', kind: 'tower', point: { x: 300, y: 500 } });
  equal(player.work, 0);
  send(state, { type: 'ACTION', action: 'tower', tier: 2 });
  equal(player.work, 2);
  send(state, { type: 'ACTION', action: 'upgrade', upgrade: 'tower-1' });
  equal(player.work, 2);
  send(state, { type: 'ACTION', action: 'upgrade', upgrade: 'tower-2' });
  equal(player.work, 4);
  entry(state);
  entry(state);
  equal(state.technology['tower-2'], 1);
  equal(player.work, 0);
  send(state, { type: 'ACTION', action: 'upgrade', upgrade: 'tower-1' });
  equal(player.work, 2);
  send(state, { type: 'ROLE', role: 'production' });
  send(state, { type: 'ACTION', action: 'barracks', tier: 1 });
  entry(state);
  send(state, { type: 'ACTION', action: 'barracks', tier: 3 });
  entry(state);
  entry(state);
  send(state, { type: 'ACTION', action: 'barracks', tier: 1 });
  equal(player.work, 2);
  send(state, { type: 'ACTION', action: 'barracks', tier: 3 });
  equal(player.work, 4);
});

test('Stronghold shared tier challenges preserve normal task banks and the chosen text length', () => {
  const state = quietMatch();
  const player = human(state);
  entry(state);
  send(state, { type: 'ACTION', action: 'worker' });
  entry(state);
  entry(state);
  for (const other of state.players) executeCommand(state, other, { type: 'READY', ready: true });
  equal(state.phase, 'tier-up');
  send(state, { type: 'LENGTH', length: 'long' });
  for (const other of state.players) for (let index = 0; index < TIER_QUOTA; index++) entry(state, other);
  equal(state.phase, 'playing');
  equal(state.tier, 1);
  equal(player.action, 'worker');
  equal(player.work, 4);
  equal(player.length, 'long');
  send(state, { type: 'ACTION', action: 'resources' });
  equal(player.work, 2);
  equal(player.length, 'long');
});

test('Stronghold stopping computers freezes their decisions and barracks, but not human typing or the battlefield', () => {
  const state = createStronghold();
  state.tier = 1;
  state.waveIn = 10000;
  const computerBarracks = addBuilding(state, 'barracks', { x: 650, y: 550 }, true);
  computerBarracks.ownerId = 'bot-1';
  computerBarracks.cooldown = 5;
  const humanBarracks = addBuilding(state, 'barracks', { x: 350, y: 550 }, true);
  humanBarracks.ownerId = 'you';
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
  entry(state);
  equal(human(state).work, 2);
  send(state, { type: 'COMPUTERS', paused: false });
  advanceStronghold(state, .1);
  equal(computerBarracks.cooldown < cooldown, true);
  equal(state.players.some(player => player.simulated && player.typingCredit !== computers.find(other => other.id === player.id)?.typingCredit), true);
  equal(state.events.some(event => event.text === 'Computers stopped' && event.playerId === null), true);
  equal(state.events.some(event => event.text === 'Computers resumed' && event.playerId === null), true);
});

test('Stronghold stopped computers cannot ready up or contribute until resumed, including within a tier challenge', () => {
  const state = quietMatch();
  send(state, { type: 'READY', ready: true });
  for (let index = 0; index < 10; index++) advanceStronghold(state, .25);
  equal(state.phase, 'playing');
  equal(state.players.filter(player => player.simulated).every(player => !player.ready && player.typingCredit === 0), true);
  send(state, { type: 'COMPUTERS', paused: false });
  advanceStronghold(state, .25);
  equal(state.phase, 'tier-up');
  send(state, { type: 'COMPUTERS', paused: true });
  const computers = structuredClone(state.players.filter(player => player.simulated));
  for (let index = 0; index < TIER_QUOTA; index++) entry(state);
  const time = state.elapsed;
  for (let index = 0; index < 10; index++) advanceStronghold(state, .25);
  equal(state.elapsed, time);
  equal(state.players.filter(player => player.simulated), computers);
  send(state, { type: 'COMPUTERS', paused: false });
  for (let index = 0; index < 100 && state.phase === 'tier-up'; index++) advanceStronghold(state, .25);
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

test('Stronghold event end preserves in-progress typing and switches subsequent entries back to scripture', () => {
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
  entry(state);
  equal(player.work, 2);
  equal(['faithfulness', 'steadfastness', 'righteousness', 'understanding'].includes(player.phrase), true);
});
