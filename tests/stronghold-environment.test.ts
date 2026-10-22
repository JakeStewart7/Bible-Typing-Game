import { daylight, DAY_SECONDS, NIGHT_SECONDS, randomSeason, seasonalNodes, TWILIGHT_SECONDS } from '../src/stronghold/domain/environment.ts';
import { SEASONS } from '../src/stronghold/domain/types.ts';
import { addUnit, createStronghold } from '../src/stronghold/domain/state.ts';
import { moveUnitToward } from '../src/stronghold/domain/navigation.ts';
import { updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { AUTUMN_LEAF_COLORS, weatherMarkup } from '../src/stronghold/ui/environment.ts';
import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { seasonalTrack } from '../src/stronghold/audio/catalog.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { distance, validPoint } from '../src/stronghold/domain/rules.ts';
import { equal, test } from './harness.ts';

function withSeasonSamples(samples: number[], run: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'getRandomValues');
  const originalRandom = Math.random;
  let draws = 0;
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    configurable: true,
    value: (values: Uint32Array): Uint32Array => {
      equal(values instanceof Uint32Array, true);
      equal(values.length, 1);
      const sample = samples[draws++];
      if (sample === undefined) throw new Error('Unexpected season random draw.');
      values[0] = sample;
      return values;
    }
  });
  Math.random = () => .99999;
  try { run(); equal(draws, samples.length); }
  finally {
    Math.random = originalRandom;
    if (descriptor) Object.defineProperty(globalThis.crypto, 'getRandomValues', descriptor);
    else equal(Reflect.deleteProperty(globalThis.crypto, 'getRandomValues'), true);
  }
}

test('Stronghold default season draws use independent system randomness with equal quarter-range boundaries', () => {
  withSeasonSamples([0, 0x3fffffff, 0x40000000, 0x7fffffff, 0x80000000, 0xbfffffff, 0xc0000000, 0xffffffff], () => {
    equal(Array.from({ length: 8 }, () => randomSeason()),
      ['spring', 'spring', 'summer', 'summer', 'fall', 'fall', 'winter', 'winter']);
  });
});

test('Stronghold every new match draws a fresh season even after a developer override or a repeated draw', () => {
  withSeasonSamples([0, 0x40000000, 0x80000000, 0xc0000000, 0xc0000000, 0], () => {
    const engine = new StrongholdEngine({ resources: 75, length: 'long', computersPaused: true });
    equal(engine.snapshot('you').season, 'spring');
    engine.send('you', { type: 'SET_SEASON', season: 'winter' });
    equal(engine.snapshot('you').season, 'winter');
    for (const season of ['summer', 'fall', 'winter', 'winter', 'spring']) {
      engine.restart();
      const snapshot = engine.snapshot('you');
      equal(snapshot.season, season);
      equal(snapshot.environmentElapsed, 0);
      equal(snapshot.resources, 75);
      equal(snapshot.computersPaused, true);
      equal(snapshot.players.every(player => player.length === 'long'), true);
    }
  });
});

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
    ['night', DAY_SECONDS, 'Envision'],
    ['day', DAY_SECONDS + NIGHT_SECONDS, 'Voxel Revolution'],
    ['night', DAY_SECONDS * 2 + NIGHT_SECONDS, 'Envision']
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
  state.chunks.push({ id: 999, x: worker.x, y: worker.y, amount: 4, rich: false, target: state.buildings[0]!.id, carrier: worker.id });
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
  equal((markup.match(/class="stronghold-weather-particle"/g) ?? []).length, 36);
  equal(markup.includes('aria-hidden="true"'), true);
  equal(markup.includes('<button'), false);
  for (const axis of ['x', 'y']) {
    const positions = [...markup.matchAll(new RegExp(`--weather-${axis}:(\\d+)%`, 'g'))].map(match => Number(match[1]));
    equal(positions.length, 36);
    equal(new Set(positions.map(position => Math.floor(position / 25))).size, 4);
  }
});

test('Stronghold spring flowers share one randomly chosen breeze direction across the particle pool', () => {
  const directions = [0, .25, .5, .75].map(sample => {
    const markup = weatherMarkup(() => sample);
    equal((markup.match(/--breeze-x:/g) ?? []).length, 1);
    equal((markup.match(/--breeze-y:/g) ?? []).length, 1);
    const x = Number(/--breeze-x:([-\d.]+)px/.exec(markup)?.[1]);
    const y = Number(/--breeze-y:([-\d.]+)px/.exec(markup)?.[1]);
    equal(Math.round(Math.hypot(x, y)), 160);
    return { x: Math.round(x), y: Math.round(y) };
  });
  equal(directions, [{ x: 160, y: 0 }, { x: 0, y: 160 }, { x: -160, y: 0 }, { x: 0, y: -160 }]);
});

