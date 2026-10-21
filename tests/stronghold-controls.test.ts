import { arrowPan, typingLengthKey, nextTaskIndex, actionShortcutKey, taskShortcut } from '../src/stronghold/ui/keyboard.ts';
import { cameraBounds } from '../src/stronghold/ui/map-camera.ts';
import { buildingMarkup, unitMarkup, unitMotionTransform } from '../src/stronghold/ui/battlefield.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { addBuilding, addUnit, createStronghold } from './stronghold-fixtures.ts';
import { PHRASE_LENGTHS, PLAYER_COLORS, ROLES } from '../src/stronghold/domain/types.ts';
import { validateDeveloperOptions } from '../src/stronghold/infrastructure/developer-options.ts';
import { WALL_HALF_WIDTH } from '../src/stronghold/domain/navigation.ts';
import { equal, test } from './harness.ts';

test('Stronghold Page Up and Page Down change length, clamp at endpoints and leave arrows for map panning', () => {
  for (const [index, length] of PHRASE_LENGTHS.entries()) {
    equal(typingLengthKey(length, 'PageUp'), PHRASE_LENGTHS[Math.min(3, index + 1)]);
    equal(typingLengthKey(length, 'PageDown'), PHRASE_LENGTHS[Math.max(0, index - 1)]);
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'a']) equal(typingLengthKey(length, key), null);
  }
});

test('Stronghold task cycling wraps forwards and backwards without treating paid actions as tasks', () => {
  equal(nextTaskIndex(0, 3, false), 1);
  equal(nextTaskIndex(1, 3, false), 2);
  equal(nextTaskIndex(2, 3, false), 0);
  equal(nextTaskIndex(0, 3, true), 2);
  equal(nextTaskIndex(2, 3, true), 1);
  equal(nextTaskIndex(-1, 3, false), 0);
  equal(nextTaskIndex(-1, 3, true), 2);
  equal(nextTaskIndex(0, 0, false), null);
  equal(nextTaskIndex(0, 1, true), 0);
  const markup = strongholdWorkspaceMarkup();
  const economy = /data-role="economy">([\s\S]*?)data-role="production"/.exec(markup)?.[1];
  if (!economy) throw new Error('Missing economy tasks.');
  equal([...economy.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]), ['worker', 'relay', 'resources', 'upgrade']);
  equal([...economy.matchAll(/data-shortcut="([^"]+)"/g)].map(match => match[1]), ['1', '2', '3', '4']);
  equal(markup.includes('aria-keyshortcuts="PageUp PageDown"'), true);
  equal(markup.includes('Command desk'), false);
  equal(markup.includes('Tab: switch task / Arrows: pan'), false);
  equal(markup.indexOf('class="stronghold-length-keys"') < markup.indexOf('id="stronghold-length"'), true);
});

test('Stronghold places input before the prompt and replaces tier labels with accessible lock icons', () => {
  const markup = strongholdWorkspaceMarkup();
  equal(markup.indexOf('id="stronghold-input"') < markup.indexOf('id="stronghold-phrase"'), true);
  equal(markup.includes('Place at T1'), false);
  equal(markup.includes('data-tier-lock'), true);
  equal(markup.includes('<span>PgUp</span><span>PgDn</span>'), true);
  equal(markup.includes('data-tooltip="Defend (Alt+2)"'), true);
});

test('Stronghold map entities retain accessible descriptions without delayed native SVG tooltips', () => {
  const state = createStronghold();
  const unit = unitMarkup(addUnit(state, 'warrior', { x: 500, y: 500 }), false);
  const building = buildingMarkup(addBuilding(state, 'relay', { x: 400, y: 400 }));
  for (const markup of [unit, building]) {
    equal(markup.includes('<desc>'), true);
    equal(markup.includes('<title>'), false);
  }
});

