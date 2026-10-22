import { createGame, type Game } from '../../game/state.ts';
import { requireElement } from '../../shared/dom.ts';
import { renderTypingExperience, updateTypingInput } from '../../typing/session.ts';
import { PHRASE_LENGTHS, ROLES, SEASONS, STARTING_ENTITIES, type Point, type StrongholdCommand, type StrongholdConnection, type StrongholdSnapshot } from '../domain/types.ts';
import { distance, WALL_ROTATION_STEP } from '../domain/rules.ts';
import { renderStronghold, strongholdElements } from './view.ts';
import { mapPoint, readyBuilding, troopsInRectangle, type PlacementKind } from './map-controls.ts';
import { setText } from './dom-updates.ts';
import { validateDeveloperOptions, type DeveloperOptions } from '../infrastructure/developer-options.ts';
import { wheelZoom } from './map-camera.ts';
import { actionShortcutKey, arrowPan, nextTaskIndex, typingLengthKey } from './keyboard.ts';
import { createSeasonalMusic } from '../audio/music.ts';
import { isPlayerColor } from '../domain/options.ts';
import { createPlayerCursor } from './player-cursor.ts';

export function createStrongholdController(connection: StrongholdConnection, developer: {
  defaults: DeveloperOptions; save(options: DeveloperOptions): void;
}) {
  const elements = strongholdElements();
  const playerCursor = createPlayerCursor();
  const credits = requireElement('stronghold-credits', HTMLDialogElement);
  const musicButton = requireElement('stronghold-music', HTMLButtonElement);
  const musicVolume = requireElement('stronghold-volume', HTMLInputElement);
  const musicStatus = requireElement('stronghold-music-status', HTMLElement);
  const currentTrack = requireElement('stronghold-current-track', HTMLElement);
  const music = createSeasonalMusic(new Audio(), status => {
    setText(musicButton, status.enabled ? 'Music on' : 'Music off');
    musicButton.setAttribute('aria-pressed', String(status.enabled));
    musicButton.title = status.track ? `${status.track.title} - Kevin MacLeod` : 'Seasonal soundtrack';
    setText(currentTrack, status.track?.title ?? '');
    setText(musicStatus, status.message);
    musicStatus.classList.toggle('is-hidden', !status.message);
  });
  let defaults = { ...developer.defaults };
  const developerPanel = requireElement('stronghold-dev-options', HTMLDetailsElement);
  const developerForm = requireElement('stronghold-dev-form', HTMLFormElement);
  const startingComputers = requireElement('stronghold-dev-computers', HTMLSelectElement);
  const startingLength = requireElement('stronghold-dev-length', HTMLSelectElement);
  const startingColor = requireElement('stronghold-dev-color', HTMLSelectElement);
  const startingResources = requireElement('stronghold-dev-resources', HTMLInputElement);
  const startingTier = requireElement('stronghold-dev-tier', HTMLSelectElement);
  const startingSeason = requireElement('stronghold-dev-starting-season', HTMLSelectElement);
  const startingPeriod = requireElement('stronghold-dev-period', HTMLSelectElement);
  const startingCounts = {
    worker: requireElement('stronghold-dev-worker', HTMLInputElement), builder: requireElement('stronghold-dev-builder', HTMLInputElement),
    warrior: requireElement('stronghold-dev-warrior', HTMLInputElement), tower: requireElement('stronghold-dev-tower', HTMLInputElement),
    archer: requireElement('stronghold-dev-archer', HTMLInputElement), catapult: requireElement('stronghold-dev-catapult', HTMLInputElement)
  };
  for (const kind of STARTING_ENTITIES) startingCounts[kind].value = String(defaults.startingCounts[kind]);
  startingComputers.value = defaults.computersPaused ? 'stopped' : 'started';
  startingLength.value = defaults.length;
  startingColor.value = defaults.playerColor;
  startingResources.value = String(defaults.resources);
  startingTier.value = String(defaults.tier);
  startingSeason.value = defaults.season;
  startingPeriod.value = defaults.period;
  elements.camera.reset();
  const selected = new Set<number>();
  const selectedBuildings = new Set<number>();
  let snapshot: StrongholdSnapshot | null = null;
  let typing: Game = createGame('');
  let phraseId = -1;
  let shown = false;
  let paused = false;
  let errorMessage = '';
  let typingDirty = true;
  let typingLayout = '';
  let relayPlacement = false;
  let placementCancelled = false;
  let rallyPlacement = false;
  let cursor: Point | null = null;
  let wallRotation = 0;
  let editingWall: number | null = null;
  let hoveredRelay: number | null = null;
  const placementLabel = requireElement('stronghold-placement-label', HTMLElement);
  const cancelPlacementButton = requireElement('stronghold-cancel-placement', HTMLButtonElement);
  let mouse: Point | null = null;
  let panFrame: number | null = null;
  let panTime = 0;
  const panKeys = new Set<string>();
  let drag: { start: Point; end: Point; pointer: number; additive: boolean; unitId: number | null; buildingId: number | null; moved: boolean } | null = null;
  let pan: { pointer: number; start: Point; client: Point; center: Point; matrix: DOMMatrix; moved: boolean } | null = null;
  const running = (): boolean => shown && !paused && !credits.open && !document.hidden;
  const self = () => snapshot?.players.find(player => player.id === snapshot?.selfId);
  const placing = (): PlacementKind | null => snapshot && running() && snapshot.phase === 'playing' && !placementCancelled
    ? relayPlacement ? 'relay' : readyBuilding(snapshot) : null;
  const selectedWall = () => snapshot?.phase === 'playing'
    ? snapshot.buildings.find(building => building.id === editingWall && building.kind === 'wall' && !building.enemy && building.hp > 0) : undefined;
  function renderMapPreview(): void {
    if (!snapshot) return;
    const kind = placing();
    const problem = elements.mapControls.ghost(snapshot, kind, cursor, wallRotation);
    elements.mapControls.buildingSelection(snapshot, selectedBuildings);
    if (kind) setText(placementLabel, problem ?? (kind === 'wall' ? `Wall: ${wallRotation} deg. Scroll to rotate; click to place.` : 'Click the map to place.'));
    elements.placement.classList.toggle('is-invalid', Boolean(problem));
    elements.mapControls.wallSelection(running() ? selectedWall() ?? null : null);
    if (!running() || snapshot.phase !== 'playing' || self()?.role !== 'army') elements.mapControls.moveIndicator(null);
    const relay = snapshot.buildings.find(building => building.id === hoveredRelay
      && (building.kind === 'relay' || building.kind === 'castle') && !building.enemy && building.hp > 0);
    elements.mapControls.relayPreview(snapshot, running() ? kind === 'relay' ? cursor : relay ?? null : null, kind === 'relay' ? undefined : relay?.id);
  }
  function focusTyping(): void {
    if (document.activeElement === musicVolume) return;
    if (developerPanel.open && document.activeElement instanceof Element && developerPanel.contains(document.activeElement)) return;
    if (running() && !elements.input.disabled && !(document.activeElement instanceof HTMLSelectElement)) {
      elements.input.focus({ preventScroll: true });
    }
  }
  function clearDrag(): void {
    panKeys.clear();
    mouse = null;
    hoveredRelay = null;
    if (panFrame !== null) cancelAnimationFrame(panFrame);
    panFrame = null;
    if (pan && elements.map.hasPointerCapture(pan.pointer)) elements.map.releasePointerCapture(pan.pointer);
    pan = null;
    if (drag && elements.map.hasPointerCapture(drag.pointer)) elements.map.releasePointerCapture(drag.pointer);
    drag = null;
    elements.mapControls.selection(null, null);
  }
  function display(): void {
    if (!snapshot) return;
    renderStronghold(elements, snapshot, selected, running(), paused, relayPlacement, placementCancelled, rallyPlacement, shown);
    const player = self();
    if (player) playerCursor.update(player.color, running() && snapshot.phase === 'playing' && Boolean(placing() || rallyPlacement), shown);
    music.update(snapshot.season, snapshot.environmentElapsed, running() && snapshot.phase !== 'won' && snapshot.phase !== 'lost');
    const wall = selectedWall();
    if (!wall) editingWall = null;
    setText(placementLabel, wall ? `Wall: ${wall.rotation ?? 0} deg. Scroll to rotate.`
      : placing() === 'wall' ? `Wall: ${wallRotation} deg. Scroll to rotate; click to place.` : 'Click the map to place.');
    setText(cancelPlacementButton, wall ? 'Done' : 'Cancel');
    if (wall && running()) elements.placement.classList.remove('is-hidden');
    renderMapPreview();
    if (selectedBuildings.size) setText(requireElement('stronghold-selection', HTMLElement), `${selected.size} units / ${selectedBuildings.size} buildings selected`);
    const selecting = drag?.moved && self()?.role === 'army' && !placing() && !rallyPlacement;
    elements.mapControls.selection(selecting ? drag?.start ?? null : null, selecting ? drag?.end ?? null : null);
    const feedback = errorMessage || (paused ? 'Paused' : rallyPlacement ? 'Click the map to set the rally point. Escape cancels.' : snapshot.message);
    setText(elements.feedback, feedback);
    elements.feedback.classList.toggle('is-hidden', !feedback || Boolean(placing() && !errorMessage));
    if (errorMessage && !wall) elements.placement.classList.add('is-hidden');
    const layout = `${snapshot.phase}/${running()}/${elements.privateTyping.parentElement?.id}`;
    if (typingDirty || layout !== typingLayout) {
      renderTypingExperience(typing, { text: elements.phrase, typedBar: elements.typedBar, progressFill: elements.progressFill },
        'teleport');
      typingDirty = false;
      typingLayout = layout;
      elements.typedBar.scrollLeft = elements.input.scrollLeft;
    }
  }
  async function send(command: StrongholdCommand): Promise<boolean> {
    if (!running()) { errorMessage = 'Resume Stronghold before issuing orders.'; display(); return false; }
    try { errorMessage = ''; await connection.send(command); return true; }
    catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      display();
      return false;
    } finally { focusTyping(); }
  }
  function saveDefaults(options: DeveloperOptions): boolean {
    try {
      validateDeveloperOptions(options);
      developer.save(options);
      defaults = { ...options };
      startingSeason.value = defaults.season;
      startingPeriod.value = defaults.period;
      errorMessage = '';
      display();
      return true;
    } catch (error) {
      errorMessage = `Could not save dev options: ${error instanceof Error ? error.message : String(error)}`;
      display();
      return false;
    }
  }
  function saveDefaultForm(): boolean {
    if (!developerForm.reportValidity()) return false;
    const length = PHRASE_LENGTHS.find(length => length === startingLength.value);
    const playerColor = startingColor.value;
    const season = startingSeason.value === 'random' ? 'random' : SEASONS.find(season => season === startingSeason.value);
    const period = startingPeriod.value;
    if (!length || !isPlayerColor(playerColor) || !season || (period !== 'day' && period !== 'night')
      || !['started', 'stopped'].includes(startingComputers.value)) {
      errorMessage = 'Choose valid developer defaults.'; display(); return false;
    }
    return saveDefaults({
      resources: startingResources.valueAsNumber, length, computersPaused: startingComputers.value === 'stopped',
      tier: Number(startingTier.value), playerColor, season, period,
      startingCounts: {
        worker: startingCounts.worker.valueAsNumber, builder: startingCounts.builder.valueAsNumber,
        warrior: startingCounts.warrior.valueAsNumber, tower: startingCounts.tower.valueAsNumber,
        archer: startingCounts.archer.valueAsNumber, catapult: startingCounts.catapult.valueAsNumber
      }
    });
  }
  const unsubscribe = connection.subscribe(next => {
    const previousRole = self()?.role;
    snapshot = next;
    const player = self();
    if (!player) throw new Error('Stronghold snapshot has no local player.');
    if (previousRole !== player.role) {
      selectedBuildings.clear();
      relayPlacement = false; placementCancelled = false; rallyPlacement = false; clearDrag();
      editingWall = null;
    }
    const changedPhrase = phraseId !== player.phraseId;
    if (changedPhrase) {
      phraseId = player.phraseId;
      typing = createGame(player.phrase);
      typingDirty = true;
      elements.input.value = player.typed;
      if (player.typed) updateTypingInput(typing, player.typed);
    } else if (elements.input.value !== player.typed) {
      elements.input.value = player.typed;
      updateTypingInput(typing, player.typed);
      typingDirty = true;
    }
    for (const id of selected) if (!next.units.some(unit => unit.id === id)) selected.delete(id);
    for (const id of selectedBuildings) if (!next.buildings.some(building => building.id === id && building.hp > 0 && !building.enemy)) selectedBuildings.delete(id);
    display();
    if (changedPhrase) focusTyping();
  });
  function cancelPlacement(): void {
    relayPlacement = false; placementCancelled = true; rallyPlacement = false; editingWall = null;
    selectedBuildings.clear();
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
    selectedBuildings.clear();
    relayPlacement = false; placementCancelled = false; rallyPlacement = false; editingWall = null;
    errorMessage = ''; phraseId = -1;
    cursor = null; wallRotation = 0; panTime = 0;
    typing = createGame(''); typingDirty = true; typingLayout = '';
    elements.input.value = '';
    elements.typedBar.scrollLeft = 0;
    clearDrag();
    if (credits.open) credits.close();
    if (elements.dialog.open) elements.dialog.close();
    developerPanel.open = false;
    const guide = elements.screen.querySelector('details.stronghold-guide');
    if (guide instanceof HTMLDetailsElement) guide.open = false;
    elements.renderBattlefield.reset();
    elements.renderEventLog.reset();
    for (const particle of elements.screen.querySelectorAll('.stronghold-weather-particle')) {
      for (const animation of particle.getAnimations()) animation.currentTime = 0;
    }
    elements.mapControls.moveIndicator(null);
    elements.camera.reset();
    connection.restart(defaults);
    connection.setActive(running());
    focusTyping();
  }
  function place(point: Point): void {
    const kind = placing();
    if (kind) void send({ type: 'PLACE', kind, point, rotation: kind === 'wall' ? wallRotation : undefined });
  }
  function armyIds(): number[] {
    return snapshot?.units.filter(unit => ['warrior', 'archer', 'catapult'].includes(unit.kind)).map(unit => unit.id) ?? [];
  }
  function move(point: Point, all = false): void {
    const ids = all ? armyIds() : [...selected];
    if (ids.length === 0) { errorMessage = 'Select friendly units first, or use Select all troops.'; display(); focusTyping(); return; }
    void send({ type: 'MOVE', ids, point }).then(sent => {
      if (sent && running() && snapshot?.phase === 'playing' && self()?.role === 'army') elements.mapControls.moveIndicator(point);
    });
  }
  elements.input.addEventListener('input', () => {
    if (!snapshot) return;
    updateTypingInput(typing, elements.input.value);
    typingDirty = true;
    void send({ type: 'TYPE', phraseId, text: elements.input.value });
  });
  elements.input.addEventListener('scroll', () => { elements.typedBar.scrollLeft = elements.input.scrollLeft; });
  elements.phrase.addEventListener('click', focusTyping);
  for (const option of elements.lengthOptions) option.element.addEventListener('click', () => {
    if (self()?.length !== option.length) void send({ type: 'LENGTH', length: option.length });
    else focusTyping();
  });
  function panWithKeys(time: number): void {
    panFrame = null;
    if (pan || !running() || snapshot?.phase !== 'playing') return;
    const direction = arrowPan(panKeys);
    if (!direction.x && !direction.y) return;
    const seconds = Math.min(.05, Math.max(0, (time - panTime) / 1000));
    panTime = time;
    const center = elements.camera.center;
    const speed = 220 / elements.camera.zoom;
    elements.camera.panTo({ x: center.x + direction.x * speed * seconds, y: center.y + direction.y * speed * seconds });
    if (mouse) cursor = mapPoint(elements.map, mouse.x, mouse.y);
    hoveredRelay = null;
    renderMapPreview();
    panFrame = requestAnimationFrame(panWithKeys);
  }
  elements.map.addEventListener('wheel', event => {
    if (!running() || snapshot?.phase !== 'playing') return;
    if (placing() === 'wall' || selectedWall()) {
      event.preventDefault();
      if (event.deltaY !== 0) rotateCurrentWall(event.deltaY > 0 ? 1 : -1);
      return;
    }
    if (event.ctrlKey) return;
    event.preventDefault();
    const before = mapPoint(elements.map, event.clientX, event.clientY);
    clearDrag();
    elements.camera.setZoom(wheelZoom(elements.camera.zoom, event.deltaY, event.deltaMode));
    const after = mapPoint(elements.map, event.clientX, event.clientY);
    if (before && after) {
      const center = elements.camera.center;
      elements.camera.panTo({ x: center.x + before.x - after.x, y: center.y + before.y - after.y });
    }
    cursor = mapPoint(elements.map, event.clientX, event.clientY);
    display();
  }, { passive: false });
  function rotateCurrentWall(direction: 1 | -1): void {
    const wall = selectedWall();
    if (wall) void send({ type: 'ROTATE_WALL', id: wall.id, direction });
    else if (placing() === 'wall') { wallRotation = (wallRotation + direction * WALL_ROTATION_STEP + 360) % 360; display(); focusTyping(); }
  }
  for (const card of elements.playerCards) {
    for (const button of card.roleButtons) button.element.addEventListener('click', () => {
      selected.clear(); selectedBuildings.clear(); void send({ type: 'ROLE', role: button.role });
    });
    for (const group of card.groups) {
      for (const button of group.buttons) {
        button.element.addEventListener('click', () => {
          editingWall = null;
          selectedBuildings.clear();
          relayPlacement = button.action === 'relay';
          placementCancelled = false; rallyPlacement = false;
          if (relayPlacement) { errorMessage = ''; display(); focusTyping(); }
          else void send({ type: 'ACTION', action: button.action, tier: button.tier, upgrade: button.upgrade });
        });
      }
    }
  }
  elements.map.addEventListener('pointerdown', event => {
    if (!running() || snapshot?.phase !== 'playing') return;
    if (event.button === 2) {
      event.preventDefault(); clearDrag();
      const point = mapPoint(elements.map, event.clientX, event.clientY);
      if (point && selectedBuildings.size && !placing() && !rallyPlacement) {
        const moveSelected = self()?.role === 'army' && selected.size > 0;
        void send({ type: 'RALLY', ids: [...selectedBuildings], point }).then(sent => { if (sent && moveSelected) move(point); });
      } else if (placing() || rallyPlacement || editingWall !== null) cancelPlacement();
      else if (point && self()?.role === 'army') move(point);
      focusTyping();
      return;
    }
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      clearDrag();
      const matrix = elements.map.getScreenCTM();
      const point = mapPoint(elements.map, event.clientX, event.clientY);
      if (!matrix || !point) return;
      pan = { pointer: event.pointerId, start: point, client: { x: event.clientX, y: event.clientY },
        center: elements.camera.center, matrix: matrix.inverse(), moved: false };
      elements.map.setPointerCapture(event.pointerId); event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    const building = event.target instanceof Element ? event.target.closest('[data-building]') : null;
    editingWall = null;
    const point = mapPoint(elements.map, event.clientX, event.clientY);
    if (!point) return;
    const target = event.target instanceof Element ? event.target.closest('[data-unit]') : null;
    const id = Number(target?.getAttribute('data-unit'));
    const buildingId = Number(building?.getAttribute('data-building'));
    drag = { start: point, end: point, pointer: event.pointerId, additive: event.shiftKey,
      unitId: snapshot.units.some(unit => unit.id === id && unit.kind !== 'invader' && unit.hp > 0) ? id : null,
      buildingId: snapshot.buildings.some(candidate => candidate.id === buildingId && !candidate.enemy && candidate.hp > 0) ? buildingId : null, moved: false };
    elements.map.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  elements.map.addEventListener('pointermove', event => {
    if (pan && pan.pointer === event.pointerId) {
      pan.moved ||= distance(pan.client, { x: event.clientX, y: event.clientY }) > 4;
      if (!pan.moved) return;
      const point = elements.map.createSVGPoint();
      point.x = event.clientX; point.y = event.clientY;
      const location = point.matrixTransform(pan.matrix);
      elements.camera.panTo({ x: pan.center.x + pan.start.x - location.x, y: pan.center.y + pan.start.y - location.y });
      hoveredRelay = null; renderMapPreview();
      return;
    }
    mouse = { x: event.clientX, y: event.clientY };
    const building = event.target instanceof Element ? event.target.closest('[data-building]') : null;
    hoveredRelay = building ? Number(building.getAttribute('data-building')) : null;
    cursor = mapPoint(elements.map, event.clientX, event.clientY);
    if (drag && drag.pointer === event.pointerId && cursor) {
      drag.end = cursor;
      drag.moved ||= distance(drag.start, cursor) > 4;
    }
    if (snapshot) {
      renderMapPreview();
      const selecting = drag?.moved && self()?.role === 'army' && !placing() && !rallyPlacement;
      elements.mapControls.selection(selecting ? drag?.start ?? null : null, selecting ? drag?.end ?? null : null);
    }
  });
  elements.map.addEventListener('pointerleave', () => {
    mouse = null;
    hoveredRelay = null;
    if (drag || pan) return;
    cursor = null;
    if (snapshot) { elements.mapControls.ghost(snapshot, null, null); elements.mapControls.relayPreview(snapshot, null); }
  });
  elements.map.addEventListener('pointerup', event => {
    if (pan?.pointer === event.pointerId) {
      clearDrag();
      cursor = null; display(); focusTyping(); return;
    }
    if (!drag || event.pointerId !== drag.pointer || !snapshot) return;
    const gesture = drag;
    const point = mapPoint(elements.map, event.clientX, event.clientY) ?? gesture.end;
    clearDrag();
    if (placing()) place(point);
    else if (rallyPlacement) { rallyPlacement = false; void send({ type: 'RALLY', point }); }
    else if (!gesture.moved && gesture.buildingId !== null) {
      if (!gesture.additive) { selected.clear(); selectedBuildings.clear(); }
      if (selectedBuildings.has(gesture.buildingId)) selectedBuildings.delete(gesture.buildingId); else selectedBuildings.add(gesture.buildingId);
      editingWall = selectedBuildings.size === 1 && snapshot.buildings.some(building => building.id === gesture.buildingId && building.kind === 'wall')
        ? gesture.buildingId : null;
      errorMessage = ''; display();
    }
    else if (self()?.role === 'army') {
      if (gesture.moved) {
        if (!gesture.additive) { selected.clear(); selectedBuildings.clear(); }
        troopsInRectangle(snapshot.units, gesture.start, point).forEach(id => selected.add(id));
        snapshot.buildings.filter(building => !building.enemy && building.hp > 0
          && building.x >= Math.min(gesture.start.x, point.x) && building.x <= Math.max(gesture.start.x, point.x)
          && building.y >= Math.min(gesture.start.y, point.y) && building.y <= Math.max(gesture.start.y, point.y))
          .forEach(building => selectedBuildings.add(building.id));
        display();
      } else if (gesture.unitId !== null) {
        if (!gesture.additive) { selected.clear(); selectedBuildings.clear(); }
        if (selected.has(gesture.unitId)) selected.delete(gesture.unitId); else selected.add(gesture.unitId);
        display();
      } else {
        selected.clear();
        selectedBuildings.clear();
        display();
      }
    } else {
      selectedBuildings.clear(); display();
    }
    focusTyping();
  });
  elements.map.addEventListener('pointercancel', () => { clearDrag(); focusTyping(); });
  elements.screen.addEventListener('contextmenu', event => { event.preventDefault(); });
  requireElement('stronghold-ready', HTMLButtonElement).addEventListener('click', () => {
    const player = self();
    if (player) void send({ type: 'READY', ready: !player.ready });
  });
  for (const button of elements.computerButtons) button.addEventListener('click', () => {
    if (snapshot) void send({ type: 'COMPUTERS', paused: !snapshot.computersPaused });
  });
  elements.nextWave.addEventListener('click', () => { void send({ type: 'NEXT_WAVE' }); });
  for (const [button, period] of [[elements.nextNight, 'night'], [elements.nextDay, 'day']] as const) {
    button.addEventListener('click', async () => {
      if (await send({ type: 'TIME_OF_DAY', period })) saveDefaults({ ...defaults, period });
    });
  }
  elements.devSeason.addEventListener('change', async () => {
    const season = SEASONS.find(season => season === elements.devSeason.value);
    if (!season) { errorMessage = 'Choose a valid season.'; display(); return; }
    if (await send({ type: 'SET_SEASON', season })) saveDefaults({ ...defaults, season });
  });
  for (const id of ['stronghold-pause', 'stronghold-tier-pause']) requireElement(id, HTMLButtonElement).addEventListener('click', togglePause);
  for (const id of ['stronghold-restart', 'stronghold-play-again']) requireElement(id, HTMLButtonElement).addEventListener('click', restart);
  musicButton.addEventListener('click', () => music.toggle());
  musicVolume.addEventListener('input', () => music.setVolume(musicVolume.valueAsNumber));
  requireElement('stronghold-open-credits', HTMLButtonElement).addEventListener('click', () => {
    credits.showModal(); clearDrag(); connection.setActive(running()); display();
  });
  requireElement('stronghold-close-credits', HTMLButtonElement).addEventListener('click', () => credits.close());
  const creditsClosed = (): void => { connection.setActive(running()); display(); focusTyping(); };
  credits.addEventListener('close', creditsClosed);
  for (const field of [startingComputers, startingLength, startingColor, startingResources, startingTier, startingSeason, startingPeriod, ...Object.values(startingCounts)]) {
    field.addEventListener('change', saveDefaultForm);
  }
  developerForm.addEventListener('submit', event => {
    event.preventDefault();
    if (saveDefaultForm()) {
      developerPanel.open = false;
      restart();
    }
  });
  requireElement('stronghold-select-army', HTMLButtonElement).addEventListener('click', () => {
    selected.clear(); selectedBuildings.clear(); armyIds().forEach(id => selected.add(id)); display(); focusTyping();
  });
  requireElement('stronghold-defend', HTMLButtonElement).addEventListener('click', () => move({ x: 500, y: 450 }, true));
  requireElement('stronghold-assault', HTMLButtonElement).addEventListener('click', () => move({ x: 500, y: 80 }, true));
  requireElement('stronghold-rally', HTMLButtonElement).addEventListener('click', () => {
    rallyPlacement = true; relayPlacement = false; placementCancelled = true; display(); focusTyping();
  });
  cancelPlacementButton.addEventListener('click', cancelPlacement);
  elements.dialog.addEventListener('cancel', event => { event.preventDefault(); togglePause(); });
  const clicked = (event: MouseEvent): void => {
    if (event.target instanceof Node && !developerPanel.contains(event.target)) developerPanel.open = false;
    if (!(event.target instanceof HTMLSelectElement) && event.target !== musicVolume) queueMicrotask(focusTyping);
  };
  elements.screen.addEventListener('click', clicked);
  const keyboard = (event: KeyboardEvent): void => {
    if (!running() || !snapshot || event.isComposing) return;
    if (document.activeElement === musicVolume) return;
    if (developerPanel.open && document.activeElement instanceof Element && developerPanel.contains(document.activeElement)) {
      if (event.key === 'Escape') { event.preventDefault(); developerPanel.open = false; focusTyping(); }
      return;
    }
    if (event.key === 'Escape' && snapshot.phase === 'playing') { cancelPlacement(); return; }
    if (event.key === 'Tab' && event.ctrlKey && !event.altKey && !event.metaKey && snapshot.phase === 'playing') {
      event.preventDefault();
      const player = self();
      if (player && !event.repeat) {
        const role = ROLES[(ROLES.indexOf(player.role) + (event.shiftKey ? -1 : 1) + ROLES.length) % ROLES.length];
        if (role) { selected.clear(); selectedBuildings.clear(); void send({ type: 'ROLE', role }); }
      }
      return;
    }
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
    const shortcut = actionShortcutKey(event);
    const player = self();
    if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey && player && snapshot.phase === 'playing') {
      const own = elements.playerCards.find(card => card.id === player.id);
      const active = document.activeElement;
      const inTasks = active instanceof Element && Boolean(own?.actions.contains(active));
      if (active === elements.input || active === elements.map || elements.length.contains(active) || inTasks) {
        const tier = snapshot.tier;
        const tasks = own?.groups.find(group => group.role === player.role)?.buttons
          .filter(button => (button.miniBar || button.action === 'relay') && tier >= button.minimumTier && !button.element.disabled) ?? [];
        const current = tasks.findIndex(button => relayPlacement ? button.action === 'relay'
          : button.action === player.action && (!button.tier || button.tier === player.constructionTier));
        const next = nextTaskIndex(current, tasks.length, event.shiftKey);
        if (next !== null) {
          event.preventDefault();
          if (!event.repeat) tasks[next]?.element.click();
          focusTyping();
          return;
        }
      }
    }
    if (shortcut && player && snapshot.phase === 'playing') {
      const own = elements.playerCards.find(card => card.id === player.id);
      const button = own?.groups.find(group => group.role === player.role)?.buttons.find(button => button.element.dataset.shortcut === shortcut)?.element
        ?? (player.role === 'army' ? elements.orders.querySelector<HTMLButtonElement>(`[data-shortcut="${shortcut}"]`) : null);
      if (button) {
        event.preventDefault();
        if (!event.repeat) button.click();
        focusTyping();
        return;
      }
    }
    if (player && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
      && !elements.input.disabled && !(document.activeElement instanceof HTMLSelectElement)) {
      if (snapshot.phase === 'playing' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        panKeys.add(event.key);
        if (panFrame === null) { panTime = performance.now(); panFrame = requestAnimationFrame(panWithKeys); }
        return;
      }
      const length = typingLengthKey(player.length, event.key);
      if (length) {
        event.preventDefault();
        if (length !== player.length) void send({ type: 'LENGTH', length });
        else focusTyping();
        return;
      }
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
  const keyup = (event: KeyboardEvent): void => { panKeys.delete(event.key); };
  document.addEventListener('keyup', keyup);
  const visibility = (): void => { if (document.hidden) clearDrag(); connection.setActive(running()); display(); focusTyping(); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', clearDrag);
  window.addEventListener('focus', focusTyping);
  const resize = (): void => { elements.camera.refresh(); typingDirty = true; display(); };
  window.addEventListener('resize', resize);
  return {
    setActive(active: boolean): void {
      shown = active;
      if (active) elements.camera.refresh();
      if (!active) { clearDrag(); cursor = null; }
      connection.setActive(running());
      display(); focusTyping();
    },
    dispose(): void {
      unsubscribe(); clearDrag(); music.dispose(); playerCursor.dispose();
      elements.screen.removeEventListener('click', clicked);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('keyup', keyup);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', focusTyping);
      window.removeEventListener('blur', clearDrag);
      window.removeEventListener('resize', resize);
      credits.removeEventListener('close', creditsClosed);
      if (elements.dialog.open) elements.dialog.close();
      if (credits.open) credits.close();
      connection.dispose();
    }
  };
}
