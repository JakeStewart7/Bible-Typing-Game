import { daylight, DAY_SECONDS, NIGHT_SECONDS, randomSeason, seasonalNodes, TWILIGHT_SECONDS } from '../src/stronghold/domain/environment.ts';
import { SEASONS } from '../src/stronghold/domain/types.ts';
import { createStronghold } from '../src/stronghold/domain/state.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { AUTUMN_LEAF_COLORS, weatherMarkup } from '../src/stronghold/ui/environment.ts';
import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { seasonalTrack } from '../src/stronghold/audio/catalog.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { distance, validPoint } from '../src/stronghold/domain/rules.ts';
import { equal, test } from './harness.ts';

test('Stronghold randomly chooses each of four seasons with equal probability', () => {
  for (let index = 0; index < SEASONS.length; index++) {
    equal(randomSeason(() => index / 4), SEASONS[index]);
    equal(randomSeason(() => (index + .99999) / 4), SEASONS[index]);
  }
  const engine = new StrongholdEngine();
  equal(SEASONS.includes(engine.snapshot('you').season), true);
  const season = engine.snapshot('you').season;
  engine.advance(.25);
  equal(engine.snapshot('you').season, season);
  equal(engine.snapshot('you').environmentElapsed, .25);
  engine.restart();
  equal(SEASONS.includes(engine.snapshot('you').season), true);
  equal(engine.snapshot('you').elapsed, 0);
  equal(engine.snapshot('you').environmentElapsed, 0);
});

test('Stronghold seasonal layouts only move resource nodes and keep their counts, richness, supplies, and starting armies', () => {
  const layouts = new Set<string>();
  const original = createStronghold(undefined, 'summer');
  for (const season of SEASONS) {
    const state = createStronghold(undefined, season);
    equal(state.season, season);
    equal(state.nodes.length, 8);
    equal(state.nodes.filter(node => node.rich).length, 2);
    equal(state.nodes.reduce((sum, node) => sum + node.remaining, 0), 7200);
    equal(new Set(state.nodes.map(node => node.id)).size, 8);
    equal(state.units, original.units);
    equal(state.buildings, original.buildings);
    equal(state.rally, original.rally);
    equal(state.resources, original.resources);
    equal(state.waveIn, original.waveIn);
    for (const node of state.nodes) {
      equal(validPoint(node), true);
      equal(node.y >= 160 && node.y <= 550, true);
      equal(state.buildings.every(building => distance(node, building) > 70), true);
      equal(state.nodes.every(other => node === other || distance(node, other) > 70), true);
    }
    layouts.add(JSON.stringify(state.nodes.map(node => [node.x, node.y])));
    state.nodes[0]!.remaining = 0;
    equal(seasonalNodes(season)[0]?.remaining, 800);
  }
  equal(layouts.size, 4);
});

test('Stronghold daylight starts clear, fades over fifteen seconds, and repeats every six minutes', () => {
  const duration = DAY_SECONDS + NIGHT_SECONDS;
  equal(daylight(0), { period: 'day', darkness: 0, cycle: 0 });
  equal(daylight(DAY_SECONDS - TWILIGHT_SECONDS).darkness, 0);
  equal(daylight(DAY_SECONDS - TWILIGHT_SECONDS / 2).darkness, .5);
  equal(daylight(DAY_SECONDS), { period: 'night', darkness: 1, cycle: 0 });
  equal(daylight(duration - TWILIGHT_SECONDS).darkness, 1);
  equal(daylight(duration - TWILIGHT_SECONDS / 2).darkness, .5);
  equal(daylight(duration), { period: 'day', darkness: 0, cycle: 1 });
  equal(daylight(duration * 3 + DAY_SECONDS), { period: 'night', darkness: 1, cycle: 3 });
  for (let elapsed = 0; elapsed <= duration * 2; elapsed++) {
    const light = daylight(elapsed);
    equal(light.darkness >= 0 && light.darkness <= 1, true);
  }
});

test('Stronghold tier challenges and completed matches freeze the day/night clock', () => {
  for (const phase of ['tier-up', 'won', 'lost'] as const) {
    const state = createStronghold({ resources: 50, length: 'medium', computersPaused: true });
    state.phase = phase;
    state.elapsed = DAY_SECONDS - .5;
    state.environmentElapsed = DAY_SECONDS - .5;
    advanceStronghold(state, 1);
    equal(state.elapsed, DAY_SECONDS - .5);
    equal(state.environmentElapsed, DAY_SECONDS - .5);
    equal(daylight(state.elapsed).period, 'day');
  }
});

test('Stronghold dev day/night skips affect only the environment clock and soundtrack, not battle simulation', () => {
  const state = createStronghold({ resources: 50, length: 'medium', computersPaused: true }, 'winter');
  state.elapsed = 12.25;
  state.environmentElapsed = 12.25;
  const player = state.players[0]!;
  for (const [period, expectedTime, title] of [
    ['night', DAY_SECONDS, 'Ethernight Club'],
    ['day', DAY_SECONDS + NIGHT_SECONDS, 'Voxel Revolution'],
    ['night', DAY_SECONDS * 2 + NIGHT_SECONDS, 'Ethernight Club']
  ] as const) {
    const before = structuredClone(state);
    executeCommand(state, player, { type: 'TIME_OF_DAY', period });
    equal(state.environmentElapsed, expectedTime);
    equal(daylight(state.environmentElapsed).period, period);
    equal(seasonalTrack(state.season, state.environmentElapsed).title, title);
    equal({ ...state, environmentElapsed: before.environmentElapsed, events: before.events }, before);
    const after = structuredClone(state);
    executeCommand(state, player, { type: 'TIME_OF_DAY', period });
    equal(state, after);
  }
  advanceStronghold(state, .5);
  equal(state.elapsed, 12.75);
  equal(state.environmentElapsed, DAY_SECONDS * 2 + NIGHT_SECONDS + .5);
});

