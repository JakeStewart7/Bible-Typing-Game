import type { PassageGuess, PassageReference } from './types.ts';

function proximityScore(actual: number, guessed: number | null, weight: number, penalty: number): number {
  if (guessed === null) return 0;
  return Math.max(0, weight - Math.abs(actual - guessed) * penalty);
}

export function scorePassageGuess(guess: PassageGuess, answer: PassageReference): number {
  const bookScore = guess.book.trim().toLowerCase() === answer.book.toLowerCase() ? 40 : 0;
  const chapterScore = proximityScore(answer.chapter, guess.chapter, 25, 5);
  const startScore = proximityScore(answer.startVerse, guess.startVerse, 20, 4);
  const endScore = proximityScore(answer.endVerse, guess.endVerse, 15, 3);
  return Math.round(bookScore + chapterScore + startScore + endScore);
}
