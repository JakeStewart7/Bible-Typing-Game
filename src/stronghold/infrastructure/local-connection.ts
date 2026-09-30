import { StrongholdEngine } from '../domain/engine.ts';
import type { StrongholdCommand, StrongholdConnection, StrongholdSnapshot } from '../domain/types.ts';

export class LocalStrongholdConnection implements StrongholdConnection {
  private engine = new StrongholdEngine();
  private listeners = new Set<(snapshot: StrongholdSnapshot) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private previousTime = 0;

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
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (!active) return;
    this.previousTime = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      const seconds = Math.min(.5, (now - this.previousTime) / 1000);
      this.previousTime = now;
      if (seconds > 0) this.engine.advance(seconds);
      this.publish();
    }, 100);
  }
  restart(): void { this.engine.restart(); this.publish(); }
  dispose(): void { this.setActive(false); this.listeners.clear(); }
  private publish(): void {
    for (const listener of this.listeners) listener(this.engine.snapshot('you'));
  }
}
