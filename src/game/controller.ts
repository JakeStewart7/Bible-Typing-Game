import { sanitizeText } from './state';
import type { Game } from './state';
import { handleInput } from './input';
import { renderText, updateCaretPosition } from '../ui/renderer';
import { renderTypedBar } from '../ui/typedBar';
import { renderStats } from '../ui/hud';
import { calculateStats } from './stats';
import { fetchChapter, fetchRange } from '../bible-api';
import { playComplete, playKey } from '../audio/effects';
import { advanceEnemy, buyUpgrade, completeDefense, createDefenseState, typeCharacter } from './minigame';
import type { DefenseState, UpgradeId } from './minigame';
import { isChapterComplete, nextChunk, starsForWpm } from '../campaign';
import type { CampaignChunk, CampaignProgress } from '../campaign';
import { createCampaignChunks } from '../campaign';
import { MODE_BONUSES, MODE_LABELS, parseGameMode } from './modes';
import { readProfile, recordSession } from '../profile';
import { renderProfile } from '../ui/profile-view';
import { createDefenseView } from '../ui/defense-view';
import { BOOKS, getChapterCount } from '../bible-data';
import { getVerseCount } from '../verse-counts';
import { chooseRandomVerseRange } from '../passage-selector';

type Controls = {
  hudEl: HTMLElement; textEl: HTMLElement; inputEl: HTMLInputElement; typedBarEl: HTMLElement;
  translationEl: HTMLSelectElement; bookEl: HTMLSelectElement; chapterEl: HTMLSelectElement;
  startVerseEl: HTMLSelectElement; endVerseEl: HTMLSelectElement; loadBtn: HTMLButtonElement;
  statusEl: HTMLElement; passageTitleEl: HTMLElement; resultsEl: HTMLElement;
  resultStatsEl: HTMLElement; progressFillEl: HTMLElement;
  gameModeEl: HTMLSelectElement; challengeBannerEl: HTMLElement; typingCardEl: HTMLElement;
  rewardMessageEl: HTMLElement; levelLabelEl: HTMLElement;
  xpLabelEl: HTMLElement; xpFillEl: HTMLElement; personalBestEl: HTMLElement;
  lifetimeWpmEl: HTMLElement; recentWpmEl: HTMLElement;
  defenseGameEl: HTMLElement; faithCountEl: HTMLElement; fortressHealthEl: HTMLElement;
  waveCountEl: HTMLElement; defeatedCountEl: HTMLElement; battlePathEl: HTMLElement;
  battleMessageEl: HTMLElement;
  populateBooks: () => void; populateChapters: (preferred?: number) => void;
  populateVerses: () => Promise<void>; constrainEndVerses: () => void;
};

