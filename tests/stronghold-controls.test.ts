import { arrowLength, actionShortcutKey, taskShortcut } from '../src/stronghold/ui/keyboard.ts';
import { cameraBounds } from '../src/stronghold/ui/map-camera.ts';
import { unitMotionTransform } from '../src/stronghold/ui/battlefield.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { addUnit, createStronghold } from '../src/stronghold/domain/state.ts';
import { PHRASE_LENGTHS, ROLES } from '../src/stronghold/domain/types.ts';
import { validateDeveloperOptions } from '../src/stronghold/infrastructure/developer-options.ts';
import { equal, test } from './harness.ts';

test('Stronghold arrow lengths move in both axes, clamp at endpoints and leave other keys alone', () => {
  for (const [index, length] of PHRASE_LENGTHS.entries()) {
    for (const key of ['ArrowRight', 'ArrowUp']) equal(arrowLength(length, key), PHRASE_LENGTHS[Math.min(3, index + 1)]);
    for (const key of ['ArrowLeft', 'ArrowDown']) equal(arrowLength(length, key), PHRASE_LENGTHS[Math.max(0, index - 1)]);
    equal(arrowLength(length, 'a'), null);
  }
});

test('Stronghold role shortcuts use Alt+1 through Alt+0 without capturing bare numbers or AltGr', () => {
  equal(Array.from({ length: 10 }, (_, index) => taskShortcut(index)), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
  const key = { key: '2', code: 'Digit2', altKey: true, ctrlKey: false, metaKey: false };
  equal(actionShortcutKey(key), '2');
  equal(actionShortcutKey({ ...key, key: '¡', code: 'Digit1' }), '1');
  equal(actionShortcutKey({ ...key, altKey: false }), null);
  equal(actionShortcutKey({ ...key, ctrlKey: true }), null);
  equal(actionShortcutKey({ ...key, metaKey: true }), null);
  equal(actionShortcutKey({ ...key, key: 'ArrowUp', code: 'ArrowUp' }), null);
});

test('Stronghold every role option displays a unique matching numeric shortcut, including all ten Army tasks', () => {
  const markup = strongholdWorkspaceMarkup();
  const player = /<section class="stronghold-player" data-player="you">([\s\S]*?)<\/section>/.exec(markup)?.[1];
  if (!player) throw new Error('Missing Player 1 markup.');
  const counts = { economy: 4, production: 10, army: 1, defenses: 8 };
  for (const [index, role] of ROLES.entries()) {
    const start = player.indexOf(`data-role="${role}"`);
    const next = ROLES[index + 1];
    const end = next ? player.indexOf(`data-role="${next}"`, start) : player.length;
    const options = player.slice(start, end);
    equal([...options.matchAll(/data-shortcut="([0-9])"/g)].map(match => match[1]), Array.from({ length: counts[role] }, (_, index) => taskShortcut(index)));
    for (let option = 0; option < counts[role]; option++) {
      const digit = taskShortcut(option);
      equal(options.includes(`aria-keyshortcuts="Alt+${digit}"`), true);
      equal(options.includes(`<kbd class="stronghold-hotkey">Alt+${digit}</kbd>`), true);
    }
  }
  equal(markup.includes('id="stronghold-length" class="stronghold-length-wheel" role="listbox"'), true);
  equal(markup.includes('id="stronghold-zoom-fit"'), true);
});

test('Stronghold zoom camera stays within the full battlefield and Fit restores all legal construction sites', () => {
  equal(cameraBounds(1, { x: 500, y: 400 }), { x: 0, y: 0, width: 1000, height: 650 });
  equal(cameraBounds(2, { x: -1000, y: -1000 }), { x: 0, y: 0, width: 500, height: 325 });
  equal(cameraBounds(2, { x: 2000, y: 2000 }), { x: 500, y: 325, width: 500, height: 325 });
  const zoomed = cameraBounds(1.2, { x: 500, y: 400 });
  equal(zoomed.y + zoomed.height, 650);
  equal(zoomed.width < 1000 && zoomed.height < 650, true);
  equal(cameraBounds(10, { x: 500, y: 325 }).width, 500);
  for (const mapZoom of [NaN, Infinity, .5, 2.1]) {
    let rejected = false;
    try { validateDeveloperOptions({ resources: 50, length: 'medium', computersPaused: false, mapZoom }); }
    catch (error) { rejected = error instanceof Error && error.message.includes('map zoom'); }
    equal(rejected, true);
  }
});

test('Stronghold squares rock on alternating planted bottom corners while triangle walking stays unchanged', () => {
  const state = createStronghold();
  for (const [kind, formation] of [['warrior', null], ['invader', null], ['invader', 'warrior']] as const) {
    const unit = addUnit(state, kind, { x: 100, y: 100 }, formation);
    unit.id = 0;
    const previous = { x: 99, y: 100 };
    equal(unitMotionTransform(unit, previous, Math.PI / 32), 'rotate(14 8 8)');
    equal(unitMotionTransform(unit, previous, 3 * Math.PI / 32), 'rotate(-14 -8 8)');
    equal(unitMotionTransform(unit, unit, Math.PI / 32), '');
    equal(unitMotionTransform(unit, previous, Math.PI / 32, true), '');
    unit.attackTarget = { x: 120, y: 100 }; unit.cooldown = 1;
    equal(unitMotionTransform(unit, previous, Math.PI / 32), 'scale(1.15)');
  }
  for (const [kind, formation] of [['builder', null], ['catapult', null], ['invader', 'catapult']] as const) {
    const unit = addUnit(state, kind, { x: 100, y: 100 }, formation);
    unit.id = 0;
    equal(unitMotionTransform(unit, { x: 99, y: 100 }, Math.PI / 32), 'translate(0 1.5) rotate(5)');
  }
});
