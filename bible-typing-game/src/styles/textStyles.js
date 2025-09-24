import { TextStyle } from 'pixi.js';
import { theme } from './theme.js';

export const textStyles = {
  wordTarget: new TextStyle({
    fontFamily: theme.fonts.main,
    fontSize: theme.fonts.headingSize,
    fill: theme.colors.text,
    stroke: theme.colors.stroke,
    strokeThickness: 4,
    align: 'center',
  }),
  wordTyped: new TextStyle({
    fontFamily: theme.fonts.main,
    fontSize: theme.fonts.bodySize,
    fill: theme.colors.highlight,
    align: 'center',
  }),
};