test('Stronghold live season changes relocate nodes without refilling them or invalidating jobs and deliveries', () => {
  const state = createStronghold(undefined, 'summer');
  state.environmentElapsed = DAY_SECONDS;
  state.nodes[0]!.remaining = 0;
  state.nodes[5]!.remaining = 77;
  const worker = state.units.find(unit => unit.kind === 'worker')!;
  worker.task = state.nodes[5]!.id;
  state.chunks.push({ id: 999, x: worker.x, y: worker.y, amount: 4, target: state.buildings[0]!.id, carrier: worker.id });
  const player = state.players[0]!;
  for (const season of SEASONS) {
    const before = structuredClone(state);
    executeCommand(state, player, { type: 'SET_SEASON', season });
    equal(state.season, season);
    equal(state.nodes.map(({ x, y }) => [x, y]), seasonalNodes(season).map(({ x, y }) => [x, y]));
    equal(state.nodes.map(({ id, rich, remaining }) => [id, rich, remaining]),
      before.nodes.map(({ id, rich, remaining }) => [id, rich, remaining]));
    equal({ ...state, season: before.season, nodes: before.nodes, events: before.events }, before);
    equal(daylight(state.environmentElapsed).period, 'night');
    const after = structuredClone(state);
    executeCommand(state, player, { type: 'SET_SEASON', season });
    equal(state, after);
  }
});

test('Stronghold environment dev commands reject computers, invalid values and unavailable phases atomically', () => {
  const commands = [{ type: 'TIME_OF_DAY', period: 'night' }, { type: 'SET_SEASON', season: 'winter' }] as const;
  for (const command of commands) {
    for (const phase of ['playing', 'tier-up', 'won', 'lost'] as const) {
      const state = createStronghold(undefined, 'summer');
      state.phase = phase;
      const before = structuredClone(state);
      let rejected = false;
      try { executeCommand(state, state.players[phase === 'playing' ? 1 : 0]!, command); }
      catch (error) { rejected = error instanceof Error && error.message.length > 0; }
      equal(rejected, true);
      equal(state, before);
    }
  }
  for (const command of [
    { type: 'SET_SEASON', season: 'invalid' }, { type: 'TIME_OF_DAY', period: 'midnight' }
  ]) {
    const state = createStronghold();
    const before = structuredClone(state);
    let rejected = false;
    try { executeCommand(state, state.players[0]!, JSON.parse(JSON.stringify(command))); }
    catch (error) { rejected = error instanceof Error && error.message.length > 0; }
    equal(rejected, true);
    equal(state, before);
  }
  const engine = new StrongholdEngine();
  engine.send('you', { type: 'TIME_OF_DAY', period: 'night' });
  engine.restart();
  equal(engine.snapshot('you').environmentElapsed, 0);
});

test('Stronghold dev markup provides live season, day and night controls separate from saved match defaults', () => {
  const markup = strongholdWorkspaceMarkup();
  for (const id of ['stronghold-dev-season', 'stronghold-next-night', 'stronghold-next-day']) {
    equal(markup.includes(`id="${id}"`), true);
  }
  equal(markup.includes('Skip to Night'), true);
  equal(markup.includes('Skip to Day'), true);
});

test('Stronghold weather uses a fixed small decorative particle pool instead of growing the DOM', () => {
  const markup = weatherMarkup();
  equal((markup.match(/class="stronghold-weather-particle"/g) ?? []).length, 14);
  equal(markup.includes('aria-hidden="true"'), true);
  equal(markup.includes('<button'), false);
});

test('Stronghold autumn leaves randomly choose red, orange, yellow or brown for each particle', () => {
  equal(Object.isFrozen(AUTUMN_LEAF_COLORS), true);
  equal(AUTUMN_LEAF_COLORS, ['#c84b3d', '#e78b32', '#e4bc4c', '#8b5d3d']);
  for (let index = 0; index < AUTUMN_LEAF_COLORS.length; index++) {
    for (const offset of [0, .99999]) {
      const markup = weatherMarkup(() => (index + offset) / AUTUMN_LEAF_COLORS.length);
      equal((markup.match(new RegExp(`--leaf-color:${AUTUMN_LEAF_COLORS[index]}`, 'g')) ?? []).length, 14);
    }
  }
  let samples = 0;
  const markup = weatherMarkup(() => samples++ % AUTUMN_LEAF_COLORS.length / AUTUMN_LEAF_COLORS.length);
  equal(samples, 14);
  equal([...markup.matchAll(/--leaf-color:(#[a-f0-9]+)/g)].map(match => match[1]),
    Array.from({ length: 14 }, (_, index) => AUTUMN_LEAF_COLORS[index % AUTUMN_LEAF_COLORS.length]));
});
