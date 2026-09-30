import { addUnit, createStronghold } from '../src/stronghold/domain/state.ts';
import { unitMarkup } from '../src/stronghold/ui/battlefield.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { equal, test } from './harness.ts';

test('Stronghold enemies use dark-red squares, diamonds and triangles with red outlines', () => {
  const state = createStronghold();
  for (const formation of [null, 'warrior', 'archer', 'catapult'] as const) {
    const markup = unitMarkup(addUnit(state, 'invader', { x: 500, y: 100 }, formation), false);
    equal(markup.includes('fill="#870018" stroke="#ff1726" stroke-width="2"'), true);
    equal(markup.includes(formation === 'archer' ? 'M0 -10 L8 0 L0 10 L-8 0 Z'
      : formation === 'catapult' ? 'M0 -12 L10 9 L-10 9 Z' : '<rect x="-8" y="-8" width="16" height="16"'), true);
    equal(markup.includes('#91a8b7'), false);
  }
  equal(unitMarkup(addUnit(state, 'warrior', { x: 500, y: 500 }), false).includes('fill="#ffb3c9"'), true);
});

test('Stronghold concise controls retain accessible labels and essential costs', () => {
  const markup = strongholdWorkspaceMarkup();
  equal(markup.includes("Private phrase / teammate's typing below"), false);
  equal(markup.includes('Waiting to type...'), false);
  equal(markup.includes('(T1 unit)'), false);
  equal(markup.includes('class="stronghold-tier-help"'), false);
  equal(markup.includes('<span class="sr-only">Supplies: </span>'), true);
  equal(markup.includes('<span class="sr-only"> supplies</span>'), true);
  equal(markup.includes('for="stronghold-input"'), true);
  equal(markup.includes('for="stronghold-role-you"'), true);
  equal(markup.includes('id="stronghold-enemy"'), true);
});
