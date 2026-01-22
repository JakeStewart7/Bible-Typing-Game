import "./styles/main.css";
import { createGame } from "./game/engine.js";
import { handleInput } from "./game/input.js";
import { renderText } from "./ui/renderer.js";
import { renderStats } from "./ui/hud.js";
import { calculateStats } from "./game/stats.js";

// ----------------------------
// DOM setup
// ----------------------------
const app = document.getElementById("app");
app.innerHTML = `
  <div class="game">
    <div id="hud" class="hud"></div>
    <div id="text" class="text-display"></div>
    <input id="input" autocomplete="off" />
  </div>
`;

const hudEl = document.getElementById("hud");
const textEl = document.getElementById("text");
const inputEl = document.getElementById("input");

// ----------------------------
// Game state
// ----------------------------
export const game = createGame(
  "Typing games help improve speed and accuracy through practice and focus."
);

// ----------------------------
// Restart
// ----------------------------
export function restartGame() {
  game.typed = [];
  game.errors = 0;
  game.startTime = null;

  inputEl.value = "";
  inputEl.disabled = false;

  renderText(textEl, game);
  renderStats(hudEl, calculateStats(game), restartGame);

  startHUDUpdates();
  inputEl.focus();
}

// ----------------------------
// Input handling
// ----------------------------
inputEl.addEventListener("input", () => {
  handleInput(game, inputEl.value);
  renderText(textEl, game);

  // Always reflect typed letters
  inputEl.value = game.typed.join("");

  // Disable input only if everything is correct
  const allCorrect = game.typed.join("") === game.chars.join("");
  inputEl.disabled = allCorrect;
});

// ----------------------------
// HUD live updates
// ----------------------------
let hudInterval;

export function startHUDUpdates() {
  clearInterval(hudInterval);
  hudInterval = setInterval(() => {
    renderStats(hudEl, calculateStats(game), restartGame);

    if (game.typed.join("") === game.chars.join("")) {
      clearInterval(hudInterval);
    }
  }, 100);
}

// ----------------------------
// Initial render
// ----------------------------
renderText(textEl, game);
renderStats(hudEl, calculateStats(game), restartGame);
startHUDUpdates();

// Auto-focus
document.addEventListener("click", () => inputEl.focus());
inputEl.focus();

