import { PHRASE_LENGTHS, type PhraseLength } from '../domain/types.ts';

export function taskShortcut(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 9) throw new Error('Task shortcuts support ten options per role.');
  return String((index + 1) % 10);
}

export function actionShortcutKey(event: Pick<KeyboardEvent, 'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey'>): string | null {
  if (!event.altKey || event.ctrlKey || event.metaKey) return null;
  const digit = /^Digit([0-9])$/.exec(event.code)?.[1];
  return digit ?? (/^[0-9]$/.test(event.key) ? event.key : null);
}

export function arrowLength(length: PhraseLength, key: string): PhraseLength | null {
  const direction = key === 'ArrowRight' || key === 'ArrowUp' ? 1 : key === 'ArrowLeft' || key === 'ArrowDown' ? -1 : 0;
  if (!direction) return null;
  return PHRASE_LENGTHS[Math.max(0, Math.min(PHRASE_LENGTHS.length - 1, PHRASE_LENGTHS.indexOf(length) + direction))] ?? null;
}
