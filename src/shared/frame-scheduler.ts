export type FrameScheduler = {
  schedule: () => void;
  reschedule: () => void;
  cancel: () => void;
};

export type FrameClock = {
  now: () => number;
  request: (callback: (time: number) => void) => number;
  cancel: (frame: number) => void;
};

export const browserFrameClock: FrameClock = {
  now: () => performance.now(),
  request: callback => requestAnimationFrame(callback),
  cancel: frame => cancelAnimationFrame(frame)
};

export function createFrameScheduler(callback: (time: number) => void, clock = browserFrameClock): FrameScheduler {
  let frame = 0;

  function cancel(): void {
    clock.cancel(frame);
    frame = 0;
  }

  function schedule(): void {
    if (frame) return;
    frame = clock.request(time => {
      frame = 0;
      callback(time);
    });
  }

  function reschedule(): void {
    cancel();
    schedule();
  }

  return { schedule, reschedule, cancel };
}
