import { sanitizeText } from './state';
import type { Game } from './state';
import { handleInput } from './input';
import { renderText, updateCaretPosition } from '../ui/renderer';
import { positionReaderAtActiveRange, renderChapterReader } from '../ui/chapter-reader';
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
import type { AppStateRepository } from '../persistence/app-state';
import type { PassageReference } from '../memory/domain/passage.ts';
import type { ProfileRepository } from '../persistence/profile-repository';
import type { AppStorage } from '../persistence/storage';
import { getCurrentWordIndex, getCurrentWordRange, getHintWordIndex, isHintAvailable } from './hint';
import { analyzeSession } from './analysis';
import { BrowserSessionHistoryRepository } from './session-history';
import { selectPracticeStartPassage } from '../memory/domain/practice-library.ts';
import { createPracticeLibraryController } from '../memory/ui/practice-library-controller.ts';
import type { PlaylistCompletion } from '../memory/ui/playlist-controller.ts';
import {
  hiddenPercentForVisibleWords,
  RECALL_VISIBILITY_PRESETS,
  type RecallVisibilityPercent
} from '../memory/domain/visibility.ts';
import {
  createChapterReader,
  nextChapterReaderRange,
  type ChapterReader,
  type ChapterVerse
} from '../typing/chapter-reader';

type Controls = {
  hudEl: HTMLElement; textEl: HTMLElement; chapterReaderEl: HTMLElement;
  inputEl: HTMLInputElement; typedBarEl: HTMLElement;
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
  readyIndicatorEl: HTMLElement; favoritePassageEl: HTMLButtonElement;
  recallPromptEl: HTMLElement;
  memoryLibraryEl: HTMLElement; practiceFavoritesEl: HTMLElement;
  memoryFavoritesEl: HTMLElement; memoryRecentEl: HTMLElement;
  resultAnalysisEl: HTMLElement;
  populateBooks: () => void; populateChapters: (preferred?: number) => void;
  populateVerses: () => Promise<void>; constrainEndVerses: () => void;
  setPickerVerseProgress: (progress: Record<string, number>) => void;
};

