export type FrameScheduler = {
  schedule: () => void;
  reschedule: () => void;
  cancel: () => void;
};

export function createFrameScheduler(callback: (time: number) => void): FrameScheduler {
  let frame = 0;

  function cancel(): void {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function schedule(): void {
    if (frame) return;
    frame = requestAnimationFrame(time => {
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
