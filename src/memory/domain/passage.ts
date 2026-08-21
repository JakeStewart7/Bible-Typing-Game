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
  const verses = reference.startVerse === reference.endVerse
    ? reference.startVerse
    : `${reference.startVerse}–${reference.endVerse}`;
  return `${reference.book} ${reference.chapter}:${verses}`;
}
