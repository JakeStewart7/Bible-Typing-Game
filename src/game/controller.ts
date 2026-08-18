import { sanitizeText } from './state';
import type { Game } from './state';
import { handleInput } from './input';
import { renderText, updateCaretPosition } from '../ui/renderer';
import { renderTypedBar } from '../ui/typedBar';
import { renderStats } from '../ui/hud';
import { calculateStats } from './stats';
import { fetchChapter, fetchRange } from '../bible-api';
import { playComplete, playKey, playReady } from '../audio/effects';
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
import type { AppConfig } from '../config';
import type { AppStateRepository, PassageReference } from '../persistence/app-state';
import type { ProfileRepository } from '../persistence/profile-repository';
import type { AppStorage } from '../persistence/storage';
import { getCurrentWord, isHintAvailable } from './hint';
import { analyzeSession } from './analysis';
import { BrowserSessionHistoryRepository } from './session-history';
import {
  createPassageId,
  isFavoritePassage,
  recordRecentPassage,
  toMemoryPassage,
  toggleFavoritePassage
} from '../memory/domain/practice-library';
import type { MemoryLibraryRepository, MemoryPassage } from '../memory/domain/practice-library';
import { renderEmptyState } from '../ui/components';

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
  readyIndicatorEl: HTMLElement; hintButtonEl: HTMLButtonElement; favoritePassageEl: HTMLButtonElement;
  memoryLibraryEl: HTMLElement; memoryFavoritesEl: HTMLElement; memoryRecentEl: HTMLElement;
  resultAnalysisEl: HTMLElement;
  populateBooks: () => void; populateChapters: (preferred?: number) => void;
  populateVerses: () => Promise<void>; constrainEndVerses: () => void;
};