test('Stronghold friendly and enemy archers bob slowly even when standing or attacking', () => {
  const state = createStronghold();
  for (const [kind, formation] of [['archer', null], ['invader', 'archer']] as const) {
    const unit = addUnit(state, kind, { x: 100, y: 100 }, formation);
    unit.id = 0;
    equal(unitMotionTransform(unit, unit, 0), 'translate(0 0)');
    equal(unitMotionTransform(unit, unit, Math.PI / 4.4), 'translate(0 2.5)');
    equal(unitMotionTransform(unit, unit, 3 * Math.PI / 4.4), 'translate(0 -2.5)');
    unit.attackTarget = { x: 120, y: 100 }; unit.cooldown = 1;
    equal(unitMotionTransform(unit, unit, Math.PI / 4.4), 'translate(0 2.5) scale(1.15)');
    equal(unitMotionTransform(unit, unit, Math.PI / 4.4, true), '');
  }
});

test('Stronghold builders bob quickly only while actively building or repairing', () => {
  const state = createStronghold(), builder = addUnit(state, 'builder', { x: 100, y: 100 });
  builder.id = 0;
  equal(unitMotionTransform(builder, builder, Math.PI / 48), '');
  builder.attackTarget = { x: 110, y: 100 }; builder.cooldown = 1;
  equal(unitMotionTransform(builder, builder, Math.PI / 48), 'translate(0 1.25)');
  equal(unitMotionTransform(builder, builder, 3 * Math.PI / 48), 'translate(0 -1.25)');
  equal(unitMotionTransform(builder, builder, Math.PI / 48, true), '');
  builder.attackTarget = null;
  equal(unitMotionTransform(builder, builder, Math.PI / 48), '');
});

test('Stronghold work effects use silver sparks instead of the copper and ember combat strike', () => {
  const state = createStronghold();
  for (const kind of ['worker', 'builder'] as const) {
    const markup = unitMarkup(addUnit(state, kind, { x: 100, y: 100 }), false);
    equal(markup.includes('data-work'), true);
    equal(markup.includes('data-attack'), false);
    equal(markup.includes('#dce7f0'), true);
    equal(markup.includes('stronghold-work-glow'), true);
  }
  for (const kind of ['warrior', 'archer', 'catapult', 'invader'] as const) {
    const markup = unitMarkup(addUnit(state, kind, { x: 100, y: 100 }), false);
    equal(markup.includes('data-attack'), true);
    equal(markup.includes('data-work'), false);
    equal(markup.includes('#483526'), kind !== 'invader');
    equal(markup.includes('#ed914c'), true);
  }
  equal(buildingMarkup(addBuilding(state, 'tower', { x: 200, y: 100 })).includes('data-attack'), true);
  equal(buildingMarkup(addBuilding(state, 'barracks', { x: 300, y: 100 })).includes('height="6"'), true);
});

test('Stronghold enemy attacks retain the explosion without beam, trail or slash lines', () => {
  const state = createStronghold();
  const enemies = ([null, 'warrior', 'archer', 'catapult'] as const).map(formation =>
    unitMarkup(addUnit(state, 'invader', { x: 100, y: 100 }, formation), false));
  enemies.push(buildingMarkup(addBuilding(state, 'tower', { x: 200, y: 100 }, true, true)));
  for (const markup of enemies) {
    equal(markup.includes('data-impact'), true);
    equal(markup.includes('fill="#9c572d"'), true);
    equal(markup.includes('data-beam'), false);
    equal(markup.includes('data-trail'), false);
    equal(markup.includes('#fff1d2'), false);
  }
  const friendly = unitMarkup(addUnit(state, 'warrior', { x: 300, y: 100 }), false);
  equal(friendly.includes('data-beam'), true);
  equal(friendly.includes('data-trail'), true);
  equal(friendly.includes('#fff1d2'), true);
});

test('Stronghold wall visuals are 25 percent thicker and match collision thickness including their border', () => {
  const state = createStronghold();
  const markup = buildingMarkup(addBuilding(state, 'wall', { x: 300, y: 400 }));
  const shape = /<rect data-wall-shape[^>]*>/.exec(markup)?.[0];
  if (!shape) throw new Error('Missing wall shape.');
  const height = Number(/height="([^"]+)"/.exec(shape)?.[1]);
  const stroke = Number(/stroke-width="([^"]+)"/.exec(shape)?.[1]);
  const y = Number(/ y="([^"]+)"/.exec(shape)?.[1]);
  equal(height + stroke, 11 * 1.25);
  equal(height + stroke, WALL_HALF_WIDTH * 2);
  equal(y - stroke / 2, -WALL_HALF_WIDTH);
});

