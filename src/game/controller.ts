import { Game, sanitizeText } from './state';
import { handleInput } from './input';
import { renderText, updateCaretPosition } from '../ui/renderer';
import { renderTypedBar } from '../ui/typedBar';
import { renderStats } from '../ui/hud';
import { calculateStats } from './stats';
import { fetchChapter, fetchRange } from '../bible-api';
import { playComplete, playKey } from '../audio/effects';
import { advanceEnemy, buyUpgrade, completeDefense, createDefenseState, DefenseState, typeCharacter, upgradeCost, UpgradeId } from './minigame';

type Controls = {
  hudEl: HTMLElement; textEl: HTMLElement; inputEl: HTMLInputElement; typedBarEl: HTMLElement;
  translationEl: HTMLSelectElement; bookEl: HTMLSelectElement; chapterEl: HTMLSelectElement;
  startVerseEl: HTMLSelectElement; endVerseEl: HTMLSelectElement; loadBtn: HTMLButtonElement;
  statusEl: HTMLElement; passageTitleEl: HTMLElement; resultsEl: HTMLElement;
  resultStatsEl: HTMLElement; progressFillEl: HTMLElement;
  gameModeEl: HTMLSelectElement; challengeBannerEl: HTMLElement; typingCardEl: HTMLElement;
  rewardMessageEl: HTMLElement; streakEl: HTMLElement; levelLabelEl: HTMLElement;
  xpLabelEl: HTMLElement; xpFillEl: HTMLElement; personalBestEl: HTMLElement;
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
    rewardMessageEl, streakEl, levelLabelEl, xpLabelEl, xpFillEl, personalBestEl,
    defenseGameEl, faithCountEl, fortressHealthEl, waveCountEl, defeatedCountEl,
    battlePathEl, battleMessageEl,
    populateBooks, populateChapters, populateVerses, constrainEndVerses } = controls;
  let hudInterval: number | undefined;
  let hasCompleted = false;
  let sprintTimeout: number | undefined;
  let defense: DefenseState = createDefenseState();
  let defenseFrame = 0;
  let previousFrame = performance.now();
  let defenseTimer = 0;
  const enemyElements = new Map<number, HTMLElement>();
  const projectileElements = new Map<number, HTMLElement>();

  function renderDefense() {
    faithCountEl.textContent = String(defense.faith);
    fortressHealthEl.textContent = String(defense.fortress);
    waveCountEl.textContent = String(defense.wave);
    defeatedCountEl.textContent = String(defense.enemiesDefeated);
    const path = battlePathEl;
    const activeEnemyIds = new Set(defense.enemies.map(enemy => enemy.id));
    const activeProjectileIds = new Set(defense.projectiles.map(projectile => projectile.id));
    enemyElements.forEach((element, id) => {
      if (!activeEnemyIds.has(id)) {
        element.remove();
        enemyElements.delete(id);
      }
    });
    projectileElements.forEach((element, id) => {
      if (!activeProjectileIds.has(id)) {
        element.remove();
        projectileElements.delete(id);
      }
    });
    defense.enemies.forEach(enemy => {
      let element = enemyElements.get(enemy.id);
      if (!element) {
        element = document.createElement('div');
        element.className = 'enemy';
        element.innerHTML = '<span>☁</span><div class="enemy-health"><i></i></div>';
        path.appendChild(element);
        enemyElements.set(enemy.id, element);
      }
      element.style.left = `${enemy.position}%`;
      element.style.bottom = `${18 + ((enemy.id % 3) - 1) * 2}px`;
      const health = element.querySelector<HTMLElement>('.enemy-health i');
      if (health) health.style.width = `${enemy.health / enemy.maxHealth * 100}%`;
    });
    defense.projectiles.forEach(projectile => {
      let element = projectileElements.get(projectile.id);
      if (!element) {
        element = document.createElement('i');
        element.className = 'light-projectile';
        path.appendChild(element);
        projectileElements.set(projectile.id, element);
      }
      element.style.left = `${projectile.position}%`;
      const travel = 94 - projectile.position;
      element.style.bottom = `${30 + travel * Math.tan(projectile.angle * Math.PI / 180) * .22}px`;
      element.style.transform = `translateX(-50%) rotate(${180 - projectile.angle}deg)`;
    });
    document.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(button => {
      const id = button.dataset.upgrade as UpgradeId;
      const level = defense[`${id}Level` as 'powerLevel' | 'wardLevel' | 'slowLevel'];
      const cost = upgradeCost(defense, id);
      button.disabled = defense.faith < cost || defense.status !== 'playing';
      button.querySelector(`[data-cost="${id}"]`)!.textContent = String(cost);
      button.querySelector(`[data-level="${id}"]`)!.textContent = `Lv ${level}`;
    });
    if (defense.status === 'lost') battleMessageEl.textContent = 'The fortress fell. Restart the passage to rally again!';
    else if (defense.status === 'won') battleMessageEl.textContent = 'Victory! The Word held the line.';
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
    const xp = Number(localStorage.getItem('verseTypeXp') || 0);
    const level = Math.floor(xp / 500) + 1;
    const streak = Number(localStorage.getItem('verseTypeStreak') || 0);
    levelLabelEl.textContent = `Level ${level}`;
    xpLabelEl.textContent = `${xp} XP`;
    xpFillEl.style.width = `${(xp % 500) / 5}%`;
    personalBestEl.textContent = `Personal best: ${localStorage.getItem('verseTypeBest') || 0} WPM`;
    streakEl.textContent = `${streak} day${streak === 1 ? '' : 's'} streak`;
  }

  function setMode() {
    const mode = gameModeEl.value;
    typingCardEl.dataset.mode = mode;
    const labels: Record<string, string> = {
      practice: '🌿 Relaxed practice',
      precision: '🎯 Precision mode: mistakes glow red while you keep moving',
      sprint: '⚡ Sprint mode: finish before the clock hits 1:00',
      memory: '🧠 Memory mode: completed words fade away'
      ,defense: '🛡 Scripture Defense: type to repel the advancing shadows'
    };
    challengeBannerEl.textContent = labels[mode];
    defenseGameEl.classList.toggle('is-hidden', mode !== 'defense');
    renderDefense();
  }

  function updateUI() {
    const stats = calculateStats(game);
    renderStats(hudEl, stats);
    renderText(textEl, game);
    updateCaretPosition(textEl, game);
    renderTypedBar(typedBarEl, game);
    progressFillEl.style.width = `${stats.progress}%`;
  }

  function restartGame() {
    game.typed = [];
    game.errors = 0;
    game.startTime = null;
    game.completedAt = undefined;
    hasCompleted = false;
    defense = createDefenseState();
    enemyElements.forEach(element => element.remove());
    projectileElements.forEach(element => element.remove());
    enemyElements.clear();
    projectileElements.clear();
    window.clearTimeout(sprintTimeout);
    inputEl.value = '';
    inputEl.disabled = false;
    resultsEl.classList.add('is-hidden');
    updateUI();
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
    updateUI();
    resultStatsEl.innerHTML = [
      [`${stats.wpm}`, 'WPM'],
      [`${stats.accuracy}%`, 'Accuracy'],
      [`${stats.time}s`, 'Time']
    ].map(([value, label]) => `<div class="result-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
    const modeBonus: Record<string, number> = { practice: 1, precision: 1.4, sprint: 1.6, memory: 1.8, defense: 2 };
    const earnedXp = Math.max(25, Math.round((stats.wpm + stats.accuracy + game.text.length / 10) * modeBonus[gameModeEl.value]));
    localStorage.setItem('verseTypeXp', String(Number(localStorage.getItem('verseTypeXp') || 0) + earnedXp));
    rewardMessageEl.textContent = `✦ +${earnedXp} XP · ${gameModeEl.options[gameModeEl.selectedIndex].text.split(' — ')[0]} completed`;
    resultsEl.classList.remove('is-hidden');
    playComplete();
    const best = Number(localStorage.getItem('verseTypeBest') || 0);
    if (stats.wpm > best) localStorage.setItem('verseTypeBest', String(stats.wpm));
    const today = new Date();
    const previous = localStorage.getItem('verseTypeLastPlayed');
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const currentStreak = Number(localStorage.getItem('verseTypeStreak') || 0);
    if (previous !== today.toDateString()) {
      localStorage.setItem('verseTypeStreak', String(previous === yesterday.toDateString() ? currentStreak + 1 : 1));
    }
    localStorage.setItem('verseTypeLastPlayed', today.toDateString());
    updateProfile();
  }

  inputEl.addEventListener('input', () => {
    const mode = gameModeEl.value;
    if (!game.startTime && mode === 'sprint') {
      sprintTimeout = window.setTimeout(() => {
        if (!hasCompleted) {
          statusEl.textContent = 'Time is up! Restart and try to beat the minute.';
          inputEl.disabled = true;
        }
      }, 60_000);
    }
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
  document.getElementById('try-again')?.addEventListener('click', restartGame);
  document.getElementById('next-passage')?.addEventListener('click', () => {
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
    stop: () => {
      cancelAnimationFrame(defenseFrame);
      clearInterval(defenseTimer);
    }
  };
}
