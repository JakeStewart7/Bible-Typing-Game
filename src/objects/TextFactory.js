import { Text } from 'pixi.js';

export class TextFactory {
  static create(content, style, options = {}) {
    const text = new Text(content, style);

    // Set anchor defaults
    text.anchor?.set(options.anchorX ?? 0.5, options.anchorY ?? 0.5);

    if (options.x !== undefined) text.x = options.x;
    if (options.y !== undefined) text.y = options.y;

    return text;
  }
}
