import { createGame, type Game } from '../../game/state.ts';
import { requireElement } from '../../shared/dom.ts';
import { renderTypingExperience, updateTypingInput } from '../../typing/session.ts';
import { ROLES, type Point, type StrongholdCommand, type StrongholdConnection, type StrongholdSnapshot } from '../domain/types.ts';
import { renderStronghold, strongholdElements } from './view.ts';
import { calculateStats } from '../../game/stats.ts';
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
  let typingLayout = '';
  const running = (): boolean => shown && !paused && !document.hidden;
  function display(): void {
    if (!snapshot) return;
    renderStronghold(elements, snapshot, selected, running(), paused);
    const feedback = errorMessage || (paused ? 'Paused' : snapshot.message);
    setText(elements.feedback, feedback);
    elements.feedback.classList.toggle('is-hidden', !feedback);
    if (!elements.typing.classList.contains('is-hidden')) {
      const layout = `${snapshot.phase}/${running()}/${elements.typing.parentElement?.id}`;
      const stats = typingDirty || layout !== typingLayout
        ? renderTypingExperience(typing, {
          text: elements.phrase, typedBar: elements.typedBar, progressFill: elements.progressFill
        }) : calculateStats(typing);
      typingDirty = false;
      typingLayout = layout;
      setText(requireElement('stronghold-typing-stats', HTMLElement), `${stats.wpm} WPM / ${Math.round(stats.accuracy)}% accuracy`);
    }
  }
  async function send(command: StrongholdCommand): Promise<void> {
    if (!running()) { errorMessage = 'Resume Stronghold before issuing orders.'; display(); return; }
    try { errorMessage = ''; await connection.send(command); }
    catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      display();
    }
  }
  const unsubscribe = connection.subscribe(next => {
    snapshot = next;
    const self = next.players.find(player => player.id === next.selfId);
    if (!self) throw new Error('Stronghold snapshot has no local player.');
    if (phraseId !== self.phraseId) {
      phraseId = self.phraseId;
      typing = createGame(self.phrase);
      typingDirty = true;
      elements.input.value = self.typed;
      if (self.typed) updateTypingInput(typing, self.typed);
    }
    for (const id of selected) if (!next.units.some(unit => unit.id === id)) selected.delete(id);
    display();
  });
  function togglePause(): void {
    paused = !paused;
    connection.setActive(running());
    display();
    if (running()) elements.input.focus({ preventScroll: true });
  }
  function restart(): void {
    paused = false;
    selected.clear();
    errorMessage = '';
    phraseId = -1;
    connection.restart();
    connection.setActive(running());
    elements.input.focus({ preventScroll: true });
  }
  function numberPoint(prefix: string): Point {
    return {
      x: requireElement(`stronghold-${prefix}-x`, HTMLInputElement).valueAsNumber,
      y: requireElement(`stronghold-${prefix}-y`, HTMLInputElement).valueAsNumber
    };
  }
  function place(point: Point): void {
    const self = snapshot?.players.find(player => player.id === snapshot?.selfId);
    const kind = self?.action;
    if (kind === 'relay' || kind === 'barracks' || kind === 'tower' || kind === 'wall') send({ type: 'PLACE', kind, point });
  }
  function armyIds(): number[] {
    return snapshot?.units.filter(unit => unit.kind === 'warrior' || unit.kind === 'archer' || unit.kind === 'catapult').map(unit => unit.id) ?? [];
  }
  function move(point: Point, all = false): void {
    const ids = all ? armyIds() : [...selected];
    if (ids.length === 0) { errorMessage = 'Select troops first, or use Select all troops.'; display(); return; }
    send({ type: 'MOVE', ids, point });
  }
  elements.input.addEventListener('input', () => {
    if (!snapshot) return;
    updateTypingInput(typing, elements.input.value);
    typingDirty = true;
    send({ type: 'TYPE', phraseId, text: elements.input.value });
  });
  elements.phrase.addEventListener('click', () => elements.input.focus({ preventScroll: true }));
  for (const card of elements.playerCards) {
    card.roleSelect.addEventListener('change', () => {
      const role = ROLES.find(candidate => candidate === card.roleSelect.value);
      if (!role) { errorMessage = 'Unknown Stronghold role.'; display(); return; }
      selected.clear(); send({ type: 'ROLE', role }); elements.input.focus({ preventScroll: true });
    });
    for (const group of card.groups) {
      for (const button of group.buttons) {
        button.element.addEventListener('click', () => {
          send({ type: 'ACTION', action: button.action, tier: button.tier, upgrade: button.upgrade });
          elements.input.focus({ preventScroll: true });
        });
      }
    }
  }
  elements.map.addEventListener('click', event => {
    if (!snapshot) return;
    const self = snapshot.players.find(player => player.id === snapshot?.selfId);
    const rect = elements.map.getBoundingClientRect();
    const point = elements.map.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = elements.map.getScreenCTM();
    if (!matrix || rect.width === 0) return;
    const location = point.matrixTransform(matrix.inverse());
    if (!elements.placement.classList.contains('is-hidden')) { place({ x: location.x, y: location.y }); return; }
    if (self?.role !== 'army') { errorMessage = 'Switch to Army control to command troops, or finish a construction phrase to build.'; display(); return; }
    const target = event.target instanceof Element ? event.target.closest('[data-unit]') : null;
    const id = Number(target?.getAttribute('data-unit'));
    if (id && armyIds().includes(id)) {
      if (!event.shiftKey) selected.clear();
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      display();
    } else move({ x: location.x, y: location.y });
  });
  requireElement('stronghold-ready', HTMLButtonElement).addEventListener('click', () => {
    const self = snapshot?.players.find(player => player.id === snapshot?.selfId);
    if (self) send({ type: 'READY', ready: !self.ready });
  });
  for (const id of ['stronghold-pause', 'stronghold-tier-pause']) requireElement(id, HTMLButtonElement).addEventListener('click', togglePause);
  for (const id of ['stronghold-restart', 'stronghold-play-again']) requireElement(id, HTMLButtonElement).addEventListener('click', restart);
  requireElement('stronghold-select-army', HTMLButtonElement).addEventListener('click', () => {
    selected.clear(); armyIds().forEach(id => selected.add(id)); display();
  });
  requireElement('stronghold-defend', HTMLButtonElement).addEventListener('click', () => move({ x: 500, y: 450 }, true));
  requireElement('stronghold-assault', HTMLButtonElement).addEventListener('click', () => move({ x: 500, y: 80 }, true));
  requireElement('stronghold-order', HTMLButtonElement).addEventListener('click', () => move(numberPoint('order')));
  requireElement('stronghold-rally', HTMLButtonElement).addEventListener('click', () => send({ type: 'RALLY', point: numberPoint('order') }));
  requireElement('stronghold-build', HTMLButtonElement).addEventListener('click', () => place(numberPoint('build')));
  elements.dialog.addEventListener('cancel', event => { event.preventDefault(); togglePause(); });
  const visibility = (): void => { connection.setActive(running()); display(); };
  document.addEventListener('visibilitychange', visibility);
  const resize = (): void => { typingDirty = true; display(); };
  window.addEventListener('resize', resize);
  return {
    setActive(active: boolean): void {
      shown = active;
      connection.setActive(running());
      display();
      if (running()) elements.input.focus({ preventScroll: true });
    },
    dispose(): void {
      unsubscribe();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', resize);
      if (elements.dialog.open) elements.dialog.close();
      connection.dispose();
    }
  };
}
