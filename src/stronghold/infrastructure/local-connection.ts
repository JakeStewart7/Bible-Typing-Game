import { StrongholdEngine } from '../domain/engine.ts';
import type { StrongholdCommand, StrongholdConnection, StrongholdSnapshot } from '../domain/types.ts';
import { browserFrameClock, createFrameScheduler, type FrameClock, type FrameScheduler } from '../../shared/frame-scheduler.ts';

export const STRONGHOLD_REFRESH_HZ = 60;
const STEP_SECONDS = 1 / STRONGHOLD_REFRESH_HZ;
export class LocalStrongholdConnection implements StrongholdConnection {
  private engine = new StrongholdEngine();
  private listeners = new Set<(snapshot: StrongholdSnapshot) => void>();
  private readonly frames: FrameScheduler;
  private readonly clock: FrameClock;
  private active = false;
  private previousTime = 0;
  private accumulated = 0;

  constructor(clock: FrameClock = browserFrameClock) {
    this.clock = clock;
    this.frames = createFrameScheduler(time => this.advanceFrame(time), clock);
  }

  subscribe(listener: (snapshot: StrongholdSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.engine.snapshot('you'));
    return () => { this.listeners.delete(listener); };
  }
  async send(command: StrongholdCommand): Promise<void> {
    this.engine.send('you', command);
    this.publish();
  }
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.frames.cancel();
    this.accumulated = 0;
    this.previousTime = this.clock.now();
    if (active) this.frames.schedule();
  }
  restart(): void {
    this.engine.restart();
    this.accumulated = 0;
    this.previousTime = this.clock.now();
    this.publish();
  }
  dispose(): void { this.setActive(false); this.listeners.clear(); }
  private publish(): void {
    const snapshot = this.engine.snapshot('you');
    for (const listener of this.listeners) listener(structuredClone(snapshot));
  }
  private advanceFrame(time: number): void {
    if (!this.active) return;
    this.accumulated += Math.min(.5, Math.max(0, (time - this.previousTime) / 1000));
    this.previousTime = time;
    const steps = Math.floor((this.accumulated + 1e-9) / STEP_SECONDS);
    for (let step = 0; step < steps; step++) this.engine.advance(STEP_SECONDS);
    this.accumulated = Math.max(0, this.accumulated - steps * STEP_SECONDS);
    if (steps > 0) this.publish();
    if (this.active) this.frames.schedule();
  }
}
