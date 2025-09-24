import * as PIXI from 'pixi.js';
import { loadAssets } from './assets.js';
import { ScoreUI } from './ScoreUI.js';
import { theme } from './styles/theme.js';
import { WordBox } from './objects/WordBox.js';

export class GameApp {
  constructor() {
    this.app = null;
    this.bunny = null;
    this.score = 0;
    this.scoreUI = new ScoreUI();
  }

  async init() {
    this.app = new PIXI.Application();
    await this.app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      background: theme.colors.background,
    });

    document.body.appendChild(this.app.canvas);

    this.wordBox = new WordBox("Genesis");
    this.wordBox.setPosition(this.app.renderer.width / 2, 100);
    this.app.stage.addChild(this.wordBox);

    window.addEventListener("keydown", (e) => {
      const done = this.wordBox.handleKey(e.key);
      if (done) {
        console.log("Word complete!");
        this.wordBox.reset("Exodus");
      }
    });

    // Handle resizing
    window.addEventListener('resize', () => {
      this.app.renderer.resize(window.innerWidth, window.innerHeight);
      this.resizeGame();
    });

    // // Load assets and create game objects
    // const assets = await loadAssets();

    this.resizeGame();
  }

  onBunnyClick() {
    this.score++;
    this.scoreUI.update(this.score);
    this.bunny.moveToRandom(this.app.screen.width, this.app.screen.height);
  }

  resizeGame() {
    if (this.bunny) {
      this.bunny.center(this.app.screen.width, this.app.screen.height);
    }
  }
}