export function initGameControllers(
  game: Game,
  controls: Controls,
  stateRepository: AppStateRepository,
  profileRepository: ProfileRepository,
  storage: AppStorage,
  config: AppConfig
) {
  const { hudEl, textEl, inputEl, typedBarEl, translationEl, bookEl, chapterEl,
    startVerseEl, endVerseEl, loadBtn, statusEl, passageTitleEl, resultsEl,
    resultStatsEl, progressFillEl, gameModeEl, challengeBannerEl, typingCardEl,
    rewardMessageEl, levelLabelEl, xpLabelEl, xpFillEl, personalBestEl, lifetimeWpmEl, recentWpmEl,
    defenseGameEl, faithCountEl, fortressHealthEl, waveCountEl, defeatedCountEl,
    battlePathEl, battleMessageEl,
    readyIndicatorEl, hintButtonEl, favoritePassageEl, memoryLibraryEl,
    memoryFavoritesEl, memoryRecentEl, resultAnalysisEl,
    populateBooks, populateChapters, populateVerses, constrainEndVerses } = controls;
  let hudInterval: number | undefined;
  let hasCompleted = false;
  let defense: DefenseState = createDefenseState();
  let defenseFrame = 0;
  let previousFrame = performance.now();
  let memoryVisibility = 50;
  let activePassage: PassageReference | null = null;
  let lastProgressAt = Date.now();
  let hintTimer = 0;
  const memoryLibrary: MemoryLibraryRepository = {
    read: () => ({
      favorites: stateRepository.readMemoryFavorites().map((passage, index) =>
        toMemoryPassage(passage, Date.now() - index)),
      recent: stateRepository.readRecentPassages().map((passage, index) =>
        toMemoryPassage(passage, Date.now() - index))
    }),
    write: snapshot => {
      stateRepository.writeMemoryFavorites(snapshot.favorites);
      for (const passage of [...snapshot.recent].reverse()) {
        stateRepository.recordRecentPassage(passage);
      }
    }
  };
  const sessionHistory = new BrowserSessionHistoryRepository(storage);
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
    if (gameModeEl.value === 'defense' && game.startTime && defense.status === 'playing') {
      scheduleDefenseFrame();
    }
  }

  function scheduleDefenseFrame() {
    if (!defenseFrame) {
      previousFrame = performance.now();
      defenseFrame = requestAnimationFrame(defenseLoop);
    }
  }

  function updateProfile() {
    renderProfile({
      level: levelLabelEl, xp: xpLabelEl, xpFill: xpFillEl,
      bestWpm: personalBestEl, lifetimeWpm: lifetimeWpmEl, recentWpm: recentWpmEl
    }, readProfile(profileRepository));
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
      statusEl.textContent = 'We could not load an Arcade passage. Please try Arcade again.';
    }
  }

  function setMode() {
    const mode = parseGameMode(gameModeEl.value);
    typingCardEl.dataset.mode = mode;
    challengeBannerEl.textContent = MODE_LABELS[mode];
    defenseGameEl.classList.toggle('is-hidden', mode !== 'defense');
    document.getElementById('memory-controls')?.classList.toggle('is-hidden', mode !== 'memory');
    memoryLibraryEl.classList.toggle('is-hidden', mode !== 'memory');
    favoritePassageEl.classList.toggle('is-hidden', mode !== 'memory' || !activePassage);
    hintButtonEl.classList.toggle('is-hidden', mode !== 'memory');
    if (mode === 'memory') renderMemoryLibrary();
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

  function focusInput(): void {
    inputEl.focus({ preventScroll: gameModeEl.value === 'defense' });
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
    lastProgressAt = Date.now();
    defense = createDefenseState();
    defenseView.reset();
    inputEl.value = '';
    inputEl.disabled = false;
    resultsEl.classList.add('is-hidden');
    document.getElementById('next-passage')?.classList.remove('is-hidden');
    updateUI(false);
    window.clearInterval(hudInterval);
    hudInterval = window.setInterval(() => renderStats(hudEl, calculateStats(game)), 250);
    focusInput();
    showReadyIndicator();
    updateHintState();
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
    const previousSession = sessionHistory.readPrevious();
    const analysis = analyzeSession(game, stats, previousSession);
    resultAnalysisEl.replaceChildren(...renderAnalysis(analysis));
    const mode = parseGameMode(gameModeEl.value);
    const resultsTitle = document.getElementById('results-title');
    const resultsCopy = document.getElementById('results-copy');
    const nextButton = document.getElementById('next-passage');
    const chapterSelectButton = document.getElementById('chapter-select');
    if (resultsTitle) resultsTitle.textContent = campaignChunk ? 'Journey passage complete' : mode === 'defense' ? 'Arcade complete' : mode === 'memory' ? 'Memory passage complete' : 'Practice complete';
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
    sessionHistory.save(stats);
    if (mode === 'memory' && activePassage) {
      const snapshot = recordRecentPassage(memoryLibrary.read(), toMemoryPassage(activePassage, Date.now()));
      memoryLibrary.write(snapshot);
      renderMemoryLibrary();
    }
    recordSession(stats.wpm, earnedXp, profileRepository);
    updateProfile();
  }

  inputEl.addEventListener('input', () => {
    const mode = gameModeEl.value;
    const hadStarted = Boolean(game.startTime);
    const previousLength = game.typed.length;
    handleInput(game, inputEl.value);
    if (mode === 'memory' && !hadStarted && game.startTime && activePassage) {
      stateRepository.recordRecentPassage(activePassage);
    }
    if (game.typed.length > previousLength) {
      lastProgressAt = Date.now();
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
    updateHintState();
    if (game.typed.join('') === game.text) finishGame();
  });

  textEl.addEventListener('click', focusInput);
  document.getElementById('restart')?.addEventListener('click', restartGame);
  if (config.isDevelopment) {
    document.getElementById('dev-complete-passage')?.addEventListener('click', () => {
      if (hasCompleted) return;
      game.typed = [...game.chars];
      game.attempted = game.chars.map(() => true);
      game.firstAttemptCorrect = game.chars.map(() => true);
      if (!game.startTime) game.startTime = Date.now() - 30_000;
      inputEl.value = game.text;
      finishGame();
    });
  }
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
  hintButtonEl.addEventListener('click', () => {
    if (!isHintAvailable(lastProgressAt, Date.now())) return;
    hintButtonEl.textContent = getCurrentWord(game) || 'Hint';
    hintButtonEl.classList.remove('hint-ready');
    lastProgressAt = Date.now();
    window.setTimeout(() => {
      hintButtonEl.textContent = 'Hint';
      updateHintState();
    }, 1_800);
    focusInput();
  });
  favoritePassageEl.addEventListener('click', () => {
    if (!activePassage) return;
    const passage = toMemoryPassage(activePassage, Date.now());
    memoryLibrary.write(toggleFavoritePassage(memoryLibrary.read(), passage));
    renderMemoryLibrary();
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
      activePassage = { book: bookEl.value, chapter: Number(chapterEl.value), startVerse: start, endVerse: end, translation: translationEl.value };
      passageTitleEl.textContent = `${bookEl.value} ${chapterEl.value}:${start}${end > start ? `–${end}` : ''}`;
      statusEl.textContent = '';
      restartGame();
      if (gameModeEl.value === 'memory') {
        favoritePassageEl.classList.remove('is-hidden');
        renderMemoryLibrary();
      }
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
  hintTimer = window.setInterval(updateHintState, 250);

  return {
    restartGame,
    startCampaignChunk: (chunk: CampaignChunk, text: string) => {
      campaignChunk = chunk;
      game.text = sanitizeText(text);
      game.chars = game.text.split('');
      passageTitleEl.textContent = `${chunk.book} ${chunk.chapter}:${chunk.startVerse}–${chunk.endVerse}`;
      activePassage = { book: chunk.book, chapter: chunk.chapter, startVerse: chunk.startVerse, endVerse: chunk.endVerse, translation: 'kjv' };
      gameModeEl.value = 'practice';
      setMode();
      restartGame();
    },
    setCampaignHooks: (hooks: NonNullable<typeof campaignHooks>) => { campaignHooks = hooks; },
    leaveCampaign: () => { campaignChunk = null; },
    stop: () => {
      cancelAnimationFrame(defenseFrame);
      clearInterval(hintTimer);
    }
  };

  function showReadyIndicator(): void {
    readyIndicatorEl.classList.remove('show');
    void readyIndicatorEl.offsetWidth;
    readyIndicatorEl.classList.add('show');
    playReady();
  }

  function updateHintState(): void {
    const isMemory = gameModeEl.value === 'memory';
    const available = !hasCompleted && game.typed.length < game.chars.length
      && isMemory && isHintAvailable(lastProgressAt, Date.now());
    hintButtonEl.disabled = !isMemory || hasCompleted || game.chars.length === 0;
    hintButtonEl.classList.toggle('hint-ready', available);
  }

  function renderMemoryLibrary(): void {
    const snapshot = memoryLibrary.read();
    renderPassageList(memoryFavoritesEl, snapshot.favorites);
    renderPassageList(memoryRecentEl, snapshot.recent);
    const id = activePassage ? createPassageId(activePassage) : '';
    const favorite = Boolean(id) && isFavoritePassage(snapshot, id);
    favoritePassageEl.setAttribute('aria-pressed', String(favorite));
    favoritePassageEl.textContent = favorite ? '★ Favorited' : '☆ Favorite';
  }

  function renderPassageList(container: HTMLElement, passages: MemoryPassage[]): void {
    if (!passages.length) {
      renderEmptyState(container, 'No passages yet');
      return;
    }
    container.replaceChildren(...passages.map(passage => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = formatPassageLabel(passage);
      button.addEventListener('click', () => {
        translationEl.value = passage.translation;
        bookEl.value = passage.book;
        populateChapters(passage.chapter);
        void populateVerses().then(() => {
          startVerseEl.value = String(passage.startVerse);
          constrainEndVerses();
          endVerseEl.value = String(passage.endVerse);
          loadBtn.click();
        });
      });
      return button;
    }));
  }
}

function formatPassageLabel(passage: PassageReference): string {
  const verses = passage.startVerse === passage.endVerse
    ? passage.startVerse
    : `${passage.startVerse}–${passage.endVerse}`;
  return `${passage.book} ${passage.chapter}:${verses}`;
}

function renderAnalysis(analysis: ReturnType<typeof analyzeSession>): HTMLElement[] {
  const insights = [
    analysis.difficultWords.length
      ? `<strong>Review:</strong> ${analysis.difficultWords.join(', ')}`
      : '<strong>Clean recall:</strong> no words needed a correction.',
    analysis.strongestWords.length
      ? `<strong>Strong words:</strong> ${analysis.strongestWords.join(', ')}`
      : `<strong>Corrections:</strong> ${analysis.mistakeCount}`,
    analysis.comparison
      ? `<strong>Compared with last session:</strong> ${formatDifference(analysis.comparison.wpmDifference, 'WPM')}, ${formatDifference(analysis.comparison.accuracyDifference, 'accuracy points')}`
      : '<strong>Baseline saved:</strong> your next session will show a comparison.'
  ];
  return insights.map(content => {
    const item = document.createElement('div');
    item.className = 'result-insight';
    item.innerHTML = content;
    return item;
  });
}

function formatDifference(value: number, label: string): string {
  if (value === 0) return `even ${label}`;
  return `${value > 0 ? '+' : ''}${value} ${label}`;
}

function getBookProgressComplete(book: string, progress: CampaignProgress): boolean {
  return createCampaignChunks(book).every(chunk => (progress[chunk.id] ?? 0) > 0);
}
