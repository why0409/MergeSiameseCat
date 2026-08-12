/**
 * 核心玩法状态机
 */
const GameConfig = require('./config');
const { PhysicsWorld, createBody, recomputeInvMass } = require('./physics');
const storage = require('./storage');
const audio = require('./audio');

const State = {
  LOADING: 'loading',
  READY: 'ready',
  GUIDE: 'guide',
  SETTINGS: 'settings',
  PLAYING: 'playing',
  GAMEOVER: 'gameover',
  RANK: 'rank',
};

/** 玩法指引页（文案 + 简易图示 id） */
const GUIDE_PAGES = [
  {
    title: '左右移动',
    desc: '按住屏幕左右拖动，顶部的猫会跟着你移动。',
    icon: 'drag',
  },
  {
    title: '松手放下',
    desc: '松手后猫咪下落；稍等片刻会出现下一只。',
    icon: 'drop',
  },
  {
    title: '相同合成',
    desc: '两个相同等级的猫碰到一起，会合成更高一级！',
    icon: 'merge',
  },
  {
    title: '注意危险线',
    desc: '堆太高停在红色危险线附近，停留片刻就会结束本局。',
    icon: 'danger',
  },
];

const RANK_LOGIC_W = 540;
const RANK_LOGIC_H = 800;

function radiusOf(level) {
  return GameConfig.radii[level - 1] || 30;
}

class Game {
  constructor() {
    this.state = State.LOADING;
    this.world = new PhysicsWorld();
    this.score = 0;
    this.highScore = storage.getHighScore();
    this.combo = 0;
    this.comboTimer = 0;
    this.held = null;
    this.cooldown = 0;
    this.targetX = GameConfig.designWidth / 2;
    this.deadlineTimer = 0;
    this.deadlineFlash = 0;
    this.particles = [];
    this.toast = null;
    this.toastT = 0;
    this.pointerDown = false;
    this.prevStateBeforeRank = State.READY;
    this.finalScore = 0;
    this.rankScrollY = 0;
    this._rankScrolling = false;
    this._rankLastY = 0;
    /** 指引当前页 0..n-1 */
    this.guidePage = 0;
    /** 打开指引前的状态，关闭后回去 */
    this._guideReturnState = State.READY;
    /** 首次指引结束后是否直接开局 */
    this._guideStartAfter = false;
    /** 首局局内提示（拖/放） */
    this.playTip = '';
    this.playTipT = 0;
    this._tipDropDone = false;
    this._tipMergeDone = false;
    this.settings = storage.getSettings();
    this._settingsReturn = State.READY;
    audio.setEnabled(this.settings.sound);

    storage.bindOnHide(() => this.highScore);
  }

  resetMatch() {
    this.world.clear();
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.held = null;
    this.cooldown = 0;
    this.deadlineTimer = 0;
    this.deadlineFlash = 0;
    this.particles = [];
    this.targetX = GameConfig.designWidth / 2;
    this.pointerDown = false;
  }

  goReady() {
    this.resetMatch();
    // 首次进入：自动弹出玩法指引
    if (!storage.isGuideSeen()) {
      this.openGuide({ startAfter: true, from: State.READY });
      return;
    }
    this.state = State.READY;
  }

  startPlay() {
    this.resetMatch();
    this.state = State.PLAYING;
    this._tipDropDone = false;
    this._tipMergeDone = false;
    this.playTip = '左右拖动，松手放下';
    this.playTipT = 4;
    this.spawnHeld();
  }

  // ── 玩法指引 ──

  openGuide(opt) {
    const o = opt || {};
    this._guideReturnState = o.from || this.state || State.READY;
    this._guideStartAfter = !!o.startAfter;
    this.guidePage = 0;
    this.state = State.GUIDE;
  }

  guidePrev() {
    if (this.guidePage > 0) this.guidePage -= 1;
  }

  guideNext() {
    if (this.guidePage < GUIDE_PAGES.length - 1) {
      this.guidePage += 1;
      return;
    }
    this.closeGuide(true);
  }

  closeGuide(finished) {
    storage.setGuideSeen();
    const start = this._guideStartAfter && finished;
    this._guideStartAfter = false;
    if (start) {
      this.startPlay();
      return;
    }
    this.state = this._guideReturnState === State.GUIDE
      ? State.READY
      : this._guideReturnState;
    if (this.state !== State.READY && this.state !== State.GAMEOVER && this.state !== State.PLAYING) {
      this.state = State.READY;
    }
  }

