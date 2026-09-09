import {
  completePassage,
  createCampaignChunks,
  getBookProgress,
  getCampaignProgress,
  nextChunk,
  normalizeCampaignProgress,
  starsForWpm
} from '../src/campaign.ts';
import { filterJourneyBooks, findJourneyContinuation, groupJourneyBooks, isJourneyBookUnlocked, journeyCurrency } from '../src/journey.ts';
import { equal, test } from './harness.ts';

test('Journey progress creates a task for every verse', () => {
  const chunks = createCampaignChunks('John');
  equal(chunks[0], { id: 'John:1:1-1', book: 'John', chapter: 1, startVerse: 1, endVerse: 1 });
  equal(chunks.filter(chunk => chunk.chapter === 1).at(-1)?.endVerse, 51);
  equal(chunks.some((chunk, index) => index > 0 && chunk.chapter !== chunks[index - 1]?.chapter && chunk.startVerse !== 1), false);
});

test('Practice completions mark every selected verse and migrate legacy ranges', () => {
  const legacy = normalizeCampaignProgress({ 'John:3:1-3': 2 });
  equal(Object.keys(legacy), ['John:3:1-1', 'John:3:2-2', 'John:3:3-3']);
  const completed = completePassage(legacy, {
    book: 'John', chapter: 3, startVerse: 2, endVerse: 4
  }, 4);
  equal(completed['John:3:1-1'], 2);
  equal(completed['John:3:2-2'], 4);
  equal(completed['John:3:4-4'], 4);
});

test('campaign stars use researched speed and accuracy thresholds', () => {
  equal(starsForWpm(24, 100), 0);
  equal(starsForWpm(40, 100), 2);
  equal(starsForWpm(100, 100), 5);
  equal(starsForWpm(100, 89), 2);
});

test('campaign progress and next passage are deterministic', () => {
  const chunks = createCampaignChunks('Obadiah');
  const progress = { [chunks[0]!.id]: 3 };
  equal(getBookProgress('Obadiah', progress).completed, 1);
  equal(nextChunk(chunks[0]!), chunks[1]);
});

test('campaign summary counts completed books', () => {
  const progress = Object.fromEntries(createCampaignChunks('Obadiah').map(chunk => [chunk.id, 1]));
  equal(getCampaignProgress(progress).completedBooks, 1);
  equal(getCampaignProgress(progress).completedChapters, 1);
});

test('journey search supports fuzzy typed matching', () => {
  equal(filterJourneyBooks('mthw').slice(0, 1), ['Matthew']);
  equal(filterJourneyBooks('song sol').slice(0, 1), ['Song of Solomon']);
});

test('journey books are grouped into canonical testaments', () => {
  const groups = groupJourneyBooks(['Genesis', 'Matthew', 'Psalms', 'John']);
  equal(groups, [
    { testament: 'Old Testament', books: ['Genesis', 'Psalms'] },
    { testament: 'New Testament', books: ['Matthew', 'John'] }
  ]);
});

test('journey unlocks starting books and progresses deterministically', () => {
  equal(isJourneyBookUnlocked('Matthew', {}), true);
  equal(isJourneyBookUnlocked('Genesis', {}), true);
  equal(isJourneyBookUnlocked('Psalms', {}), true);
  equal(isJourneyBookUnlocked('Mark', {}), false);
  const completedMatthew = Object.fromEntries(createCampaignChunks('Matthew').map(chunk => [chunk.id, 1]));
  equal(isJourneyBookUnlocked('Mark', completedMatthew), true);
});

test('journey currency counts unique completed verses without using stars', () => {
  equal(journeyCurrency({ 'Matthew:1:1-3': 5, 'Genesis:1:1-3': 1, invalid: 5, 'Mark:1:1-3': 0 }), 2);
});

test('journey continuation preserves a valid stored passage and advances completed work', () => {
  const first = createCampaignChunks('Matthew')[0]!;
  equal(findJourneyContinuation({}, first), first);
  equal(findJourneyContinuation({ [first.id]: 1 }, first), createCampaignChunks('Matthew')[1]);
});

