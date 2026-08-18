const MIN_RATE = .75;
const MAX_RATE = 2.2;
const TARGET_WORD_SECONDS = .55;

export function narrationRate(intervalMs: number, multiplier = 1): number {
  const rate = TARGET_WORD_SECONDS / Math.max(.25, intervalMs / 1000) * multiplier;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}
