export function shouldHideMemoryCharacter(index: number, visibility: number): boolean {
  const normalizedVisibility = Math.max(0, Math.min(100, visibility));
  if (normalizedVisibility >= 100) return false;
  if (normalizedVisibility <= 0) return true;
  return ((index * 37 + 17) % 100) >= normalizedVisibility;
}

export function shouldMaskMemoryCharacter(
  index: number,
  visibility: number,
  typedCharacter: string | undefined,
  expectedCharacter: string
): boolean {
  return shouldHideMemoryCharacter(index, visibility) && typedCharacter !== expectedCharacter;
}
