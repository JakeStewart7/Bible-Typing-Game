import { theme } from './Theme.js';

export const textStyles = {
  wordTarget: {
    fontFamily: theme.fonts.main,
    fontSize: theme.fonts.headingSize,
    fill: theme.colors.text,
    align: 'center',
    stroke: {
      color: theme.colors.stroke,
      width: 4,
    },
  },
  wordTyped: {
    fontFamily: theme.fonts.main,
    fontSize: theme.fonts.bodySize,
    fill: theme.colors.highlight,
    align: 'center',
  },
};