/**
 * 入口：画布、输入、主循环
 * 微信小游戏为主；浏览器可本地预览
 */
const GameConfig = require('./config');
const { Game, State } = require('./game');
const Renderer = require('./renderer');
const assets = require('./assets');
const audio = require('./audio');

const isWx = typeof wx !== 'undefined';

function getSystemInfo() {
  if (isWx && wx.getSystemInfoSync) return wx.getSystemInfoSync();
  return {
    windowWidth: window.innerWidth || 375,
    windowHeight: window.innerHeight || 667,
    pixelRatio: window.devicePixelRatio || 2,
  };
}

function createCanvas() {
  if (isWx && wx.createCanvas) return wx.createCanvas();
  let c = document.getElementById('game');
  if (!c) {
    c = document.createElement('canvas');
    c.id = 'game';
    Object.assign(document.body.style, {
      margin: '0',
      background: '#3a2a24',
      overflow: 'hidden',
    });
    document.body.appendChild(c);
  }
  return c;
}

function touchXY(e) {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!t) return null;
  // 微信：clientX/Y 为显示区域坐标
  return { x: t.clientX, y: t.clientY };
}

function bindInput(canvas, renderer, game) {
  const down = (sx, sy) => {
    const p = renderer.screenToDesign(sx, sy);
    const hit = renderer.findHit(p.x, p.y);

    if (game.state === State.RANK) {
      if (hit === 'btn_close_rank') {
        game.closeRank();
        return;
      }
      game.rankPointerStart(p.y, hit === 'rank_panel' || hit === 'rank_list');
      return;
    }

    if (game.state === State.GUIDE) {
      if (hit === 'btn_guide_next') game.guideNext();
      else if (hit === 'btn_guide_prev') game.guidePrev();
      else if (hit === 'btn_guide_skip') game.closeGuide(false);
      return;
    }

    if (game.state === State.SETTINGS) {
      if (hit === 'btn_settings_close') game.closeSettings();
      else if (hit === 'tog_vibrate') game.toggleSetting('vibrate');
      else if (hit === 'tog_sound') game.toggleSetting('sound');
      return;
    }

    audio.unlock();

    if (hit === 'btn_start') game.startPlay();
    else if (hit === 'btn_restart') game.restart();
    else if (hit === 'btn_home') game.goHome();
    else if (hit === 'btn_rank') game.openRank();
    else if (hit === 'btn_close_rank') game.closeRank();
    else if (hit === 'btn_help') game.openGuide({ from: State.READY, startAfter: false });
    else if (hit === 'btn_settings') game.openSettings(State.READY);
    else if (hit === 'btn_settings_hud') game.openSettings(State.PLAYING);
    else if (game.state === State.PLAYING) game.pointerStart(p.x);
  };

  const move = (sx, sy) => {
    const p = renderer.screenToDesign(sx, sy);
    if (game.state === State.RANK) game.rankPointerMove(p.y);
    else if (game.state === State.PLAYING) game.pointerMove(p.x);
  };

  const up = () => {
    if (game.state === State.RANK) game.rankPointerEnd();
    else if (game.state === State.PLAYING) game.pointerEnd();
  };

  if (isWx) {
    wx.onTouchStart((e) => {
      const t = touchXY(e);
      if (t) down(t.x, t.y);
    });
    wx.onTouchMove((e) => {
      const t = touchXY(e);
      if (t) move(t.x, t.y);
    });
    wx.onTouchEnd(up);
    wx.onTouchCancel(up);
    return;
  }

  // 浏览器预览
  canvas.addEventListener('mousedown', (e) => {
    canvas._drag = true;
    down(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => {
    if (canvas._drag) move(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (canvas._drag) {
      canvas._drag = false;
      up();
    }
  });
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = touchXY(e);
    if (t) down(t.x, t.y);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = touchXY(e);
    if (t) move(t.x, t.y);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    up();
  });
}

function boot() {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d');
  const game = new Game();
  const renderer = new Renderer(canvas, ctx);

  const layout = () => {
    const info = getSystemInfo();
    renderer.resize(info.windowWidth, info.windowHeight, info.pixelRatio || 2);
  };
  layout();
  if (isWx && wx.onWindowResize) wx.onWindowResize(layout);
  else if (typeof window !== 'undefined') window.addEventListener('resize', layout);

  bindInput(canvas, renderer, game);

  assets.loadAll().then(() => {
    if (game.state === State.LOADING) game.goReady();
  });
  setTimeout(() => {
    if (game.state === State.LOADING) game.goReady();
  }, 3000);

  let last = Date.now();
  const raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (fn) => setTimeout(fn, 16);

  const tick = () => {
    const now = Date.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    game.update(dt);
    renderer.draw(game, dt);
    raf(tick);
  };
  raf(tick);

  console.log('[MergeSiameseCat]', GameConfig.designWidth, 'x', GameConfig.designHeight);
}

boot();
