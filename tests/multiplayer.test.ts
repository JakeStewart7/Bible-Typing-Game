import { RoomEngine } from '../src/multiplayer/domain/room-engine.ts';
import { scorePassageGuess } from '../src/multiplayer/domain/scoring.ts';
import { BOT_DIFFICULTY_OPTIONS } from '../src/multiplayer/domain/settings.ts';
import { ROUND_COUNTDOWN_MS } from '../src/multiplayer/domain/settings.ts';
import type { MultiplayerPassage, RoomSnapshot } from '../src/multiplayer/domain/types.ts';
import { selectPassageWithinLimit } from '../src/multiplayer/infrastructure/bible-passage-provider.ts';
import {
  MOCK_REFRESH_INTERVAL_MS,
  MockMultiplayerClient,
  nextBotTyping,
  nextTypingDelayMs
} from '../src/multiplayer/infrastructure/mock-multiplayer-client.ts';
import { equal, test } from './harness.ts';

test('multiplayer scoring rewards exact references and degrades by distance', () => {
  const answer = { book: 'John', chapter: 3, startVerse: 16, endVerse: 19 };
  equal(scorePassageGuess({
    book: 'John', chapter: 3, startVerse: 16, endVerse: 19
  }, answer), 100);
  equal(scorePassageGuess({
    book: 'Matthew', chapter: null, startVerse: null, endVerse: null
  }, answer), 40);
  equal(scorePassageGuess({
    book: 'Romans', chapter: null, startVerse: null, endVerse: null
  }, answer), 20);
  equal(scorePassageGuess({
    book: 'Genesis', chapter: null, startVerse: null, endVerse: null
  }, answer), 0);
  equal(scorePassageGuess({
    book: 'John', chapter: 4, startVerse: 17, endVerse: 20
  }, answer), 98);
  equal(scorePassageGuess({
    book: 'Revelation', chapter: null, startVerse: null, endVerse: null
  }, { book: 'Isaiah', chapter: 5, startVerse: 1, endVerse: 1 }), 20);
});

test('bot difficulties define requested accuracy and speed ranges', () => {
  equal(MOCK_REFRESH_INTERVAL_MS, 100);
  equal(BOT_DIFFICULTY_OPTIONS.easy, {
    label: 'Easy', accuracy: .85, minimumWpm: 20, maximumWpm: 30,
    characterTimingVariation: .65, wordTimingVariation: .9
  });
  equal(BOT_DIFFICULTY_OPTIONS.medium, {
    label: 'Normal', accuracy: .9, minimumWpm: 40, maximumWpm: 50,
    characterTimingVariation: .5, wordTimingVariation: .75
  });
  equal(BOT_DIFFICULTY_OPTIONS.hard, {
    label: 'Hard', accuracy: .95, minimumWpm: 70, maximumWpm: 80,
    characterTimingVariation: .25, wordTimingVariation: .42
  });
  equal(BOT_DIFFICULTY_OPTIONS['very-hard'], {
    label: 'Very hard', accuracy: .96, minimumWpm: 90, maximumWpm: 110,
    characterTimingVariation: .22, wordTimingVariation: .36
  });
  equal(BOT_DIFFICULTY_OPTIONS.extreme, {
    label: 'Extreme', accuracy: .98, minimumWpm: 110, maximumWpm: 130,
    characterTimingVariation: .18, wordTimingVariation: .3
  });
  equal(nextBotTyping('Faith', '', 'easy', () => 0), 'F');
  equal(nextBotTyping('Faith', '', 'easy', () => .99) === 'F', false);
  equal(nextBotTyping('Faith', 'x', 'hard', () => 0), '');
  equal(
    nextTypingDelayMs(75, 'Faith', 'hard', () => 0)
      < nextTypingDelayMs(25, 'Faith', 'easy', () => 0),
    true
  );
  equal(Math.round((
    nextTypingDelayMs(60, 'Faith', 'medium', () => 0)
    + nextTypingDelayMs(60, 'Faith', 'medium', () => 1)
  ) / 2), 200);
  equal(measureBotWpm('easy', 25, 11) >= 20 && measureBotWpm('easy', 25, 11) <= 30, true);
  equal(measureBotWpm('medium', 45, 22) >= 40 && measureBotWpm('medium', 45, 22) <= 50, true);
  equal(measureBotWpm('hard', 75, 33) >= 70 && measureBotWpm('hard', 75, 33) <= 80, true);
  equal(
    measureBotWpm('very-hard', 100, 44) >= 90
      && measureBotWpm('very-hard', 100, 44) <= 110,
    true
  );
  equal(
    measureBotWpm('extreme', 120, 55) >= 110
      && measureBotWpm('extreme', 120, 55) <= 130,
    true
  );
});