export function initGameControllers(game: Game, controls: Controls) {
  const { hudEl, textEl, inputEl, typedBarEl, translationEl, bookEl, chapterEl,
    startVerseEl, endVerseEl, loadBtn, statusEl, passageTitleEl, resultsEl,
    resultStatsEl, progressFillEl, gameModeEl, challengeBannerEl, typingCardEl,
    rewardMessageEl, levelLabelEl, xpLabelEl, xpFillEl, personalBestEl, lifetimeWpmEl, recentWpmEl,
    defenseGameEl, faithCountEl, fortressHealthEl, waveCountEl, defeatedCountEl,
    battlePathEl, battleMessageEl,
    populateBooks, populateChapters, populateVerses, constrainEndVerses } = controls;
  let hudInterval: number | undefined;
  let hasCompleted = false;
  let defense: DefenseState = createDefenseState();
  let defenseFrame = 0;
  let previousFrame = performance.now();
  let defenseTimer = 0;
  let memoryVisibility = 50;
  const defenseView = createDefenseView({
    faith: faithCountEl, fortress: fortressHealthEl, wave: waveCountEl,
    defeated: defeatedCountEl, path: battlePathEl, message: battleMessageEl
  });
  let campaignChunk: CampaignChunk | null = null;
  let campaignHooks: {
    save: (chunk: CampaignChunk, stars: number) => void;
    progress: () => CampaignProgress;
    celebrateBook: (book: string) => void;
    returnToMenu: (book: string) => void;
    startNext: (chunk: CampaignChunk) => void;
  } | null = null;

  function renderDefense() {
    defenseView.render(defense);
  }

  function defenseLoop(now: number) {
    const delta = Math.min(.1, (now - previousFrame) / 1000);
    previousFrame = now;
    if (gameModeEl.value === 'defense' && game.startTime) {
      advanceEnemy(defense, delta);
      renderDefense();
      if (defense.status === 'lost') inputEl.disabled = true;
    }
    defenseFrame = 0;
  }

  function scheduleDefenseFrame() {
    if (!defenseFrame) defenseFrame = requestAnimationFrame(defenseLoop);
  }

  function updateProfile() {
    renderProfile({
      level: levelLabelEl, xp: xpLabelEl, xpFill: xpFillEl,
      bestWpm: personalBestEl, lifetimeWpm: lifetimeWpmEl, recentWpm: recentWpmEl
    }, readProfile());
  }

  async function loadRandomDefensePassage(): Promise<void> {
    const book = BOOKS[Math.floor(Math.random() * BOOKS.length)] ?? 'John';
    const chapter = Math.floor(Math.random() * getChapterCount(book)) + 1;
    const range = chooseRandomVerseRange(getVerseCount(book, chapter), 7);
    statusEl.textContent = 'Loading a random seven-verse defense passage...';
    try {
      const data = await fetchRange(book, chapter, range.start, range.end, 'kjv', false);
      const text = sanitizeText(data.verses?.map(verse => verse.text).join(' ') || '');
      if (!text) throw new Error('Random defense passage was empty.');
      game.text = text;
      game.chars = text.split('');
      passageTitleEl.textContent = `${book} ${chapter}:${range.start}–${range.end}`;
      statusEl.textContent = '';
      restartGame();
    } catch (error) {
      console.error(error);
      statusEl.textContent = 'We could not load a defense passage. Please try Defense again.';
    }
  }

  function setMode() {
    const mode = parseGameMode(gameModeEl.value);
    typingCardEl.dataset.mode = mode;
    challengeBannerEl.textContent = MODE_LABELS[mode];
    defenseGameEl.classList.toggle('is-hidden', mode !== 'defense');
    document.getElementById('memory-controls')?.classList.toggle('is-hidden', mode !== 'memory');
    renderDefense();
    if (mode === 'defense') void loadRandomDefensePassage();
  }

  function updateUI(updateHud = true) {
    const stats = calculateStats(game);
    if (updateHud) renderStats(hudEl, stats);
    renderText(textEl, game);
    updateCaretPosition(textEl, game);
    renderTypedBar(typedBarEl, game);
    progressFillEl.style.width = `${stats.progress}%`;
  }

  function restartGame() {
    game.typed = [];
    game.errors = 0;
    game.attempted = [];
    game.firstAttemptCorrect = [];
    game.accuracyCorrect = 0;
    game.accuracyTotal = 0;
    game.accuracyCursor = 0;
    game.blockedAccuracyIndex = null;
    game.maxProgress = 0;
    game.startTime = null;
    game.completedAt = undefined;
    hasCompleted = false;
    defense = createDefenseState();
    defenseView.reset();
    inputEl.value = '';
    inputEl.disabled = false;
    resultsEl.classList.add('is-hidden');
    document.getElementById('next-passage')?.classList.remove('is-hidden');
    updateUI(false);
    window.clearInterval(hudInterval);
    hudInterval = window.setInterval(() => renderStats(hudEl, calculateStats(game)), 250);
    inputEl.focus();
  }

  function finishGame() {
    if (hasCompleted) return;
    hasCompleted = true;
    if (gameModeEl.value === 'defense') completeDefense(defense);
    game.completedAt = Date.now();
    inputEl.disabled = true;
    window.clearInterval(hudInterval);
    const stats = calculateStats(game);
    updateUI(false);
    resultStatsEl.innerHTML = [
      [`${stats.wpm}`, 'WPM'],
      [`${stats.accuracy}%`, 'Accuracy'],
      [`${stats.time}s`, 'Time']
    ].map(([value, label]) => `<div class="result-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
    const mode = parseGameMode(gameModeEl.value);
    const resultsTitle = document.getElementById('results-title');
    const resultsCopy = document.getElementById('results-copy');
    const nextButton = document.getElementById('next-passage');
    const chapterSelectButton = document.getElementById('chapter-select');
    if (resultsTitle) resultsTitle.textContent = campaignChunk ? 'Campaign passage complete' : mode === 'defense' ? 'Fortress defended' : mode === 'memory' ? 'Memory passage complete' : 'Practice complete';
    if (resultsCopy) resultsCopy.textContent = mode === 'defense' ? 'The shadows were repelled.' : mode === 'memory' ? 'You recalled the passage.' : '';
    if (chapterSelectButton) chapterSelectButton.textContent = campaignChunk ? 'Back to selection' : 'Choose passage';
    if (nextButton) nextButton.classList.toggle('is-hidden', !campaignChunk);
    const earnedXp = Math.max(25, Math.round((stats.wpm + stats.accuracy + game.text.length / 10) * MODE_BONUSES[mode]));
    rewardMessageEl.textContent = `✦ +${earnedXp} XP · ${gameModeEl.options[gameModeEl.selectedIndex].text.split(' — ')[0]} completed`;
    if (campaignChunk && campaignHooks) {
      const stars = starsForWpm(stats.wpm, stats.accuracy);
      campaignHooks.save(campaignChunk, Math.max(1, stars));
      rewardMessageEl.textContent = `${'★'.repeat(Math.max(1, stars))}${'☆'.repeat(5 - Math.max(1, stars))} · ${campaignChunk.book} ${campaignChunk.chapter}:${campaignChunk.startVerse}–${campaignChunk.endVerse}`;
      const completedChapter = isChapterComplete(campaignChunk, campaignHooks.progress());
      const following = nextChunk(campaignChunk);
      const completedBook = !following && getBookProgressComplete(campaignChunk.book, campaignHooks.progress());
      if (completedBook) campaignHooks.celebrateBook(campaignChunk.book);
      if (nextButton) {
        nextButton.textContent = 'Next passage';
        nextButton.classList.toggle('is-hidden', !following);
      }
      if (chapterSelectButton) chapterSelectButton.textContent = 'Back to selection';
    }
    resultsEl.classList.remove('is-hidden');
    playComplete();
    recordSession(stats.wpm, earnedXp);
    updateProfile();
  }

  inputEl.addEventListener('input', () => {
    const mode = gameModeEl.value;
    const previousLength = game.typed.length;
    handleInput(game, inputEl.value);
    if (game.typed.length > previousLength) {
      const index = game.typed.length - 1;
      const correct = game.typed[index] === game.chars[index];
      playKey(correct);
      if (mode === 'defense') {
        typeCharacter(defense, correct);
        renderDefense();
        scheduleDefenseFrame();
      }
    }
    updateUI();
    if (game.typed.join('') === game.text) finishGame();
  });

  textEl.addEventListener('click', () => inputEl.focus());
  document.getElementById('restart')?.addEventListener('click', restartGame);
  document.getElementById('dev-complete-passage')?.addEventListener('click', () => {
    if (hasCompleted) return;
    game.typed = [...game.chars];
    game.attempted = game.chars.map(() => true);
    game.firstAttemptCorrect = game.chars.map(() => true);
    if (!game.startTime) game.startTime = Date.now() - 30_000;
    inputEl.value = game.text;
    finishGame();
  });
  document.getElementById('try-again')?.addEventListener('click', restartGame);
  document.getElementById('chapter-select')?.addEventListener('click', () => {
    resultsEl.classList.add('is-hidden');
    if (campaignChunk && campaignHooks) {
      campaignHooks.returnToMenu(campaignChunk.book);
      return;
    }
    document.querySelector('.passage-panel')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('next-passage')?.addEventListener('click', () => {
    if (campaignChunk && campaignHooks) {
      const completed = campaignChunk;
      const following = nextChunk(completed);
      if (following) campaignHooks.startNext(following);
      else campaignHooks.returnToMenu(completed.book);
      resultsEl.classList.add('is-hidden');
      return;
    }
    resultsEl.classList.add('is-hidden');
    document.querySelector('.passage-panel')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('focus-button')?.addEventListener('click', () => {
    document.getElementById('game-screen')?.classList.toggle('focus-mode');
  });

  loadBtn.addEventListener('click', async () => {
    const start = Number(startVerseEl.value);
    const end = Math.max(start, Number(endVerseEl.value));
    loadBtn.disabled = true;
    statusEl.textContent = 'Loading your passage...';
    try {
      let data: { verses?: Array<{ text: string }> };
      try {
        data = await fetchRange(bookEl.value, Number(chapterEl.value), start, end, translationEl.value, false);
      } catch {
        throw new Error(`${translationEl.options[translationEl.selectedIndex].text} is not available from the current Bible provider.`);
      }
      const text = sanitizeText(data.verses?.map(verse => verse.text).join(' ') || '');
      if (!text) throw new Error('No verses were returned.');
      game.text = text;
      game.chars = text.split('');
      passageTitleEl.textContent = `${bookEl.value} ${chapterEl.value}:${start}${end > start ? `–${end}` : ''}`;
      statusEl.textContent = '';
      restartGame();
    } catch (error) {
      console.error(error);
      statusEl.textContent = 'We could not load that passage. Please try again.';
    } finally {
      loadBtn.disabled = false;
    }
  });

  populateBooks();
  translationEl.value = 'kjv';
  bookEl.value = 'John';
  populateChapters(3);
  void populateVerses();
  translationEl.addEventListener('change', populateVerses);
  bookEl.addEventListener('change', () => {
    populateChapters();
    void populateVerses();
  });
  chapterEl.addEventListener('change', populateVerses);
  startVerseEl.addEventListener('change', () => {
    constrainEndVerses();
  });
  endVerseEl.addEventListener('change', () => {
    if (Number(endVerseEl.value) < Number(startVerseEl.value)) endVerseEl.value = startVerseEl.value;
  });
  gameModeEl.addEventListener('change', setMode);
  const memorySlider = document.getElementById('memory-visibility') as HTMLInputElement | null;
  memorySlider?.addEventListener('input', () => {
    memoryVisibility = Number(memorySlider.value);
    document.getElementById('memory-visibility-value')!.textContent = `${memoryVisibility}%`;
    typingCardEl.style.setProperty('--memory-visibility', String(memoryVisibility));
    updateUI();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.upgrade as UpgradeId;
      if (buyUpgrade(defense, id)) {
        battleMessageEl.textContent = `${button.querySelector('strong')?.textContent} upgraded!`;
        renderDefense();
      }
    });
  });
  setMode();
  updateProfile();
  restartGame();
  defenseTimer = window.setInterval(() => {
    if (gameModeEl.value === 'defense' && game.startTime && defense.status === 'playing') {
      scheduleDefenseFrame();
    }
  }, 50);

  return {
    restartGame,
    startCampaignChunk: (chunk: CampaignChunk, text: string) => {
      campaignChunk = chunk;
      game.text = sanitizeText(text);
      game.chars = game.text.split('');
      passageTitleEl.textContent = `${chunk.book} ${chunk.chapter}:${chunk.startVerse}–${chunk.endVerse}`;
      gameModeEl.value = 'practice';
      setMode();
      restartGame();
    },
    setCampaignHooks: (hooks: NonNullable<typeof campaignHooks>) => { campaignHooks = hooks; },
    leaveCampaign: () => { campaignChunk = null; },
    stop: () => {
      cancelAnimationFrame(defenseFrame);
      clearInterval(defenseTimer);
    }
  };
}

function getBookProgressComplete(book: string, progress: CampaignProgress): boolean {
  return createCampaignChunks(book).every(chunk => (progress[chunk.id] ?? 0) > 0);
}
