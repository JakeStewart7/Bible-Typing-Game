import { daylight, DAY_SECONDS, NIGHT_SECONDS, randomSeason, seasonalNodes, TWILIGHT_SECONDS } from '../src/stronghold/domain/environment.ts';
import { SEASONS } from '../src/stronghold/domain/types.ts';
import { createStronghold } from '../src/stronghold/domain/state.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { weatherMarkup } from '../src/stronghold/ui/environment.ts';
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
  engine.restart();
  equal(SEASONS.includes(engine.snapshot('you').season), true);
  equal(engine.snapshot('you').elapsed, 0);
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
    advanceStronghold(state, 1);
    equal(state.elapsed, DAY_SECONDS - .5);
    equal(daylight(state.elapsed).period, 'day');
  }
});

test('Stronghold weather uses a fixed small decorative particle pool instead of growing the DOM', () => {
  const markup = weatherMarkup();
  equal((markup.match(/class="stronghold-weather-particle"/g) ?? []).length, 14);
  equal(markup.includes('aria-hidden="true"'), true);
  equal(markup.includes('<button'), false);
});
