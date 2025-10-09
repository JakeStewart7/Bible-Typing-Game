import { Container, Text } from 'pixi.js';
import { textStyles } from '../styles/TextStyles.js';
import { TextFactory } from './TextFactory.js';

export class TextBox extends Container {

  constructor(passage) {
    super();

    this.passageArray = passage.split(" ");
    this.passageIndex = 0;

    this.targetWord = this.passageArray[this.passageIndex];
    this.typedWord = "";

    this.targetText = TextFactory.create(passage, textStyles.wordTarget, { y: -30 });
    this.addChild(this.targetText);

    this.typedText = TextFactory.create("", textStyles.wordTyped, { y: 30 });
    this.addChild(this.typedText);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  set(passage) {
    this.passageArray = passage.split(" ");
    this.passageIndex = 0;

    this.targetWord = this.passageArray[this.passageIndex];
    this.typedWord = "";

    this.targetText.text = passage;
    this.typedText.text = "";
  }

  handleKey(e) {
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey; // ctrl (Windows/Linux) or cmd (Mac)

    if (key === "Backspace") {
      if (ctrl) {
        // Delete the last "word" from typedWord
        // Match last sequence of non-space characters
        this.typedWord = this.typedWord.replace(/\S+$/g, '');
      } else {
        // Remove last character
        this.typedWord = this.typedWord.slice(0, -1);
      }
    } else if (key.length === 1) {
      // Add typed character
      this.typedWord += key;
    }

    this.typedText.text = this.typedWord;

    if (this.typedWord === this.targetWord) {
      this.passageIndex++;

      if (this.passageIndex < this.passageArray.length) {
        this.targetWord = this.passageArray[this.passageIndex];
        this.targetText.text = this.targetWord.replace(/\s/g, '␣');
        this.typedWord = "";
        this.typedText.text = "";
      } else {
        this.targetText.text = "✅";
        this.typedText.text = "";
        return true; // Passage complete
      }
    }

    return false;
  }
}
