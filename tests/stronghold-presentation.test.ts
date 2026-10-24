import { addUnit, createStronghold } from './stronghold-fixtures.ts';
import { unitMarkup } from '../src/stronghold/ui/battlefield.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { equal, test } from './harness.ts';
import { PLAYER_COLORS } from '../src/stronghold/domain/types.ts';

test('Stronghold role and order icons are outlined and cost badges reuse the resource symbol', () => {
  const markup = strongholdWorkspaceMarkup();
  const sword = /id="stronghold-role-you-production"[\s\S]*?<\/button>/.exec(markup)?.[0];
  const economy = /id="stronghold-role-you-economy"[\s\S]*?<\/button>/.exec(markup)?.[0];
  if (!sword || !economy) throw new Error('Missing role icons.');
  equal(sword.includes('fill="none"'), true);
  equal(sword.includes('fill="currentColor"'), false);
  equal(economy.includes('class="stronghold-symbol stronghold-symbol--resource"'), true);
  equal(economy.includes('<svg'), false);
  equal(sword.includes('M7 15L17 3L22 2L21 7L11 19Z'), true);
  const cursor = /id="stronghold-role-you-army"[\s\S]*?<\/button>/.exec(markup)?.[0];
  equal(cursor?.includes('fill="none" stroke="currentColor"'), true);
  equal(cursor?.includes('fill="currentColor"'), false);
  equal(markup.includes('id="stronghold-phrase" class="text-display" data-horizontal-scroll="true"'), true);
  equal(markup.includes('id="stronghold-tier-price">300</span>'), true);
  const prices = [...markup.matchAll(/class="stronghold-cost"[^>]*>([\s\S]*?)<\/i>/g)];
  equal(prices.length > 10, true);
  equal(prices.every(price => price[1]?.includes('stronghold-symbol--resource')), true);
  for (const id of ['select-army', 'defend', 'assault', 'rally']) {
    const button = new RegExp(`id="stronghold-${id}"[\\s\\S]*?<\\/button>`).exec(markup)?.[0];
    equal(button?.includes('<svg'), true);
    equal(button?.includes('<kbd aria-hidden="true">'), true);
  }
});

test('Stronghold enemies use dark-red squares, diamonds and siege carts with red outlines', () => {
  const state = createStronghold();
  for (const formation of [null, 'warrior', 'archer', 'catapult'] as const) {
    const markup = unitMarkup(addUnit(state, 'invader', { x: 500, y: 100 }, formation), false);
    equal(markup.includes('fill="#870018" stroke="#ff1726" stroke-width="2"'), true);
    equal(markup.includes(formation === 'archer' ? 'M0 -10 L8 0 L0 10 L-8 0 Z'
      : formation === 'catapult' ? 'data-catapult' : '<rect x="-8" y="-8" width="16" height="16"'), true);
    equal(markup.includes('#91a8b7'), false);
  }
  equal(unitMarkup(addUnit(state, 'warrior', { x: 500, y: 500 }), false).includes('fill="#dce2e8" stroke="#65727e"'), true);
});

test('Stronghold concise controls retain accessible labels and essential costs', () => {
  const markup = strongholdWorkspaceMarkup();
  equal(markup.includes("Private phrase / teammate's typing below"), false);
  equal(markup.includes('Waiting to type...'), false);
  equal(markup.includes('(T1 unit)'), false);
  equal(markup.includes('class="stronghold-tier-help"'), false);
  equal(markup.includes('<span>Supplies</span>'), false);
  equal(markup.includes('<span class="sr-only">Shared supplies: </span>'), true);
  equal(markup.includes('Typing produces shared supplies.'), true);
  equal(markup.indexOf('id="stronghold-resources"') < markup.indexOf('id="stronghold-tower-count"'), true);
  equal(markup.includes('<span class="sr-only"> supplies</span>'), true);
  equal(markup.includes('for="stronghold-input"'), true);
  equal(markup.includes('role="group" aria-label="Player 1 role"'), true);
  equal(markup.includes('class="stronghold-role-select"'), false);
  for (const id of ['stronghold-castle', 'stronghold-enemy', 'stronghold-wave', 'stronghold-season']) {
    equal(markup.includes(`id="${id}"`), false);
  }
  equal(markup.includes('class="stronghold-tier-mount"'), true);
  equal(markup.includes('id="stronghold-dev-color"'), true);
  for (const [name, color] of Object.entries(PLAYER_COLORS)) equal(markup.includes(`<option value="${color}">${name}</option>`), true);
});

test('Stronghold compact command bar retains unique controls and leaves the map and player panels outside it', () => {
  const markup = strongholdWorkspaceMarkup();
  const bar = markup.match(/<header class="stronghold-command-bar"[\s\S]*?<\/header>/)?.[0];
  if (!bar) throw new Error('Missing Stronghold command bar.');
  for (const id of ['stronghold-pause', 'stronghold-restart', 'stronghold-computers', 'stronghold-music',
    'stronghold-volume', 'stronghold-open-credits', 'stronghold-ready', 'stronghold-dev-form']) {
    equal(bar.includes(`id="${id}"`), true);
    equal(markup.split(`id="${id}"`).length, 2);
  }
  equal(bar.includes('stronghold-guide-content'), true);
  equal(bar.includes('stronghold-map-camera'), false);
  equal(bar.includes('stronghold-squad'), false);
  for (const tier of [1, 2, 3]) equal(markup.includes(`Barracks T${tier}`), true);
});
