/**
 * 猫图加载
 */
const GameConfig = require('./config');

function createImage() {
  if (typeof wx !== 'undefined' && wx.createImage) return wx.createImage();
  return new Image();
}

const catImages = new Array(GameConfig.maxLevel).fill(null);
let loaded = 0;
let ready = false;
const waiters = [];

function finish() {
  if (loaded < GameConfig.maxLevel) return;
  ready = true;
  waiters.splice(0).forEach((fn) => fn(catImages));
}

function loadAll() {
  return new Promise((resolve) => {
    if (ready) {
      resolve(catImages);
      return;
    }
    waiters.push(resolve);
    if (loaded > 0) return; // 已在加载

    for (let i = 1; i <= GameConfig.maxLevel; i++) {
      const img = createImage();
      const idx = i - 1;
      img.onload = () => {
        catImages[idx] = img;
        loaded++;
        finish();
      };
      img.onerror = () => {
        catImages[idx] = null;
        loaded++;
        finish();
      };
      img.src = `images/cats/cat_${i}.jpeg`;
    }
  });
}

function getCatImage(level) {
  if (level < 1 || level > GameConfig.maxLevel) return null;
  return catImages[level - 1];
}

module.exports = { loadAll, getCatImage, isReady: () => ready };
