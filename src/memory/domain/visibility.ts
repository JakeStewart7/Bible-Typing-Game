export const RECALL_VISIBILITY_PRESETS = [
  { visiblePercent: 100, label: 'Full text' },
  { visiblePercent: 75, label: 'Guided' },
  { visiblePercent: 50, label: 'Balanced' },
  { visiblePercent: 25, label: 'Recall' },
  { visiblePercent: 0, label: 'Blank' }
] as const;

export type RecallVisibilityPercent = (typeof RECALL_VISIBILITY_PRESETS)[number]['visiblePercent'];

export function hiddenPercentForVisibleWords(visiblePercent: RecallVisibilityPercent): number {
  return 100 - visiblePercent;
}

export function hiddenMemoryWordIndices(wordCount: number, hiddenPercent: number): ReadonlySet<number> {
  const normalizedCount = Math.max(0, Math.floor(wordCount));
  const normalizedPercent = Math.max(0, Math.min(100, hiddenPercent));
  const hiddenCount = Math.round(normalizedCount * normalizedPercent / 100);
  const rankedIndices = Array.from({ length: normalizedCount }, (_, index) => index)
    .sort((left, right) => memoryWordRank(left) - memoryWordRank(right));
  return new Set(rankedIndices.slice(0, hiddenCount));
}

export function shouldMaskMemoryCharacter(
  wordIsHidden: boolean,
  typedCharacter: string | undefined,
  expectedCharacter: string
): boolean {
  return wordIsHidden
    && /[\p{L}\p{N}]/u.test(expectedCharacter)
    && typedCharacter !== expectedCharacter;
}

function memoryWordRank(index: number): number {
  return (index * 37 + 17) % 101;
}
