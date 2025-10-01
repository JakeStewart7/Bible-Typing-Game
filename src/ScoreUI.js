export class ScoreUI {
  constructor() {
    this.scoreDiv = document.getElementById('score');
  }

  update(score) {
    if (this.scoreDiv) {
      this.scoreDiv.textContent = `Score: ${score}`;
    }
  }
}
