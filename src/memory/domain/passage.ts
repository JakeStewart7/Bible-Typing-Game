export type PassageReference = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  translation: string;
};

export type PassageLocation = Pick<
  PassageReference,
  'book' | 'chapter' | 'startVerse' | 'endVerse'
>;

export function createPassageId(reference: PassageReference): string {
  return [
    reference.translation,
    reference.book,
    reference.chapter,
    reference.startVerse,
    reference.endVerse
  ].join(':');
}

export function samePassageReference(left: PassageReference, right: PassageReference): boolean {
  return createPassageId(left) === createPassageId(right);
}

export function formatPassageLabel(reference: PassageLocation): string {
  return `${reference.book} ${reference.chapter}:${
    formatVerseRange(reference.startVerse, reference.endVerse)
  }`;
}

export function formatVerseRange(startVerse: number, endVerse: number): string {
  return startVerse === endVerse ? String(startVerse) : `${startVerse}–${endVerse}`;
}

export function formatVerseSelectionLabel(startVerse: number, endVerse: number): string {
  const range = formatVerseRange(startVerse, endVerse);
  return startVerse === endVerse ? `Verse ${range}` : `Verses ${range}`;
}
