import { recordEvent } from './events.ts';
import { EVENT_LABELS } from './rules.ts';
import type { StrongholdState, WorldEvent } from './types.ts';

const EVENTS: readonly Exclude<WorldEvent, 'peace'>[] = ['left-hand', 'vowels', 'numbers', 'symbols', 'code'];
export const FIRST_EVENT_AT = 60;
export const EVENT_INTERVAL = 120;
export const EVENT_DURATION = 35;

export function updateWorldEvent(state: StrongholdState): boolean {
  const previous = state.event;
  const elapsed = Math.round(state.elapsed * 1e9) / 1e9;
  if (elapsed < FIRST_EVENT_AT) {
    state.event = 'peace';
    state.eventIn = FIRST_EVENT_AT - elapsed;
  } else {
    const cycle = Math.floor((elapsed - FIRST_EVENT_AT) / EVENT_INTERVAL);
    const offset = elapsed - FIRST_EVENT_AT - cycle * EVENT_INTERVAL;
    const event = EVENTS[cycle % EVENTS.length];
    if (!event) throw new Error('Invalid world event cycle.');
    state.event = offset < EVENT_DURATION ? event : 'peace';
    state.eventIn = (state.event === 'peace' ? EVENT_INTERVAL : EVENT_DURATION) - offset;
  }
  if (state.event === previous) return false;
  recordEvent(state, state.event === 'peace' ? 'World event ended' : EVENT_LABELS[state.event]);
  state.message = state.event === 'peace' ? '' : 'World event started. Finish your current text; new entries use the event drill.';
  return true;
}