test('Stronghold autumn leaves randomly choose red, orange, yellow or brown for each particle', () => {
  equal(Object.isFrozen(AUTUMN_LEAF_COLORS), true);
  equal(AUTUMN_LEAF_COLORS, ['#c84b3d', '#e78b32', '#e4bc4c', '#8b5d3d']);
  for (let index = 0; index < AUTUMN_LEAF_COLORS.length; index++) {
    for (const offset of [0, .99999]) {
      const markup = weatherMarkup(() => (index + offset) / AUTUMN_LEAF_COLORS.length);
      equal((markup.match(new RegExp(`--leaf-color:${AUTUMN_LEAF_COLORS[index]}`, 'g')) ?? []).length, 36);
    }
  }
  let samples = 0;
  const markup = weatherMarkup(() => samples++ % AUTUMN_LEAF_COLORS.length / AUTUMN_LEAF_COLORS.length);
  equal(samples, 37);
  equal([...markup.matchAll(/--leaf-color:(#[a-f0-9]+)/g)].map(match => match[1]),
    Array.from({ length: 36 }, (_, index) => AUTUMN_LEAF_COLORS[(index + 1) % AUTUMN_LEAF_COLORS.length]));
});

test('Stronghold seasonal movement applies equally to every friendly unit and enemy formation', () => {
  for (const [season, travel] of [['spring', 100], ['summer', 115], ['fall', 100], ['winter', 85]] as const) {
    const state = createStronghold(undefined, season);
    state.buildings = []; state.units = [];
    for (const [kind, formation] of [
      ['worker', null], ['builder', null], ['warrior', null], ['archer', null], ['catapult', null],
      ['invader', null], ['invader', 'archer'], ['invader', 'catapult']
    ] as const) {
      const unit = addUnit(state, kind, { x: 100, y: 300 }, formation);
      moveUnitToward(state, unit, { x: 900, y: 300 }, 100);
      equal(Math.round((unit.x - 100) * 100) / 100, travel);
      equal(unit.y, 300);
    }
  }
});

test('Stronghold seasonal resource value applies once to typed supplies and castle deliveries, including upgrades', () => {
  for (const [season, typed, upgraded, delivered] of [
    ['spring', 21.6, 57.6, 69.6], ['summer', 18, 48, 58],
    ['fall', 18, 48, 58], ['winter', 14.4, 38.4, 46.4]
  ] as const) {
    const state = createStronghold({ resources: 0, length: 'short', computersPaused: true }, season);
    const player = state.players[0]!;
    executeCommand(state, player, { type: 'ACTION', action: 'resources' });
    player.work = 31; player.phrase = 'a';
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: 'a' });
    equal(state.resources, typed);
    state.upgrades.economy = 2; player.work = 31; player.phrase = 'b';
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: 'b' });
    equal(state.resources, upgraded);
    const castle = state.buildings.find(building => building.kind === 'castle')!;
    state.units = [];
    state.chunks.push({ id: 999, x: castle.x, y: castle.y, amount: 10, rich: false, target: castle.id, carrier: null });
    updateLogistics(state, .1);
    equal(state.resources, delivered); equal(state.chunks.length, 0);
    updateLogistics(state, .1);
    equal(state.resources, delivered);
  }
});

test('Stronghold fall adds fifteen percent to every completed typing task, including during world events', () => {
  for (const [role, action] of [['economy', 'worker'], ['production', 'barracks'], ['army', 'resources'], ['defenses', 'wall']] as const) {
    for (const [event, phrase] of [['peace', 'abcdefghijkl'], ['numbers', '123456789012'], ['symbols', '+=!?[]{}()?!']] as const) {
      const state = createStronghold({ resources: 0, length: 'long', computersPaused: true }, 'fall');
      const player = state.players[0]!;
      state.tier = 3; state.event = event;
      executeCommand(state, player, { type: 'ROLE', role });
      executeCommand(state, player, { type: 'ACTION', action });
      player.phrase = phrase;
      executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: phrase.slice(0, -1) });
      equal(player.work, 0);
      executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: phrase });
      equal(player.work, 17.25);
      equal(state.resources, 0);
    }
  }
});

test('Stronghold fall boosts completed tier phrases without partial credit, rounding drift or duplicate unlocks', () => {
  const state = createStronghold({ resources: 0, length: 'medium', computersPaused: true }, 'fall');
  const player = state.players[0]!;
  executeCommand(state, player, { type: 'READY', ready: true });
  player.phrase = 'abcdef';
  const first = { type: 'TYPE' as const, phraseId: player.phraseId, text: player.phrase };
  executeCommand(state, player, first);
  equal(player.contribution, 6.9);
  player.contribution = 498;
  const final = { type: 'TYPE' as const, phraseId: player.phraseId, text: player.phrase };
  executeCommand(state, player, { ...final, text: final.text.slice(0, -1) });
  equal(player.contribution, 498); equal(state.tier, 0);
  executeCommand(state, player, final);
  equal(player.contribution, 500); equal(state.tier, 1); equal(state.phase, 'playing');
  let expired = false;
  try { executeCommand(state, player, final); } catch (error) { expired = error instanceof Error && error.message.includes('expired'); }
  equal(expired, true); equal(state.tier, 1);
});

test('Stronghold changing season applies current bonuses immediately without rewriting cargo or earned supplies', () => {
  const state = createStronghold(undefined, 'summer');
  state.buildings = state.buildings.filter(building => building.kind === 'castle'); state.units = [];
  const unit = addUnit(state, 'warrior', { x: 100, y: 300 });
  moveUnitToward(state, unit, { x: 900, y: 300 }, 100);
  equal(Math.round(unit.x), 215);
  executeCommand(state, state.players[0]!, { type: 'SET_SEASON', season: 'winter' });
  moveUnitToward(state, unit, { x: 900, y: 300 }, 100);
  equal(Math.round(unit.x), 300);
  const castle = state.buildings[0]!;
  state.chunks.push({ id: 999, x: castle.x, y: castle.y, amount: 10, rich: false, target: castle.id, carrier: null });
  executeCommand(state, state.players[0]!, { type: 'SET_SEASON', season: 'spring' });
  equal(state.chunks[0]!.amount, 10); equal(state.resources, 50);
  updateLogistics(state, .1);
  equal(state.resources, 62);
});