  spawnHeld() {
    if (this.held || this.state !== State.PLAYING) return;
    const level = 1 + Math.floor(Math.random() * GameConfig.spawnableLevels);
    const r = radiusOf(level);
    this.held = createBody({
      x: this._clampX(this.targetX, r),
      y: GameConfig.spawnY,
      r,
      level,
      static: true,
      held: true,
    });
    this.world.add(this.held);
  }

  _clampX(x, r) {
    const min = GameConfig.wallPadding + r;
    const max = GameConfig.designWidth - GameConfig.wallPadding - r;
    const center = GameConfig.designWidth / 2;
    const lim = GameConfig.spawnXLimit;
    return Math.max(Math.max(min, center - lim), Math.min(Math.min(max, center + lim), x));
  }

  setPointerX(designX) {
    this.targetX = designX;
    if (this.held && this.state === State.PLAYING) {
      this.held.x = this._clampX(designX, this.held.r);
      this.held.y = GameConfig.spawnY;
    }
  }

  pointerStart(designX) {
    if (this.state !== State.PLAYING) return;
    this.pointerDown = true;
    this.setPointerX(designX);
  }

  pointerMove(designX) {
    if (this.state === State.PLAYING && this.pointerDown) this.setPointerX(designX);
  }

  pointerEnd() {
    if (this.state !== State.PLAYING || !this.pointerDown) {
      this.pointerDown = false;
      return;
    }
    this.pointerDown = false;
    this.dropHeld();
  }

  dropHeld() {
    if (!this.held || this.cooldown > 0 || this.state !== State.PLAYING) return;
    const b = this.held;
    b.held = false;
    b.static = false;
    b.vy = GameConfig.dropVy;
    recomputeInvMass(b);
    this.held = null;
    this.cooldown = GameConfig.dropCooldown;
    this.combo = 0;
    this._vibrate('light');
    this._sfx('drop');
    if (!this._tipDropDone) {
      this._tipDropDone = true;
      this.playTip = '相同等级碰到会合成哦';
      this.playTipT = 4;
    }
  }

  _vibrate(type) {
    if (!this.settings.vibrate) return;
    if (typeof wx !== 'undefined' && wx.vibrateShort) {
      try { wx.vibrateShort({ type: type || 'light' }); } catch (_) { /* ignore */ }
    }
  }

  _sfx(name, level) {
    if (!this.settings.sound) return;
    audio.play(name, level);
  }