test('multiplayer passage lengths enforce absolute character ceilings', () => {
  const verses = [
    { verse: 1, text: `${'A'.repeat(59)}.` },
    { verse: 2, text: `${'B'.repeat(58)}.` }
  ];
  equal(selectPassageWithinLimit('Test', 1, verses, 0, 60).text.length, 60);
  equal(selectPassageWithinLimit('Test', 1, verses, 0, 120).text.length, 120);
  equal(selectPassageWithinLimit('Test', 1, verses, 0, 120).reference.endVerse, 2);
  const boundary = selectPassageWithinLimit('Test', 1, [
    { verse: 1, text: 'Faith.' },
    { verse: 2, text: 'Hope' }
  ], 0, 6);
  equal(boundary.text, 'Faith.');
  equal(boundary.reference.endVerse, 1);
  const retried = selectPassageWithinLimit('Test', 1, [
    { verse: 1, text: 'A passage without terminal punctuation' },
    { verse: 2, text: 'Hope.' }
  ], 0, 20);
  equal(retried.text, 'Hope.');
});

test('only the host can add bots and each bot keeps its own difficulty', async () => {
  const passage: MultiplayerPassage = {
    text: 'Faith.',
    reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
  };
  const room = new RoomEngine('BOTS', { nextPassage: async () => passage }, undefined, Date.now, 0);
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  let guestRejected = false;
  try {
    await room.dispatch('guest', { type: 'ADD_BOT' });
  } catch {
    guestRejected = true;
  }
  equal(guestRejected, true);
  await room.dispatch('host', { type: 'ADD_BOT' });
  const bot = room.getSnapshot('host').players.find(player => player.kind === 'simulated');
  equal(bot?.botDifficulty, 'medium');
  if (!bot) throw new Error('Expected a simulated player.');
  await room.dispatch('host', {
    type: 'UPDATE_BOT_DIFFICULTY',
    playerId: bot.id,
    difficulty: 'easy'
  });

  test('new local multiplayer rooms include hard, very hard, and extreme bots', async () => {
    const client = new MockMultiplayerClient({
      nextPassage: async () => ({
        text: 'Faith.',
        reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
      })
    });
    const connection = await client.createRoom('Host');
    let snapshot: RoomSnapshot | null = null;
    const unsubscribe = connection.subscribe(nextSnapshot => {
      snapshot = nextSnapshot;
    });
    equal(
      snapshot?.players
        .filter(player => player.kind === 'simulated')
        .map(player => player.botDifficulty),
      ['hard', 'very-hard', 'extreme']
    );
    unsubscribe();
    connection.disconnect();
  });
  equal(room.getSnapshot('host').players.find(player => player.id === bot.id)?.botDifficulty, 'easy');
});