export function initGameControllers(
  game: Game,
  controls: Controls,
  stateRepository: AppStateRepository,
  profileRepository: ProfileRepository,
  storage: AppStorage,
  config: AppConfig
) {
  const { hudEl, textEl, chapterReaderEl, inputEl, typedBarEl, translationEl, bookEl, chapterEl,
    startVerseEl, endVerseEl, loadBtn, statusEl, passageTitleEl, resultsEl,
    resultStatsEl, progressFillEl, gameModeEl, challengeBannerEl, typingCardEl,
    rewardMessageEl, levelLabelEl, xpLabelEl, xpFillEl, personalBestEl, lifetimeWpmEl, recentWpmEl,
    defenseGameEl, faithCountEl, fortressHealthEl, waveCountEl, defeatedCountEl,
    battlePathEl, battleMessageEl,
    readyIndicatorEl, favoritePassageEl, recallPromptEl, memoryLibraryEl,
    practiceFavoritesEl, memoryFavoritesEl, memoryRecentEl, resultAnalysisEl,
    populateBooks, populateChapters, populateVerses, constrainEndVerses, setPickerVerseProgress } = controls;
  let hudInterval: number | undefined;
  let hasCompleted = false;
  let defense: DefenseState = createDefenseState();
  let defenseFrame = 0;
  let readerPositionFrame = 0;
  let previousFrame = performance.now();
  let memoryHiddenPercent = 0;
  let activePassage: PassageReference | null = null;
  let lastProgressAt = Date.now();
  let hintTimer = 0;
  let revealedHintWordIndex: number | null = null;
  let revealedHintEnd = -1;
  let promptedHintWordIndex: number | null = null;
  const practiceLibrary = createPracticeLibraryController({
    library: memoryLibraryEl,
    practiceFavorites: practiceFavoritesEl,
    memoryFavorites: memoryFavoritesEl,
    recent: memoryRecentEl,
    favoriteButton: favoritePassageEl
  }, stateRepository, passage => { void loadPassage(passage); });
  const sessionHistory = new BrowserSessionHistoryRepository(storage);
  const defenseView = createDefenseView({
    faith: faithCountEl, fortress: fortressHealthEl, wave: waveCountEl,
    defeated: defeatedCountEl, path: battlePathEl, message: battleMessageEl
  });
  let campaignChunk: CampaignChunk | null = null;
  let campaignHooks: {
    save: (chunk: CampaignChunk, stars: number) => void;
    savePassage: (passage: PassageReference, stars: number) => void;
    progress: () => CampaignProgress;
    celebrateBook: (book: string) => void;
    returnToMenu: (book: string) => void;
    startNext: (chunk: CampaignChunk) => void;
  } | null = null;
  let playlistHooks: {
    complete: (passage: PassageReference) => PlaylistCompletion | null;
    continue: () => void;
    passageChanged: () => void;
  } | null = null;
  let playlistContinuation = false;
  let chapterReader: ChapterReader | null = null;

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
      chapterReader = null;
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
    document.getElementById('playlist-library')?.classList.toggle('is-hidden', mode === 'defense');
    practiceLibrary.setContext(mode, activePassage);
    renderDefense();
    if (chapterReader && mode !== 'defense') {
      updateUI(false);
      queueReaderPosition();
    }
    if (mode === 'defense') void loadRandomDefensePassage();
  }

  function updateUI(updateHud = true) {
    const stats = calculateStats(game);
    if (updateHud) renderStats(hudEl, stats);
    if (chapterReader && gameModeEl.value !== 'defense') {
      renderChapterReader(textEl, chapterReaderEl, chapterReader, game, revealedHintWordIndex, promptedHintWordIndex);
    } else {
      renderText(textEl, game, revealedHintWordIndex, promptedHintWordIndex);
    }
    positionRecallPrompt();
    updateCaretPosition(textEl, game);
    renderTypedBar(typedBarEl, game);
    progressFillEl.style.width = `${stats.progress}%`;
  }

  function focusInput(): void {
    inputEl.focus({ preventScroll: gameModeEl.value === 'defense' });
  }

  function queueReaderPosition(): void {
    cancelAnimationFrame(readerPositionFrame);
    readerPositionFrame = requestAnimationFrame(() => {
      readerPositionFrame = 0;
      if (!chapterReader || gameModeEl.value === 'defense') return;
      positionReaderAtActiveRange(textEl, chapterReaderEl);
      updateCaretPosition(textEl, game);
    });
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
    revealedHintWordIndex = null;
    revealedHintEnd = -1;
    promptedHintWordIndex = null;
    defense = createDefenseState();
    defenseView.reset();
    inputEl.value = '';
    inputEl.disabled = false;
    resultsEl.classList.add('is-hidden');
    document.getElementById('next-passage')?.classList.remove('is-hidden');
    updateUI(false);
    if (chapterReader && gameModeEl.value !== 'defense') {
      queueReaderPosition();
    }
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
    const playlistCompletion = mode === 'memory' && activePassage
      ? playlistHooks?.complete(activePassage) ?? null
      : null;
    playlistContinuation = Boolean(playlistCompletion);
    const resultsTitle = document.getElementById('results-title');
    const resultsCopy = document.getElementById('results-copy');
    const nextButton = document.getElementById('next-passage');
    const chapterSelectButton = document.getElementById('chapter-select');
    const canContinuePassage = !campaignChunk && !playlistCompletion && activePassage
      && (mode === 'practice' || mode === 'memory')
      && nextChapterReaderRange(
        activePassage,
        getVerseCount(activePassage.book, activePassage.chapter),
        followingChapter(activePassage.book, activePassage.chapter)
      );
    if (resultsTitle) resultsTitle.textContent = campaignChunk ? 'Journey passage complete' : mode === 'defense' ? 'Arcade complete' : 'Passage complete';
    if (resultsCopy) {
      resultsCopy.textContent = playlistCompletion?.completedCycle
        ? 'Playlist complete. Your next round will begin at the first passage.'
        : mode === 'defense'
          ? 'The shadows were repelled.'
          : mode === 'memory' ? 'You practiced with less text on screen.' : '';
    }
    if (chapterSelectButton) chapterSelectButton.textContent = campaignChunk ? 'Back to selection' : 'Back to passage select';
    if (nextButton) {
      nextButton.textContent = playlistCompletion?.completedCycle
        ? 'Start playlist again'
        : playlistCompletion ? 'Next playlist passage' : canContinuePassage ? 'Continue' : 'Choose another';
      nextButton.classList.toggle('is-hidden', !campaignChunk && !playlistCompletion && !canContinuePassage);
    }
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
      updatePickerVerseProgress();
    } else if (activePassage && mode !== 'defense' && campaignHooks) {
      campaignHooks.savePassage(activePassage, Math.max(1, starsForWpm(stats.wpm, stats.accuracy)));
      updatePickerVerseProgress();
    }
    resultsEl.classList.remove('is-hidden');
    playComplete();
    sessionHistory.save(stats);
    recordSession(stats.wpm, earnedXp, profileRepository);
    updateProfile();
  }

  inputEl.addEventListener('input', () => {
    const mode = gameModeEl.value;
    const hadStarted = Boolean(game.startTime);
    const previousLength = game.typed.length;
    handleInput(game, inputEl.value);
    if (game.typed.length >= revealedHintEnd) {
      revealedHintWordIndex = null;
      revealedHintEnd = -1;
    }
    if (!campaignChunk && (mode === 'practice' || mode === 'memory') &&
      !hadStarted && game.startTime && activePassage) {
      practiceLibrary.recordStarted(activePassage);
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
    if (game.typed.length !== previousLength) promptedHintWordIndex = null;
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
    if (playlistContinuation && playlistHooks) {
      playlistContinuation = false;
      playlistHooks.continue();
      resultsEl.classList.add('is-hidden');
      return;
    }
    if ((gameModeEl.value === 'practice' || gameModeEl.value === 'memory') && activePassage) {
      const continuation = nextChapterReaderRange(
        activePassage,
        getVerseCount(activePassage.book, activePassage.chapter),
        followingChapter(activePassage.book, activePassage.chapter)
      );
      if (continuation) {
        resultsEl.classList.add('is-hidden');
        void loadPassage(continuation);
        return;
      }
    }
    resultsEl.classList.add('is-hidden');
    document.querySelector('.passage-panel')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('focus-button')?.addEventListener('click', () => {
    document.getElementById('game-screen')?.classList.toggle('focus-mode');
  });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey && event.key.toLowerCase() === 'h' && gameModeEl.value === 'memory') {
      event.preventDefault();
      revealNextWord();
    }
  });
  loadBtn.addEventListener('click', () => {
    void loadSelectedPassage();
  });

  async function loadSelectedPassage(): Promise<boolean> {
    const start = Number(startVerseEl.value);
    const end = Math.max(start, Number(endVerseEl.value));
    return loadChapterPassage({
      book: bookEl.value,
      chapter: Number(chapterEl.value),
      startVerse: start,
      endVerse: end,
      translation: translationEl.value
    });
  }

  async function loadChapterPassage(passage: PassageReference): Promise<boolean> {
    loadBtn.disabled = true;
    statusEl.textContent = 'Loading your passage...';
    try {
      let data: { verses?: Array<{ text: string; verse?: number }> };
      try {
        data = await fetchChapter(passage.book, passage.chapter, passage.translation, false);
      } catch {
        throw new Error(`${translationEl.options[translationEl.selectedIndex].text} is not available from the current Bible provider.`);
      }
      const verses: ChapterVerse[] = (data.verses ?? []).map((verse, index) => ({
        verse: verse.verse ?? index + 1,
        text: verse.text
      }));
      chapterReader = createChapterReader(verses, passage);
      game.text = chapterReader.activeText;
      game.chars = game.text.split('');
      activePassage = { ...passage };
      passageTitleEl.textContent = `${passage.book} ${passage.chapter}:${passage.startVerse}${passage.endVerse > passage.startVerse ? `–${passage.endVerse}` : ''}`;
      statusEl.textContent = '';
      playlistContinuation = false;
      restartGame();
      practiceLibrary.setContext(parseGameMode(gameModeEl.value), activePassage);
      updatePickerVerseProgress();
      playlistHooks?.passageChanged();
      return true;
    } catch (error) {
      console.error(error);
      statusEl.textContent = 'We could not load that passage. Please try again.';
      return false;
    } finally {
      loadBtn.disabled = false;
    }
  }

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
  document.querySelectorAll<HTMLButtonElement>('[data-text-visibility]').forEach(button => {
    button.addEventListener('click', () => {
      const visiblePercent = Number(button.dataset.textVisibility);
      if (!RECALL_VISIBILITY_PRESETS.some(preset => preset.visiblePercent === visiblePercent)) return;
      setTextVisibility(visiblePercent as RecallVisibilityPercent);
    });
  });
  function setTextVisibility(visiblePercent: RecallVisibilityPercent): void {
    memoryHiddenPercent = hiddenPercentForVisibleWords(visiblePercent);
    typingCardEl.style.setProperty('--memory-hidden-percent', String(memoryHiddenPercent));
    document.querySelectorAll<HTMLButtonElement>('[data-text-visibility]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.textVisibility) === visiblePercent));
    });
    gameModeEl.value = memoryHiddenPercent ? 'memory' : 'practice';
    gameModeEl.dispatchEvent(new Event('change'));
    updateUI();
  }
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
  void loadPassage(selectPracticeStartPassage(stateRepository.readRecentPassages()));
  hintTimer = window.setInterval(updateHintState, 250);

  return {
    restartGame,
    startCampaignChunk: (chunk: CampaignChunk, verses: ChapterVerse[]) => {
      campaignChunk = chunk;
      chapterReader = createChapterReader(verses, chunk);
      game.text = chapterReader.activeText;
      game.chars = game.text.split('');
      passageTitleEl.textContent = `${chunk.book} ${chunk.chapter}:${chunk.startVerse}${chunk.endVerse > chunk.startVerse ? `–${chunk.endVerse}` : ''}`;
      activePassage = { book: chunk.book, chapter: chunk.chapter, startVerse: chunk.startVerse, endVerse: chunk.endVerse, translation: 'kjv' };
      gameModeEl.value = 'practice';
      setMode();
      restartGame();
    },
    setCampaignHooks: (hooks: NonNullable<typeof campaignHooks>) => {
      campaignHooks = hooks;
      updatePickerVerseProgress();
    },
    setPlaylistHooks: (hooks: NonNullable<typeof playlistHooks>) => { playlistHooks = hooks; },
    setTextVisibility,
    getActivePassage: (): PassageReference | null => activePassage ? { ...activePassage } : null,
    loadPassage,
    showPracticeReader: () => {
      if (chapterReader && gameModeEl.value !== 'defense') queueReaderPosition();
    },
    leaveCampaign: () => { campaignChunk = null; },
    stop: () => {
      cancelAnimationFrame(defenseFrame);
      cancelAnimationFrame(readerPositionFrame);
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
    const nextPromptedWordIndex = available
      ? getHintWordIndex(game.text, game.typed.length, revealedHintWordIndex)
      : null;
    if (promptedHintWordIndex !== nextPromptedWordIndex) {
      promptedHintWordIndex = nextPromptedWordIndex;
      updateUI(false);
    }
  }

  function positionRecallPrompt(): void {
    const hintTarget = promptedHintWordIndex === null
      ? null
      : textEl.querySelector<HTMLElement>('.hint-target');
    recallPromptEl.classList.toggle('is-hidden', !hintTarget);
    if (hintTarget && recallPromptEl.parentElement !== hintTarget) hintTarget.appendChild(recallPromptEl);
  }

  function updatePickerVerseProgress(): void {
    setPickerVerseProgress(campaignHooks?.progress() ?? {});
  }

  function revealNextWord(): void {
    if (gameModeEl.value !== 'memory' || hasCompleted || game.typed.length >= game.chars.length) return;
    const range = getCurrentWordRange(game.text, game.typed.length);
    revealedHintWordIndex = getCurrentWordIndex(game.text, game.typed.length);
    revealedHintEnd = range.end;
    promptedHintWordIndex = null;
    lastProgressAt = Date.now();
    recallPromptEl.classList.add('is-hidden');
    updateUI();
    focusInput();
  }

  async function loadPassage(passage: PassageReference): Promise<boolean> {
    translationEl.value = passage.translation;
    bookEl.value = passage.book;
    populateChapters(passage.chapter);
    await populateVerses();
    startVerseEl.value = String(passage.startVerse);
    constrainEndVerses();
    endVerseEl.value = String(passage.endVerse);
    return loadSelectedPassage();
  }
}

function followingChapter(book: string, chapter: number): { book: string; chapter: number; verseCount: number } | null {
  if (chapter < getChapterCount(book)) {
    const nextChapter = chapter + 1;
    return { book, chapter: nextChapter, verseCount: getVerseCount(book, nextChapter) };
  }
  const nextBook = BOOKS[BOOKS.indexOf(book) + 1];
  if (!nextBook) return null;
  return { book: nextBook, chapter: 1, verseCount: getVerseCount(nextBook, 1) };
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
