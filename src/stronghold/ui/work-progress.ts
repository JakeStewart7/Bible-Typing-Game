const SHADES = ['#ffccd2', '#ffa3b0', '#ed788c'] as const;

function shade(layer: number): string {
  const index = layer % SHADES.length;
  return index === 0 ? SHADES[0] : index === 1 ? SHADES[1] : SHADES[2];
}

export function bankedWork(work: number, required: number) {
  const ready = Math.floor(work / required);
  const remainder = work % required;
  return {
    ready,
    percent: remainder / required * 100,
    base: ready ? shade(ready - 1) : '#fff',
    fill: shade(ready),
    label: `${ready} ready`,
    description: `${ready} completed tasks ready; ${remainder} of ${required} characters toward the next`
  };
}
