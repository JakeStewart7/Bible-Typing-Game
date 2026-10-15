export function workProgress(work: number, required: number) {
  const percent = Math.min(100, Math.max(0, work / required * 100));
  return {
    percent,
    label: percent === 100 ? 'Ready' : `${Math.round(percent)}%`,
    description: `${Math.round(percent)}% complete`
  };
}
