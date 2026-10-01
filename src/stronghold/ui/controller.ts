import { createGame, type Game } from '../../game/state.ts';
import { requireElement } from '../../shared/dom.ts';
import { renderTypingExperience, updateTypingInput } from '../../typing/session.ts';
import { PHRASE_LENGTHS, ROLES, type Point, type StrongholdCommand, type StrongholdConnection, type StrongholdSnapshot } from '../domain/types.ts';
import { distance } from '../domain/rules.ts';
import { renderStronghold, strongholdElements } from './view.ts';
import { mapPoint, readyBuilding, troopsInRectangle, type PlacementKind } from './map-controls.ts';
import { setText } from './dom-updates.ts';

export function createStrongholdController(connection: StrongholdConnection) {
  const elements = strongholdElements();
  const selected = new Set<number>();
  let snapshot: StrongholdSnapshot | null = null;
  let typing: Game = createGame('');
  let phraseId = -1;
  let shown = false;
  let paused = false;
  let errorMessage = '';
  let typingDirty = true;
  let newEntry = true;
  let typingLayout = '';
  let relayPlacement = false;
  let placementCancelled = false;
  let rallyPlacement = false;
  let cursor: Point | null = null;
  let drag: { start: Point; end: Point; pointer: number; additive: boolean; unitId: number | null; moved: boolean } | null = null;
  const running = (): boolean => shown && !paused && !document.hidden;
  const self = () => snapshot?.players.find(player => player.id === snapshot?.selfId);
  const placing = (): PlacementKind | null => snapshot && running() && snapshot.phase === 'playing' && !placementCancelled
    ? relayPlacement ? 'relay' : readyBuilding(snapshot) : null;
  function focusTyping(): void {
    if (running() && !elements.input.disabled && !(document.activeElement instanceof HTMLSelectElement)) {
      elements.input.focus({ preventScroll: true });
    }
  }
  function clearDrag(): void {
    if (drag && elements.map.hasPointerCapture(drag.pointer)) elements.map.releasePointerCapture(drag.pointer);
    drag = null;
    elements.mapControls.selection(null, null);
  }
  function display(): void {
    if (!snapshot) return;
    renderStronghold(elements, snapshot, selected, running(), paused, relayPlacement, placementCancelled);
    elements.mapControls.ghost(snapshot, placing(), cursor);
    const selecting = drag?.moved && self()?.role === 'army' && !placing() && !rallyPlacement;
    elements.mapControls.selection(selecting ? drag?.start ?? null : null, selecting ? drag?.end ?? null : null);
    const feedback = errorMessage || (paused ? 'Paused' : rallyPlacement ? 'Click the map to set the rally point. Escape cancels.' : snapshot.message);
    setText(elements.feedback, feedback);
    elements.feedback.classList.toggle('is-hidden', !feedback);
    const layout = `${snapshot.phase}/${running()}/${elements.privateTyping.parentElement?.id}`;
    if (typingDirty || layout !== typingLayout) {
      renderTypingExperience(typing, { text: elements.phrase, typedBar: elements.typedBar, progressFill: elements.progressFill },
        newEntry || layout !== typingLayout ? 'teleport' : 'track');
      typingDirty = false;
      newEntry = false;
      typingLayout = layout;
    }
  }
  async function send(command: StrongholdCommand): Promise<void> {
    if (!running()) { errorMessage = 'Resume Stronghold before issuing orders.'; display(); return; }
    try { errorMessage = ''; await connection.send(command); }
    catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      display();
    } finally { focusTyping(); }
  }
  const unsubscribe = connection.subscribe(next => {
    const previousRole = self()?.role;
    snapshot = next;
    const player = self();
    if (!player) throw new Error('Stronghold snapshot has no local player.');
    if (previousRole !== player.role) {
      relayPlacement = false; placementCancelled = false; rallyPlacement = false; clearDrag();
    }
    const changedPhrase = phraseId !== player.phraseId;
    if (changedPhrase) {
      phraseId = player.phraseId;
      typing = createGame(player.phrase);
      typingDirty = true;
      newEntry = true;
      elements.input.value = player.typed;
      if (player.typed) updateTypingInput(typing, player.typed);
    } else if (elements.input.value !== player.typed) {
      elements.input.value = player.typed;
      updateTypingInput(typing, player.typed);
      typingDirty = true;
    }
    for (const id of selected) if (!next.units.some(unit => unit.id === id)) selected.delete(id);
    display();
    if (changedPhrase) focusTyping();
  });
  function cancelPlacement(): void {
    relayPlacement = false; placementCancelled = true; rallyPlacement = false;
    errorMessage = ''; clearDrag(); display(); focusTyping();
  }
  function togglePause(): void {
    paused = !paused;
    clearDrag();
    connection.setActive(running());
    display(); focusTyping();
  }
  function restart(): void {
    paused = false;
    selected.clear();
    relayPlacement = false; placementCancelled = false; rallyPlacement = false;
    errorMessage = ''; phraseId = -1;
    clearDrag();
    connection.restart();
    connection.setActive(running());
    focusTyping();
  }
  function place(point: Point): void {
    const kind = placing();
    if (kind) void send({ type: 'PLACE', kind, point });
  }
  function armyIds(): number[] {
    return snapshot?.units.filter(unit => ['warrior', 'archer', 'catapult'].includes(unit.kind)).map(unit => unit.id) ?? [];
  }
  function move(point: Point, all = false): void {
    const ids = all ? armyIds() : [...selected];
    if (ids.length === 0) { errorMessage = 'Select troops first, or use Select all troops.'; display(); focusTyping(); return; }
    void send({ type: 'MOVE', ids, point });
  }
  elements.input.addEventListener('input', () => {
    if (!snapshot) return;
    updateTypingInput(typing, elements.input.value);
    typingDirty = true;
    void send({ type: 'TYPE', phraseId, text: elements.input.value });
  });
  elements.phrase.addEventListener('click', focusTyping);
  elements.length.addEventListener('change', () => {
    const length = PHRASE_LENGTHS.find(value => value === elements.length.value);
    if (length) {
      elements.input.focus({ preventScroll: true });
      void send({ type: 'LENGTH', length });
    }
  });
  for (const card of elements.playerCards) {
    card.roleSelect.addEventListener('change', () => {
      const role = ROLES.find(candidate => candidate === card.roleSelect.value);
      if (!role) { errorMessage = 'Unknown Stronghold role.'; display(); return; }
      selected.clear(); elements.input.focus({ preventScroll: true }); void send({ type: 'ROLE', role });
    });
    for (const group of card.groups) {
      for (const button of group.buttons) {
        button.element.addEventListener('click', () => {
          relayPlacement = button.action === 'relay';
          placementCancelled = false; rallyPlacement = false;
          if (relayPlacement) { errorMessage = ''; display(); focusTyping(); }
          else void send({ type: 'ACTION', action: button.action, tier: button.tier, upgrade: button.upgrade });
        });
      }
    }
  }
  elements.map.addEventListener('pointerdown', event => {
    if (!running() || event.button !== 0 || snapshot?.phase !== 'playing') return;
    const point = mapPoint(elements.map, event.clientX, event.clientY);
    if (!point) return;
    const target = event.target instanceof Element ? event.target.closest('[data-unit]') : null;
    const id = Number(target?.getAttribute('data-unit'));
    drag = { start: point, end: point, pointer: event.pointerId, additive: event.shiftKey,
      unitId: armyIds().includes(id) ? id : null, moved: false };
    elements.map.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  elements.map.addEventListener('pointermove', event => {
    cursor = mapPoint(elements.map, event.clientX, event.clientY);
    if (drag && drag.pointer === event.pointerId && cursor) {
      drag.end = cursor;
      drag.moved ||= distance(drag.start, cursor) > 4;
    }
    if (snapshot) {
      elements.mapControls.ghost(snapshot, placing(), cursor);
      const selecting = drag?.moved && self()?.role === 'army' && !placing() && !rallyPlacement;
      elements.mapControls.selection(selecting ? drag?.start ?? null : null, selecting ? drag?.end ?? null : null);
    }
  });
  elements.map.addEventListener('pointerleave', () => {
    if (drag) return;
    cursor = null;
    if (snapshot) elements.mapControls.ghost(snapshot, null, null);
  });
  elements.map.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointer || !snapshot) return;
    const gesture = drag;
    const point = mapPoint(elements.map, event.clientX, event.clientY) ?? gesture.end;
    clearDrag();
    if (placing()) place(point);
    else if (rallyPlacement) { rallyPlacement = false; void send({ type: 'RALLY', point }); }
    else if (self()?.role === 'army') {
      if (gesture.moved) {
        if (!gesture.additive) selected.clear();
        troopsInRectangle(snapshot.units, gesture.start, point).forEach(id => selected.add(id));
        display();
      } else if (gesture.unitId !== null) {
        if (!gesture.additive) selected.clear();
        if (selected.has(gesture.unitId)) selected.delete(gesture.unitId); else selected.add(gesture.unitId);
        display();
      } else move(point);
    }
    focusTyping();
  });
  elements.map.addEventListener('pointercancel', () => { clearDrag(); focusTyping(); });
  requireElement('stronghold-ready', HTMLButtonElement).addEventListener('click', () => {
    const player = self();
    if (player) void send({ type: 'READY', ready: !player.ready });
  });
  for (const id of ['stronghold-pause', 'stronghold-tier-pause']) requireElement(id, HTMLButtonElement).addEventListener('click', togglePause);
  for (const id of ['stronghold-restart', 'stronghold-play-again']) requireElement(id, HTMLButtonElement).addEventListener('click', restart);
  requireElement('stronghold-select-army', HTMLButtonElement).addEventListener('click', () => {
    selected.clear(); armyIds().forEach(id => selected.add(id)); display(); focusTyping();
  });
  requireElement('stronghold-defend', HTMLButtonElement).addEventListener('click', () => move({ x: 500, y: 450 }, true));
  requireElement('stronghold-assault', HTMLButtonElement).addEventListener('click', () => move({ x: 500, y: 80 }, true));
  requireElement('stronghold-rally', HTMLButtonElement).addEventListener('click', () => {
    rallyPlacement = true; relayPlacement = false; placementCancelled = true; display(); focusTyping();
  });
  requireElement('stronghold-cancel-placement', HTMLButtonElement).addEventListener('click', cancelPlacement);
  elements.dialog.addEventListener('cancel', event => { event.preventDefault(); togglePause(); });
  const clicked = (event: MouseEvent): void => {
    if (!(event.target instanceof HTMLSelectElement)) queueMicrotask(focusTyping);
  };
  elements.screen.addEventListener('click', clicked);
  const keyboard = (event: KeyboardEvent): void => {
    if (!running() || !snapshot || event.isComposing) return;
    if (event.key === 'Escape' && snapshot.phase === 'playing') { cancelPlacement(); return; }
    if (event.altKey && placing() && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) {
      event.preventDefault();
      cursor ??= { x: 500, y: 450 };
      if (event.key === 'Enter') place(cursor);
      else {
        cursor = { x: Math.max(20, Math.min(980, cursor.x + (event.key === 'ArrowRight' ? 10 : event.key === 'ArrowLeft' ? -10 : 0))),
          y: Math.max(130, Math.min(630, cursor.y + (event.key === 'ArrowDown' ? 10 : event.key === 'ArrowUp' ? -10 : 0))) };
        display();
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1 || elements.input.disabled
      || document.activeElement === elements.input || document.activeElement instanceof HTMLSelectElement) return;
    event.preventDefault();
    focusTyping();
    elements.input.setRangeText(event.key, elements.input.selectionStart ?? elements.input.value.length,
      elements.input.selectionEnd ?? elements.input.value.length, 'end');
    elements.input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  document.addEventListener('keydown', keyboard);
  const visibility = (): void => { connection.setActive(running()); display(); focusTyping(); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('focus', focusTyping);
  const resize = (): void => { typingDirty = true; display(); };
  window.addEventListener('resize', resize);
  return {
    setActive(active: boolean): void {
      shown = active;
      if (!active) { clearDrag(); cursor = null; }
      connection.setActive(running());
      display(); focusTyping();
    },
    dispose(): void {
      unsubscribe(); clearDrag();
      elements.screen.removeEventListener('click', clicked);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', focusTyping);
      window.removeEventListener('resize', resize);
      if (elements.dialog.open) elements.dialog.close();
      connection.dispose();
    }
  };
}
