import { Container, Text } from 'pixi.js';
import { textStyles } from '../styles/textStyles.js';

export class WordBox extends Container {
  constructor(word) {
    super();

    this.targetWord = word;
    this.typedWord = "";

    // Target word
    this.targetText = new Text({
      text: word,
      style: textStyles.wordTarget,
    });
    this.targetText.anchor.set(0.5);
    this.targetText.y = -30;
    this.addChild(this.targetText);

    // Typed word
    this.typedText = new Text({
      text: "",
      style: textStyles.wordTyped,
    });
    this.typedText.anchor.set(0.5);
    this.typedText.y = 30;
    this.addChild(this.typedText);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  reset(word) {
    this.targetWord = word;
    this.typedWord = "";
    this.targetText.text = word;
    this.typedText.text = "";
  }

  handleKey(key) {
    if (key === "Backspace") {
      // remove last character
      this.typedWord = this.typedWord.slice(0, -1);
    } else if (key.length === 1) {
      // add typed character
      this.typedWord += key;
    }

    // Update display text
    this.typedText.text = this.typedWord;

    // Check for completion
    return this.typedWord === this.targetWord;
  }
}
