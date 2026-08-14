/**
 * 入口：画布、输入、主循环
 * 微信小游戏为主；浏览器可本地预览
 */
const GameConfig = require('./config');
const { Game, State } = require('./game');
const Renderer = require('./renderer');
const assets = require('./assets');
const audio = require('./audio');
const { getDeviceLayout } = require('./device');

const isWx = typeof wx !== 'undefined';

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

/**
 * 输入监听：点按常驻（菜单/结算按钮）；滑动仅对局与排行榜需要。
 * 结算后卸掉 touchmove / mousemove，避免空转。
 */
function createInput(canvas, renderer, game) {
  const down = (sx, sy) => {
    try {
      const p = renderer.screenToDesign(sx, sy);
      const hit = renderer.findHit(p.x, p.y);

      if (game.state === State.RANK) {
        if (hit === 'btn_close_rank') {
          game.closeRank();
          return;
        }
        game.rankPointerStart(p.x, p.y, hit === 'rank_panel' || hit === 'rank_list');
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
        else if (hit === 'tog_gold') game.toggleSetting('goldName');
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
    } finally {
      sync();
    }
  };

  const move = (sx, sy) => {
    const p = renderer.screenToDesign(sx, sy);
    if (game.state === State.RANK) game.rankPointerMove(p.x, p.y);
    else if (game.state === State.PLAYING) game.pointerMove(p.x);
  };

  const up = () => {
    try {
      if (game.state === State.RANK) game.rankPointerEnd();
      else if (game.state === State.PLAYING) game.pointerEnd();
    } finally {
      sync();
    }
  };

  const onDownWx = (e) => {
    const t = touchXY(e);
    if (t) down(t.x, t.y);
  };
  const onMoveWx = (e) => {
    const t = touchXY(e);
    if (t) move(t.x, t.y);
  };
  const onUpWx = () => up();

  const onDownMouse = (e) => {
    canvas._drag = true;
    down(e.clientX, e.clientY);
  };
  const onMoveMouse = (e) => {
    if (canvas._drag) move(e.clientX, e.clientY);
  };
  const onUpMouse = () => {
    if (canvas._drag) {
      canvas._drag = false;
      up();
    }
  };
  const onDownTouch = (e) => {
    e.preventDefault();
    const t = touchXY(e);
    if (t) down(t.x, t.y);
  };
  const onMoveTouch = (e) => {
    e.preventDefault();
    const t = touchXY(e);
    if (t) move(t.x, t.y);
  };
  const onUpTouch = (e) => {
    e.preventDefault();
    up();
  };

  let moveOn = false;

  function bindMove() {
    if (moveOn) return;
    moveOn = true;
    if (isWx) {
      wx.onTouchMove(onMoveWx);
      return;
    }
    window.addEventListener('mousemove', onMoveMouse);
    canvas.addEventListener('touchmove', onMoveTouch, { passive: false });
  }

  function unbindMove() {
    if (!moveOn) return;
    moveOn = false;
    if (isWx) {
      if (wx.offTouchMove) wx.offTouchMove(onMoveWx);
      return;
    }
    window.removeEventListener('mousemove', onMoveMouse);
    canvas.removeEventListener('touchmove', onMoveTouch);
  }

  function needsMove() {
    const s = game.state;
    return s === State.PLAYING || s === State.RANK;
  }

  function sync() {
    if (needsMove()) bindMove();
    else unbindMove();
  }

  if (isWx) {
    wx.onTouchStart(onDownWx);
    wx.onTouchEnd(onUpWx);
    wx.onTouchCancel(onUpWx);
  } else {
    canvas.addEventListener('mousedown', onDownMouse);
    window.addEventListener('mouseup', onUpMouse);
    canvas.addEventListener('touchstart', onDownTouch, { passive: false });
    canvas.addEventListener('touchend', onUpTouch);
    canvas.addEventListener('touchcancel', onUpTouch);
  }

  sync();
  return { sync, unbindMove, isMoveOn: () => moveOn };
}

function boot() {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d');
  const game = new Game();
  const renderer = new Renderer(canvas, ctx);

  const layout = () => {
    const device = getDeviceLayout();
    renderer.resize(device, game);
  };
  layout();
  if (isWx && wx.onWindowResize) wx.onWindowResize(layout);
  else if (typeof window !== 'undefined') window.addEventListener('resize', layout);

  const input = createInput(canvas, renderer, game);
  if (!isWx && typeof window !== 'undefined') {
    window.__game = game;
    window.__renderer = renderer;
    window.__input = input;
  }

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
    input.sync();
    renderer.draw(game, dt);
    raf(tick);
  };
  raf(tick);

  console.log(
    '[MergeSiameseCat] layout',
    GameConfig.designWidth + 'x' + GameConfig.designHeight,
    'safe',
    Math.round(GameConfig.safeTop) + '/' + Math.round(GameConfig.safeBottom),
    'spawn',
    Math.round(GameConfig.spawnY),
    'deadline',
    Math.round(GameConfig.deadlineY),
    'floor',
    Math.round(GameConfig.floorY),
  );
}

boot();
