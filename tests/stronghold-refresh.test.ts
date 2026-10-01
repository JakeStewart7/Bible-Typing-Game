import { LocalStrongholdConnection, STRONGHOLD_REFRESH_HZ } from '../src/stronghold/infrastructure/local-connection.ts';
import type { FrameClock } from '../src/shared/frame-scheduler.ts';
import { equal, test } from './harness.ts';

class FakeFrameClock implements FrameClock {
  time = 0;
  private nextId = 1;
  readonly callbacks = new Map<number, (time: number) => void>();
  now = (): number => this.time;
  request = (callback: (time: number) => void): number => {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  };
  cancel = (id: number): void => { this.callbacks.delete(id); };
  advance(milliseconds: number): void {
    this.time += milliseconds;
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    pending.forEach(callback => callback(this.time));
  }
}

test('Stronghold refreshes the entire snapshot at 60Hz on 60Hz and high-refresh displays', () => {
  equal(STRONGHOLD_REFRESH_HZ, 60);
  for (const frequency of [60, 120, 144]) {
    const clock = new FakeFrameClock();
    const connection = new LocalStrongholdConnection(clock);
    let frames = 0;
    let elapsed = 0;
    connection.subscribe(snapshot => { frames++; elapsed = snapshot.elapsed; });
    connection.setActive(true);
    for (let index = 0; index < frequency; index++) clock.advance(1000 / frequency);
    equal(frames, 61);
    equal(Math.round(elapsed * 1000), 1000);
    equal(clock.callbacks.size, 1);
    connection.dispose();
  }
});

test('Stronghold cancels paused frames, ignores inactive elapsed time and bounds lag catch-up', () => {
  const clock = new FakeFrameClock();
  const connection = new LocalStrongholdConnection(clock);
  let elapsed = 0;
  connection.subscribe(snapshot => { elapsed = snapshot.elapsed; });
  connection.setActive(true);
  connection.setActive(true);
  equal(clock.callbacks.size, 1);
  clock.advance(100);
  equal(Math.round(elapsed * 1000), 100);
  connection.setActive(false);
  equal(clock.callbacks.size, 0);
  clock.advance(10000);
  connection.setActive(true);
  clock.advance(1000 / 60);
  equal(Math.round(elapsed * 1000), 117);
  clock.advance(10000);
  equal(Math.round(elapsed * 1000), 617);
  connection.restart();
  equal(elapsed, 0);
  connection.dispose();
  equal(clock.callbacks.size, 0);
});

test('Stronghold local connection publishes developer defaults and preserves them on restart', () => {
  const clock = new FakeFrameClock();
  const connection = new LocalStrongholdConnection(clock, { resources: 75, length: 'short', computersPaused: true });
  let resources = 0;
  let length = '';
  let stopped = false;
  connection.subscribe(snapshot => { resources = snapshot.resources; length = snapshot.players[0]?.length ?? ''; stopped = snapshot.computersPaused; });
  equal([resources, length, stopped], [75, 'short', true]);
  connection.restart({ resources: 20, length: 'long', computersPaused: false });
  equal([resources, length, stopped], [20, 'long', false]);
  connection.restart();
  equal([resources, length, stopped], [20, 'long', false]);
  connection.dispose();
});