  update(dt) {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toast = null;
    }
    if (this.playTipT > 0) {
      this.playTipT -= dt;
      if (this.playTipT <= 0) this.playTip = '';
    }
    if (this.comboTimer > 0) this.comboTimer -= dt;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.state !== State.PLAYING) return;

    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown <= 0 && !this.held) this.spawnHeld();
    }

    const steps = GameConfig.subSteps;
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.world.step(h);
      this._processMerges();
    }
    this._updateDeadline(dt);
  }

  _processMerges() {
    if (this.state !== State.PLAYING) return;
    const pairs = this.world.collectMergePairs(GameConfig.maxLevel);
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i];
      if (!a.merging && !b.merging) this._merge(a, b);
    }
  }

  _merge(a, b) {
    if (this.state !== State.PLAYING) return;
    a.merging = true;
    b.merging = true;
    recomputeInvMass(a);
    recomputeInvMass(b);

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const nextLevel = a.level + 1;

    this.combo += 1;
    if (this.combo > 1) {
      this.comboTimer = 0.9;
      this.toast = `Combo x${this.combo}`;
      this.toastT = 0.9;
      this._sfx('combo');
    }
    if (!this._tipMergeDone) {
      this._tipMergeDone = true;
      this.playTip = '小心别堆过危险线！';
      this.playTipT = 3.5;
    }

    this._addScore(GameConfig.scoreTable[a.level - 1] || 0);
    this._vibrate('medium');
    this._sfx('merge', a.level);
    this._burst(mx, my, a.level);

    this.world.remove(a);
    this.world.remove(b);
    if (this.held === a || this.held === b) this.held = null;

    if (nextLevel <= GameConfig.maxLevel) {
      const nb = createBody({
        x: mx, y: my, r: radiusOf(nextLevel), level: nextLevel, vx: 0, vy: -40,
      });
      nb.spawnAnim = 0;
      this.world.add(nb);
    }
  }

  _burst(x, y, level) {
    const n = 8 + level;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = 80 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 80,
        life: 0.35 + Math.random() * 0.25,
        max: 0.6,
        color: GameConfig.theme.gold,
        r: 3 + Math.random() * 4,
      });
    }
  }

  _addScore(points) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      storage.setHighScore(this.highScore);
      storage.markCloudDirty();
      // 破纪录即尝试上云，减少「BEST 与排行榜不一致」
      storage.syncScoreToCloud(this.highScore, { force: true });
    }
  }

  _updateDeadline(dt) {
    // 危险：顶部越过线，且不是在快速下落
    // 用 vy（向下为正）判断：快速下落不预警；横移/微抖仍可计时
    let danger = false;
    const maxFall = GameConfig.deadlineSettleSpeed; // 超过视为下落穿过
    for (let i = 0; i < this.world.bodies.length; i++) {
      const b = this.world.bodies[i];
      if (b.held || b.merging || b.static) continue;
      const top = b.y - b.r;
      if (top >= GameConfig.deadlineY) continue;
      // 快速下落（vy 大）穿过红线：不预警
      if (b.vy > maxFall) continue;
      danger = true;
      break;
    }

    if (danger) {
      this.deadlineTimer += dt;
      this.deadlineFlash += dt;
      if (this.deadlineTimer >= GameConfig.deadlineStableTime) {
        this._gameOver();
      }
    } else {
      this.deadlineTimer = Math.max(0, this.deadlineTimer - dt * 2.5);
      if (this.deadlineTimer <= 0) this.deadlineFlash = 0;
    }
  }

  _gameOver() {
    if (this.state === State.GAMEOVER) return;
    this.state = State.GAMEOVER;
    this.finalScore = this.score;
    this.pointerDown = false;
    if (this.held) {
      this.world.remove(this.held);
      this.held = null;
    }
    this._vibrate('medium');
    this._sfx('gameover');
    storage.syncScoreToCloud(this.highScore, { force: true });
  }

  // ── 设置 ──

  openSettings(from) {
    this._settingsReturn = from || this.state || State.READY;
    this.pointerDown = false;
    this._rankScrolling = false;
    this.state = State.SETTINGS;
  }

  closeSettings() {
    const back = this._settingsReturn;
    this.state = (back === State.SETTINGS) ? State.READY : back;
  }

  toggleSetting(key) {
    if (key !== 'vibrate' && key !== 'sound') return;
    const next = !this.settings[key];
    this.settings = storage.setSettings({ [key]: next });
    audio.setEnabled(this.settings.sound);
    if (key === 'sound' && next) {
      audio.unlock();
      this._sfx('ui');
    }
    if (key === 'vibrate' && next) this._vibrate('light');
  }

  // ── 排行榜 ──

  openRank() {
    this.prevStateBeforeRank = this.state;
    this.state = State.RANK;
    this.rankScrollY = 0;
    this._rankScrolling = false;

    // 先强制上云，再拉好友榜，避免云端仍是旧分
    const score = this.highScore;
    storage.syncScoreToCloud(score, {
      force: true,
      onDone: () => {
        // 略延迟，给托管数据传播一点时间
        setTimeout(() => {
          if (this.state !== State.RANK) return;
          this._postOpenData({ command: 'show', score });
        }, 200);
      },
    });
  }

  closeRank() {
    this._rankScrolling = false;
    this.rankScrollY = 0;
    this.state = this.prevStateBeforeRank === State.RANK
      ? State.READY
      : this.prevStateBeforeRank;
  }

  rankPointerStart(designY, canScroll) {
    this._rankScrolling = !!canScroll;
    this._rankLastY = designY;
  }

  rankPointerMove(designY) {
    if (!this._rankScrolling) return;
    const dy = designY - this._rankLastY;
    this._rankLastY = designY;
    if (Math.abs(dy) < 0.5) return;
    this.rankScrollY = Math.max(0, Math.min(8000, this.rankScrollY - dy));
    this._postOpenData({ command: 'scroll', y: this.rankScrollY });
  }

  rankPointerEnd() {
    this._rankScrolling = false;
  }

  _postOpenData(msg) {
    if (typeof wx === 'undefined' || !wx.getOpenDataContext) return;
    const odc = wx.getOpenDataContext();
    const sc = odc.canvas;
    if (sc) {
      const dpr = Math.min(3, (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio) || 2);
      const w = Math.floor(RANK_LOGIC_W * dpr);
      const h = Math.floor(RANK_LOGIC_H * dpr);
      if (sc.width !== w || sc.height !== h) {
        sc.width = w;
        sc.height = h;
      }
    }
    odc.postMessage(msg);
  }

  restart() {
    this.startPlay();
  }
}

module.exports = { Game, State, RANK_LOGIC_W, RANK_LOGIC_H, GUIDE_PAGES };
