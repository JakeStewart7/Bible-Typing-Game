export function renderStats(container, stats, onRestart) {
  container.innerHTML = `
    <div>⏱ ${stats.time}s</div>
    <div>⚡ ${stats.wpm} WPM</div>
    <div>🎯 ${stats.accuracy}%</div>
    <div>📈 ${stats.progress}%</div>
    <button id="restart">Restart</button>
  `;

  document.getElementById("restart").addEventListener("click", onRestart);
}
