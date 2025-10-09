import * as PIXI from 'pixi.js';
import { ScoreUI } from './ScoreUI.js';
import { theme } from './styles/Theme.js';
import { TextBox } from './objects/TextBox.js';

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
        backgroundColor: theme.colors.background,
    });

    document.body.appendChild(this.app.canvas);

    this.textBox = new TextBox("Genesis is the first book of the Bible.");
    this.textBox.setPosition(this.app.renderer.width / 2, 100);
    this.app.stage.addChild(this.textBox);

    window.addEventListener("keydown", (e) => {
      const done = this.textBox.handleKey(e);
      if (done) {
        console.log("Word complete!");
        this.textBox.set("Exodus is the second book of the Bible.");
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
