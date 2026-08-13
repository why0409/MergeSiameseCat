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
const RANK_HEADER_H = 56;
const RANK_TIPS_H = 44;
const RANK_ROW_H = 78;

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
    /** 合成扩散环 / 闪光 */
    this.fxRings = [];
    /** 飘分 +N */
    this.scorePops = [];
    /** 连击闪光强度 0..1 */
    this.comboFlash = 0;
    /** 正在播放的吸收合成 {a,b,t,dur,...} */
    this.mergeAnims = [];
    this.toast = null;
    this.toastT = 0;
    this.pointerDown = false;
    this.prevStateBeforeRank = State.READY;
    this.finalScore = 0;
    this.rankScrollY = 0;
    this._rankScrolling = false;
    this._rankLastY = 0;
    this._rankThumbDrag = false;
    this._rankShowTimer = null;
    /** 主域绘制的排行榜视口（设计坐标），每帧由 renderer 写入 */
    this.rankListBox = null;
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
    this.fxRings = [];
    this.scorePops = [];
    this.comboFlash = 0;
    this.mergeAnims = [];
    this.toast = null;
    this.toastT = 0;
    this.targetX = GameConfig.designWidth / 2;
    this.pointerDown = false;
    this._rankScrolling = false;
    this._rankThumbDrag = false;
    if (this._rankShowTimer) {
      clearTimeout(this._rankShowTimer);
      this._rankShowTimer = null;
    }
  }

  _hasActiveMerge() {
    if (this.mergeAnims.length) return true;
    const bodies = this.world.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if ((b.mergeLock || 0) > 0) return true;
    }
    return false;
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
    b.sleeping = false;
    b.sleepTimer = 0;
    recomputeInvMass(b);
    this.world.wakeAround(b.x, b.y, b.r + 120);
    this.held = null;
    this.cooldown = GameConfig.dropCooldown;
    // 上一次连锁还在播时不要清 combo，否则 1→2→3 会被冷却后的下一次投放打断
    if (!this._hasActiveMerge()) this.combo = 0;
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
    if (this.comboFlash > 0) this.comboFlash = Math.max(0, this.comboFlash - dt * 2.2);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.fxRings.length - 1; i >= 0; i--) {
      const r = this.fxRings[i];
      r.life -= dt;
      r.r += r.vr * dt;
      if (r.life <= 0) this.fxRings.splice(i, 1);
    }
    for (let i = this.scorePops.length - 1; i >= 0; i--) {
      const s = this.scorePops[i];
      s.life -= dt;
      s.y += s.vy * dt;
      s.vy *= 0.96;
      if (s.life <= 0) this.scorePops.splice(i, 1);
    }

    const playing = this.state === State.PLAYING;
    if (playing || this.mergeAnims.length) {
      this._tickBodyAnims(dt);
      this._updateMergeAnims(dt);
    }
    if (!playing) return;

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

  _tickBodyAnims(dt) {
    const pop = GameConfig.mergePopTime || 0.22;
    const bodies = this.world.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.mergeLock > 0) b.mergeLock = Math.max(0, b.mergeLock - dt);
      if (b.spawnAnim != null && b.spawnAnim < 1) {
        b.spawnAnim = Math.min(1, b.spawnAnim + dt / pop);
      }
      if (b.mergeGlow > 0) b.mergeGlow = Math.max(0, b.mergeGlow - dt / 0.38);
    }
  }

  _processMerges() {
    if (this.state !== State.PLAYING) return;
    const pairs = this.world.collectMergePairs(GameConfig.maxLevel);
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i];
      if (!a.merging && !b.merging) this._beginMerge(a, b);
    }
  }

  _beginMerge(a, b) {
    if (this.state !== State.PLAYING) return;
    a.merging = true;
    b.merging = true;
    a.mergeScale = 1;
    b.mergeScale = 1;
    recomputeInvMass(a);
    recomputeInvMass(b);

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const nextLevel = a.level + 1;
    const dur = GameConfig.mergeAbsorbTime || 0.2;

    this.combo += 1;
    const isCombo = this.combo > 1;
    if (isCombo) {
      this.comboTimer = 1.1;
      this.toast = `连击 ×${this.combo}`;
      this.toastT = 1.1;
      this.comboFlash = Math.min(1, 0.35 + this.combo * 0.12);
      this._sfx('combo');
    }
    if (!this._tipMergeDone) {
      this._tipMergeDone = true;
      this.playTip = '小心别堆过危险线！';
      this.playTipT = 3.5;
    }

    const base = GameConfig.scoreTable[a.level - 1] || 0;
    const rate = GameConfig.comboBonusRate != null ? GameConfig.comboBonusRate : 0.5;
    const maxMult = GameConfig.comboMaxMult != null ? GameConfig.comboMaxMult : 4;
    const mult = Math.min(1 + (this.combo - 1) * rate, maxMult);
    const points = Math.max(1, Math.round(base * mult));
    this._addScore(points);
    this._spawnScorePop(mx, my - (a.r + b.r) * 0.25, points, mult, isCombo);

    this._vibrate(isCombo ? 'medium' : 'light');
    this._sfx('merge', a.level);
    this._burst(mx, my, a.level, this.combo);

    if (this.held === a || this.held === b) this.held = null;

    this.mergeAnims.push({
      a,
      b,
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      mx,
      my,
      fromLevel: a.level,
      nextLevel,
      t: 0,
      dur,
    });
  }

  _updateMergeAnims(dt) {
    if (!this.mergeAnims.length) return;
    for (let i = this.mergeAnims.length - 1; i >= 0; i--) {
      const m = this.mergeAnims[i];
      m.t += dt;
      const u = Math.min(1, m.t / m.dur);
      const ease = 1 - (1 - u) * (1 - u);
      const a = m.a;
      const b = m.b;
      if (a) {
        a.x = m.ax + (m.mx - m.ax) * ease;
        a.y = m.ay + (m.my - m.ay) * ease;
        a.mergeScale = 1 - 0.72 * ease;
      }
      if (b) {
        b.x = m.bx + (m.mx - m.bx) * ease;
        b.y = m.by + (m.my - m.by) * ease;
        b.mergeScale = 1 - 0.72 * ease;
      }
      m.reveal = Math.max(0, (u - 0.4) / 0.6);
      if (m.t >= m.dur) {
        this.mergeAnims.splice(i, 1);
        this._completeMerge(m);
      }
    }
  }

  _completeMerge(m) {
    const { a, b, mx, my, nextLevel } = m;
    if (a) this.world.remove(a);
    if (b) this.world.remove(b);

    this.world.wakeAll();
    this._spawnMergeRing(mx, my, nextLevel - 1, this.combo);

    if (nextLevel <= GameConfig.maxLevel) {
      const nb = createBody({
        x: mx, y: my, r: radiusOf(nextLevel), level: nextLevel, vx: 0, vy: -36,
      });
      // 吸收阶段已淡入下一级，这里不再从小弹出，避免闪一下
      nb.spawnAnim = 1;
      nb.mergeGlow = 1;
      nb.mergeLock = GameConfig.mergeLockTime || 0.26;
      this.world.add(nb);
    }
  }

  _flushMerges() {
    while (this.mergeAnims.length) {
      const m = this.mergeAnims.pop();
      this._completeMerge(m);
    }
  }

  _burst(x, y, level, combo) {
    const c = combo || 1;
    const n = 10 + level + Math.min(12, c * 3);
    const colors = [
      GameConfig.theme.gold,
      GameConfig.theme.goldSoft,
      GameConfig.theme.blueEye,
      GameConfig.theme.combo,
      '#fff6e8',
    ];
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = 90 + Math.random() * (160 + c * 30);
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 100,
        life: 0.4 + Math.random() * 0.3 + (c > 1 ? 0.12 : 0),
        max: 0.75,
        color: colors[i % colors.length],
        r: 3 + Math.random() * (4 + Math.min(4, c)),
      });
    }
    // 连击额外星屑
    if (c > 1) {
      for (let i = 0; i < 4 + c; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 80;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - 140,
          life: 0.55 + Math.random() * 0.25,
          max: 0.85,
          color: GameConfig.theme.combo,
          r: 2 + Math.random() * 3,
        });
      }
    }
  }

  _spawnMergeRing(x, y, level, combo) {
    const baseR = radiusOf(level) * 0.6;
    this.fxRings.push({
      x, y,
      r: baseR,
      vr: 180 + level * 12 + (combo > 1 ? 80 : 0),
      life: 0.45 + Math.min(0.35, combo * 0.06),
      max: 0.55,
      color: combo > 1 ? GameConfig.theme.combo : GameConfig.theme.gold,
      line: 4 + Math.min(6, combo),
    });
    if (combo > 1) {
      this.fxRings.push({
        x, y,
        r: baseR * 0.4,
        vr: 260 + combo * 20,
        life: 0.35,
        max: 0.4,
        color: GameConfig.theme.blueEye,
        line: 3,
      });
    }
  }

  _spawnScorePop(x, y, points, mult, isCombo) {
    const text = mult > 1.01
      ? `+${points}  ×${mult.toFixed(mult % 1 === 0 ? 0 : 1)}`
      : `+${points}`;
    this.scorePops.push({
      x,
      y,
      vy: -70,
      life: isCombo ? 1.0 : 0.75,
      max: isCombo ? 1.0 : 0.75,
      text,
      combo: !!isCombo,
    });
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
    /**
     * 危险线在投放点下方（约顶部 23%，非屏幕正中）。
     * 猫顶部越过该线，且已存在足够久（不是刚投下穿过），则计时。
     * 用 life 而非速度：堆叠抖动时 vy 可能一直偏大，会导致永不结束。
     */
    const line = GameConfig.deadlineY;
    const minLife = GameConfig.deadlineMinLife;
    let danger = false;

    for (let i = 0; i < this.world.bodies.length; i++) {
      const b = this.world.bodies[i];
      if (b.held || b.merging || b.static) continue;
      // 累计在场时间
      b.life = (b.life || 0) + dt;
      const top = b.y - b.r;
      if (top >= line) continue;
      if (b.life < minLife) continue;
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
      this.deadlineTimer = 0;
      this.deadlineFlash = 0;
    }
  }

  _gameOver() {
    if (this.state === State.GAMEOVER) return;
    this.state = State.GAMEOVER;
    this.finalScore = this.score;
    this._stopPlaySession();
    this._vibrate('medium');
    this._sfx('gameover');
    storage.syncScoreToCloud(this.highScore, { force: true });
  }

  /** 结束本局：停投放/合成，清临时特效；滑动监听由 main.input.sync 卸掉 */
  _stopPlaySession() {
    this.pointerDown = false;
    this.cooldown = 0;
    this._rankScrolling = false;
    this._rankThumbDrag = false;
    this._flushMerges();
    if (this.held) {
      this.world.remove(this.held);
      this.held = null;
    }
    this.particles.length = 0;
    this.fxRings.length = 0;
    this.scorePops.length = 0;
    this.comboFlash = 0;
    this.playTip = '';
    this.playTipT = 0;
    if (this._rankShowTimer) {
      clearTimeout(this._rankShowTimer);
      this._rankShowTimer = null;
    }
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
    this._rankThumbDrag = false;

    // 先强制上云，再拉好友榜，避免云端仍是旧分
    const score = this.highScore;
    this._sizeOpenDataCanvas();
    storage.syncScoreToCloud(score, {
      force: true,
      onDone: () => {
        // 略延迟，给托管数据传播一点时间
        if (this._rankShowTimer) clearTimeout(this._rankShowTimer);
        this._rankShowTimer = setTimeout(() => {
          this._rankShowTimer = null;
          if (this.state !== State.RANK) return;
          this._postOpenData({ command: 'show', score });
        }, 200);
      },
    });
    // 浏览器预览没有子域，立刻画本地假数据
    if (typeof wx === 'undefined' || !wx.getOpenDataContext) {
      this._ensurePreviewRank();
    }
  }

  closeRank() {
    this._rankScrolling = false;
    this._rankThumbDrag = false;
    this.rankScrollY = 0;
    if (this._rankShowTimer) {
      clearTimeout(this._rankShowTimer);
      this._rankShowTimer = null;
    }
    this.state = this.prevStateBeforeRank === State.RANK
      ? State.READY
      : this.prevStateBeforeRank;
  }

  rankPointerStart(designX, designY, canScroll) {
    this._rankScrolling = !!canScroll;
    this._rankLastY = designY;
    this._rankThumbDrag = false;
    if (!canScroll) return;

    const box = this.rankListBox;
    if (box
      && designX >= box.x + box.w - 40
      && designX <= box.x + box.w + 4
      && designY >= box.y
      && designY <= box.y + box.h) {
      this._rankThumbDrag = true;
      this._applyRankThumb(designY);
    }
  }

  rankPointerMove(designX, designY) {
    if (!this._rankScrolling) return;
    const dy = designY - this._rankLastY;
    this._rankLastY = designY;
    if (this._rankThumbDrag) {
      this._applyRankThumb(designY);
      return;
    }
    if (!dy) return;
    const box = this.rankListBox;
    const viewH = (box && box.h) || RANK_LOGIC_H;
    const max = this._rankMaxScroll(viewH);
    this.rankScrollY = Math.max(0, Math.min(max, this.rankScrollY - dy));
    this._postOpenData({ command: 'scrollBy', dy, viewH });
  }

  rankPointerEnd() {
    this._rankScrolling = false;
    this._rankThumbDrag = false;
  }

  _applyRankThumb(designY) {
    const box = this.rankListBox;
    const viewH = (box && box.h) || RANK_LOGIC_H;
    const top = (box ? box.y : 0) + viewH * (RANK_HEADER_H / RANK_LOGIC_H);
    const usable = Math.max(1, viewH * (1 - (RANK_HEADER_H + RANK_TIPS_H) / RANK_LOGIC_H));
    const t = Math.max(0, Math.min(1, (designY - top) / usable));
    const max = this._rankMaxScroll(viewH);
    this.rankScrollY = t * max;
    this._postOpenData({ command: 'scrollTo', t });
  }

  _rankMaxScroll(viewH) {
    const items = this.previewRankItems();
    if (!items || !items.length) return 0;
    const u = viewH / RANK_LOGIC_H;
    const rowH = RANK_ROW_H * u;
    const listH = viewH - (RANK_HEADER_H + RANK_TIPS_H) * u;
    return Math.max(0, items.length * rowH - listH);
  }

  _ensurePreviewRank() {
    if (this._previewRank) return;
    const names = [
      '小鱼干', '奶油蓝眼', '海豹重点', '奶茶', '芝士',
      '豆豆', '可可', '豆浆', '团子', '年糕',
      '芝麻', '奥利奥', '布丁', '芋泥', '花生',
      '曲奇', '抹茶', '布偶',
    ];
    this._previewRank = names.map((name, i) => ({
      name,
      score: Math.max(0, 880 - i * 47),
      isSelf: false,
    }));
  }

  previewRankItems() {
    if (typeof wx !== 'undefined' && wx.getOpenDataContext) return null;
    this._ensurePreviewRank();
    const items = this._previewRank.map((it) => Object.assign({}, it));
    const me = items[3] || items[0];
    if (me) {
      me.score = Math.max(me.score, this.highScore);
      me.isSelf = true;
    }
    items.sort((a, b) => b.score - a.score);
    return items;
  }

  _sizeOpenDataCanvas() {
    if (typeof wx === 'undefined' || !wx.getOpenDataContext) return;
    const odc = wx.getOpenDataContext();
    const sc = odc.canvas;
    if (!sc) return;
    if (!this._odcDpr) {
      let dpr = 2;
      try {
        dpr = (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio) || 2;
      } catch (_) { /* ignore */ }
      this._odcDpr = Math.min(3, dpr);
    }
    const w = Math.floor(RANK_LOGIC_W * this._odcDpr);
    const h = Math.floor(RANK_LOGIC_H * this._odcDpr);
    if (sc.width !== w || sc.height !== h) {
      sc.width = w;
      sc.height = h;
    }
  }

  _postOpenData(msg) {
    if (typeof wx === 'undefined' || !wx.getOpenDataContext) return;
    const odc = wx.getOpenDataContext();
    odc.postMessage(msg);
  }

  restart() {
    this.startPlay();
  }

  /** 结算后回到首页 */
  goHome() {
    this.pointerDown = false;
    this._rankScrolling = false;
    this.resetMatch();
    this.state = State.READY;
  }
}

module.exports = {
  Game,
  State,
  RANK_LOGIC_W,
  RANK_LOGIC_H,
  RANK_HEADER_H,
  RANK_TIPS_H,
  RANK_ROW_H,
  GUIDE_PAGES,
};
