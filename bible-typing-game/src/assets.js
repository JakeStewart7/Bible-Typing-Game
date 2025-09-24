import * as PIXI from 'pixi.js';

export async function loadAssets() {
  const bunnyTexture = await PIXI.Assets.load('https://pixijs.io/examples/examples/assets/bunny.png');
  return { bunnyTexture };
}