test('Stronghold arrow panning combines simultaneous keys and opposite directions cancel', () => {
  equal(arrowPan(new Set()), { x: 0, y: 0 });
  equal(arrowPan(new Set(['ArrowLeft', 'ArrowUp'])), { x: -1, y: -1 });
  equal(arrowPan(new Set(['ArrowRight', 'ArrowDown'])), { x: 1, y: 1 });
  equal(arrowPan(new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])), { x: 0, y: 0 });
  equal(arrowPan(new Set(['PageUp', 'PageDown', 'Tab'])), { x: 0, y: 0 });
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

test('Stronghold military panels omit Supplies and every remaining task has a matching numeric shortcut', () => {
  const markup = strongholdWorkspaceMarkup();
  const player = /<section class="stronghold-player" data-player="you">([\s\S]*?)<\/section>/.exec(markup)?.[1];
  if (!player) throw new Error('Missing Player 1 markup.');
  const counts = { economy: 4, production: 9, army: 0, defenses: 8 };
  for (const [index, role] of ROLES.entries()) {
    const start = player.indexOf(`data-role="${role}"`);
    const next = ROLES[index + 1];
    const end = next ? player.indexOf(`data-role="${next}"`, start) : player.length;
    const options = player.slice(start, end);
    if (role === 'production' || role === 'army') equal(options.includes('data-action="resources"'), false);
    equal([...options.matchAll(/data-shortcut="([0-9])"/g)].map(match => match[1]), Array.from({ length: counts[role] }, (_, index) => taskShortcut(index)));
    for (let option = 0; option < counts[role]; option++) {
      const digit = taskShortcut(option);
      equal(options.includes(`aria-keyshortcuts="Alt+${digit}"`), true);
      equal(options.includes('<kbd'), false);
    }
  }
  equal(markup.includes('id="stronghold-length" class="stronghold-length-wheel" role="listbox"'), true);
  for (const id of ['stronghold-zoom-fit', 'stronghold-zoom-in', 'stronghold-zoom-out', 'stronghold-zoom']) {
    equal(markup.includes(`id="${id}"`), false);
  }
  equal(markup.includes('aria-keyshortcuts="Alt+R"'), true);
  equal(markup.includes('class="stronghold-action-label">Queue '), false);
  equal(markup.includes('data-training-queued>0 queued'), true);
  equal(markup.includes('id="stronghold-next-wave" type="button">Next Wave</button>'), true);
  const orders = /<section id="stronghold-army-orders"[\s\S]*?<\/section>/.exec(markup)?.[0];
  if (!orders) throw new Error('Missing Unit Control orders.');
  equal([...orders.matchAll(/data-shortcut="([0-9])"/g)].map(match => match[1]), ['1', '2', '3', '4']);
});

test('Stronghold zoom camera stays within the full battlefield and minimum zoom exposes all legal construction sites', () => {
  equal(cameraBounds(1, { x: 500, y: 400 }), { x: 0, y: 0, width: 1000, height: 650 });
  equal(cameraBounds(2, { x: -1000, y: -1000 }), { x: 0, y: 0, width: 500, height: 325 });
  equal(cameraBounds(2, { x: 2000, y: 2000 }), { x: 500, y: 325, width: 500, height: 325 });
  const zoomed = cameraBounds(1.2, { x: 500, y: 400 });
  equal(zoomed.y + zoomed.height, 650);
  equal(zoomed.width < 1000 && zoomed.height < 650, true);
  equal(cameraBounds(10, { x: 500, y: 325 }).width, 500);
  for (const mapZoom of [NaN, Infinity, .5, 2.1]) {
    let rejected = false;
    try { validateDeveloperOptions({ resources: 50, length: 'medium', computersPaused: false, mapZoom, playerColor: PLAYER_COLORS.Red }); }
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
