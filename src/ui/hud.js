export function renderStats(container, stats, onRestart) {
  container.innerHTML = `
    <div class="stats-left">
      <div class="stat-big">${stats.wpm}</div>
      <div class="stat-label">WPM</div>
    </div>
    <div class="stats-middle">
      <div class="stat-item">Accuracy <span class="badge">${stats.accuracy}%</span></div>
      <div class="stat-item">Progress <span class="badge muted">${stats.progress}%</span></div>
    </div>
    <div class="stats-right">
      <div class="time">⏱ ${stats.time}s</div>
      <button id="restart" class="btn small">Restart</button>
    </div>
  `;

  document.getElementById("restart").addEventListener("click", onRestart);
}