test('guess timer submits each current draft when the deadline expires', async () => {
  let now = 1_000;
  const passage: MultiplayerPassage = {
    text: 'Faith.',
    reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
  };
  const room = new RoomEngine(
    'TIMER',
    { nextPassage: async () => passage },
    { botDifficulty: 'medium', passageLength: 'short', includeGuessing: true },
    () => now,
    0
  );
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  await room.dispatch('guest', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  await room.dispatch('host', {
    type: 'UPDATE_GUESS',
    guess: { book: 'Hebrews', chapter: 11, startVerse: null, endVerse: null }
  });
  equal(room.getSnapshot('host').guessingEndsAt, 31_000);
  now = 31_000;
  room.tick();
  const snapshot = room.getSnapshot('host');
  equal(snapshot.phase, 'reveal');
  equal(snapshot.players[0]?.guess, {
    book: 'Hebrews', chapter: 11, startVerse: null, endVerse: null
  });
  equal(snapshot.players[1]?.guess, {
    book: '', chapter: null, startVerse: null, endVerse: null
  });
});

test('multiplayer can reveal immediately when passage guessing is disabled', async () => {
  const passage: MultiplayerPassage = {
    text: 'Faith.',
    reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
  };
  const room = new RoomEngine(
    'DIRECT',
    { nextPassage: async () => passage },
    { botDifficulty: 'medium', passageLength: 'short', includeGuessing: false },
    Date.now,
    0
  );
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  await room.dispatch('guest', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  const snapshot = room.getSnapshot('host');
  equal(snapshot.phase, 'reveal');
  equal(snapshot.guessingEndsAt, null);
  equal(snapshot.players.map(player => player.score), [null, null]);
});

test('multiplayer tracks actual cursors and freezes completed typing statistics', async () => {
  let now = 1_000;
  const passage: MultiplayerPassage = {
    text: 'Faith comes.',
    reference: { book: 'Romans', chapter: 10, startVerse: 17, endVerse: 17 }
  };
  const room = new RoomEngine(
    'STATS',
    { nextPassage: async () => passage },
    { botDifficulty: 'medium', passageLength: 'short', includeGuessing: true },
    () => now,
    0
  );
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  now = 2_000;
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'Faith x', sequence: 1 });
  let host = room.getSnapshot('host').players[0]!;
  equal({ cursor: host.cursor, progress: host.progress }, { cursor: 7, progress: 6 });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'Fax', sequence: 2 });
  host = room.getSnapshot('host').players[0]!;
  equal({ cursor: host.cursor, progress: host.progress }, { cursor: 3, progress: 6 });
  now = 3_000;
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 3 });
  host = room.getSnapshot('host').players[0]!;
  const completedStats = { wpm: host.wpm, accuracy: host.accuracy };
  now = 63_000;
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: '', sequence: 4 });
  host = room.getSnapshot('host').players[0]!;
  equal({ wpm: host.wpm, accuracy: host.accuracy }, completedStats);
  equal({ cursor: host.cursor, progress: host.progress }, {
    cursor: passage.text.length,
    progress: passage.text.length
  });

  test('multiplayer refresh ticks recalculate active WPM', async () => {
    let now = 1_000;
    const passage: MultiplayerPassage = {
      text: 'Faith',
      reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
    };
    const room = new RoomEngine('REFRESH', { nextPassage: async () => passage }, undefined, () => now, 0);
    room.addPlayer('host', 'Host');
    room.addPlayer('guest', 'Guest');
    await room.dispatch('host', { type: 'START_ROUND' });
    await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'F', sequence: 1 });
    now += MOCK_REFRESH_INTERVAL_MS;
    room.tick();
    equal(room.getSnapshot('host').players[0]?.wpm, 120);
    now += MOCK_REFRESH_INTERVAL_MS;
    room.tick();
    equal(room.getSnapshot('host').players[0]?.wpm, 60);
  });
});

test('multiplayer room advances only after every player completes each phase', async () => {
  const passage: MultiplayerPassage = {
    text: 'Faith comes by hearing.',
    reference: { book: 'Romans', chapter: 10, startVerse: 17, endVerse: 17 }
  };
  const room = new RoomEngine('FAITH', { nextPassage: async () => passage }, undefined, Date.now, 0);
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  equal(room.getSnapshot('host').phase, 'typing');
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'Faith', sequence: 1 });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  equal(room.getSnapshot('host').players[0]?.cursor, 5);
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 2 });
  equal(room.getSnapshot('host').phase, 'typing');
  await room.dispatch('guest', { type: 'UPDATE_TYPING', typedText: passage.text, sequence: 1 });
  equal(room.getSnapshot('host').phase, 'guessing');
  const exactGuess = { book: 'Romans', chapter: 10, startVerse: 17, endVerse: 17 };
  await room.dispatch('host', { type: 'UPDATE_GUESS', guess: exactGuess });
  await room.dispatch('host', { type: 'SUBMIT_GUESS' });
  equal(room.getSnapshot('host').revealedReference, null);
  await room.dispatch('guest', { type: 'UPDATE_GUESS', guess: exactGuess });
  await room.dispatch('guest', { type: 'SUBMIT_GUESS' });
  equal(room.getSnapshot('host').phase, 'reveal');
  equal(room.getSnapshot('host').players.map(player => player.score), [100, 100]);
  let rejectedEarlyStart = false;
  try {
    await room.dispatch('host', { type: 'START_ROUND' });
  } catch {
    rejectedEarlyStart = true;
  }
  equal(rejectedEarlyStart, true);
  await room.dispatch('host', { type: 'SET_READY', ready: true });
  equal(room.getSnapshot('host').round, 1);
  await room.dispatch('guest', { type: 'SET_READY', ready: true });
  equal(room.getSnapshot('host').round, 2);
  equal(room.getSnapshot('host').phase, 'typing');
});

