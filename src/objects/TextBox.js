import { Container, Text } from 'pixi.js';
import { textStyles } from '../styles/TextStyles.js';

export class TextBox extends Container {
  constructor(passage) {
    super();

    this.passage = passage;
    passageArray = passage.split(" ");
    passageIndex = 0;

    targetWord = passageArray[passageIndex];
    typedWord = "";

    // Target word
    targetText = TextFactory.create(targetWord, textStyles.wordTarget, { y: -30 });
    this.addChild(targetText);

    // Typed word
    typedText = TextFactory.create("", textStyles.wordTyped, { y: 30 });
    this.addChild(typedText);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  reset(word) {
    targetWord = word;
    typedWord = "";
    targetText.text = word;
    typedText.text = "";
  }

  handleKey(key) {
    if (key === "Backspace") {
      this.typedWord = this.typedWord.slice(0, -1);
    } else if (key.length === 1) {
      this.typedWord += key;
    }

    this.typedText.text = this.typedWord;

    // Check if current "word" (or space) is complete
    if (this.typedWord === this.targetWord) {
      this.passageIndex++;

      if (this.passageIndex < this.passageArray.length) {
        this.targetWord = this.passageArray[this.passageIndex];
        this.targetText.text = this.targetWord.replace(/\s/g, '␣'); // optional visual space
        this.typedWord = "";
        this.typedText.text = "";
      } else {
        this.targetText.text = "✅";
        this.typedText.text = "";
      }

      return true;
    }

    return false;
  }
}