test('multiplayer countdown gates typing stats and shares encouragement words', async () => {
  let now = 1_000;
  const passage: MultiplayerPassage = {
    text: 'Faith.',
    reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
  };
  const room = new RoomEngine(
    'COUNTDOWN',
    { nextPassage: async () => passage },
    undefined,
    () => now
  );
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  equal(room.getSnapshot('host').countdownEndsAt, now + ROUND_COUNTDOWN_MS);
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'F', sequence: 1 });
  equal(room.getSnapshot('host').players[0]?.cursor, 0);
  now += ROUND_COUNTDOWN_MS;
  room.tick();
  await room.dispatch('guest', { type: 'SEND_ENCOURAGEMENT', word: 'Strength' });
  equal(room.getSnapshot('host').encouragement, {
    id: 1, playerName: 'Guest', word: 'Strength'
  });
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: 'F', sequence: 1 });
  equal(room.getSnapshot('host').players[0]?.cursor, 1);
});

test('multiplayer moves to a final summary after the configured rounds', async () => {
  const passage: MultiplayerPassage = {
    text: 'Faith.',
    reference: { book: 'Hebrews', chapter: 11, startVerse: 1, endVerse: 1 }
  };
  const room = new RoomEngine(
    'ROUNDS',
    { nextPassage: async () => passage },
    { botDifficulty: 'medium', passageLength: 'short', includeGuessing: false, rounds: 3 },
    Date.now,
    0
  );
  room.addPlayer('host', 'Host');
  room.addPlayer('guest', 'Guest');
  await room.dispatch('host', { type: 'START_ROUND' });
  await completeTyping(room, passage.text);
  equal(room.getSnapshot('host').phase, 'reveal');
  await room.dispatch('host', { type: 'SET_READY', ready: true });
  await room.dispatch('guest', { type: 'SET_READY', ready: true });
  await completeTyping(room, passage.text);
  await room.dispatch('host', { type: 'SET_READY', ready: true });
  await room.dispatch('guest', { type: 'SET_READY', ready: true });
  await completeTyping(room, passage.text);
  const snapshot = room.getSnapshot('host');
  equal(snapshot.phase, 'summary');
  equal(snapshot.round, 3);
  equal(snapshot.players.map(player => player.name), ['Host', 'Guest']);
});

function measureBotWpm(
  difficulty: keyof typeof BOT_DIFFICULTY_OPTIONS,
  targetWpm: number,
  seed: number
): number {
  const passage = 'Faith comes by hearing and hearing by the word. '.repeat(30);
  const option = BOT_DIFFICULTY_OPTIONS[difficulty];
  const actionWpm = targetWpm * (2 - option.accuracy) / option.accuracy;
  let state = seed;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
  let typedText = '';
  let elapsedMs = 0;
  while (typedText !== passage) {
    typedText = nextBotTyping(passage, typedText, difficulty, random);
    elapsedMs += nextTypingDelayMs(actionWpm, typedText, difficulty, random);
  }

  return Math.round((passage.length / 5) / (elapsedMs / 60_000));
}

async function completeTyping(room: RoomEngine, text: string): Promise<void> {
  await room.dispatch('host', { type: 'UPDATE_TYPING', typedText: text, sequence: 1 });
  await room.dispatch('guest', { type: 'UPDATE_TYPING', typedText: text, sequence: 1 });
}
