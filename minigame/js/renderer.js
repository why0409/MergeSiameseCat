/**
 * Canvas 渲染：场地、猫、UI 面板
 */
const GameConfig = require('./config');
const { State, RANK_LOGIC_W, RANK_LOGIC_H, RANK_HEADER_H, RANK_TIPS_H, RANK_ROW_H, GUIDE_PAGES } = require('./game');
const assets = require('./assets');

const T = GameConfig.theme;

class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dpr = 1;
    this.hitAreas = {};
    this.time = 0;
  }

  /**
   * 按设备信息自动适配并铺满全屏
   * @param {object} device getDeviceLayout() 结果
   * @param {object} [layoutGame] Game 实例，同步物理边界
   */
  resize(device, layoutGame) {
    const screenW = device.windowWidth;
    const screenH = device.windowHeight;
    this.dpr = device.pixelRatio || 2;

    const layout = GameConfig.applyScreenLayout(device);
    const dw = layout.designWidth;
    const dh = layout.designHeight;
    this.scale = layout.scale;
    this.offsetX = 0;
    this.offsetY = 0;

    const drawnW = dw * this.scale;
    const drawnH = dh * this.scale;
    if (Math.abs(drawnW - screenW) > 1) this.offsetX = (screenW - drawnW) / 2;
    if (Math.abs(drawnH - screenH) > 1) this.offsetY = (screenH - drawnH) / 2;

    this.canvas.width = Math.floor(screenW * this.dpr);
    this.canvas.height = Math.floor(screenH * this.dpr);
    if (this.canvas.style) {
      this.canvas.style.width = `${screenW}px`;
      this.canvas.style.height = `${screenH}px`;
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (layoutGame && layoutGame.world && layoutGame.world.syncBounds) {
      layoutGame.world.syncBounds();
    }
  }

  /** 屏幕坐标 → 设计坐标 */
  screenToDesign(x, y) {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale,
    };
  }

  hitTest(designX, designY, name) {
    const a = this.hitAreas[name];
    if (!a) return false;
    return designX >= a.x && designX <= a.x + a.w && designY >= a.y && designY <= a.y + a.h;
  }

  findHit(designX, designY) {
    const keys = Object.keys(this.hitAreas);
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      if (this.hitTest(designX, designY, k)) return k;
    }
    return null;
  }

  draw(game, dt) {
    this.time += dt || 0;
    const ctx = this.ctx;
    const screenW = this.canvas.width / this.dpr;
    const screenH = this.canvas.height / this.dpr;

    // 外圈深色
    ctx.fillStyle = T.sealPoint;
    ctx.fillRect(0, 0, screenW, screenH);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    this.hitAreas = {};
    this._drawBackdrop(ctx);
    this._drawArena(ctx);
    this._drawDeadline(ctx, game);
    this._drawBodies(ctx, game);
    this._drawFxRings(ctx, game);
    this._drawParticles(ctx, game);
    this._drawScorePops(ctx, game);
    this._drawGuide(ctx, game);
    this._drawHud(ctx, game);

    if (game.state === State.LOADING) {
      this._drawLoading(ctx);
    } else if (game.state === State.READY) {
      this._drawStartPanel(ctx, game);
    } else if (game.state === State.GUIDE) {
      this._drawGuidePanel(ctx, game);
    } else if (game.state === State.SETTINGS) {
      this._drawSettingsPanel(ctx, game);
    } else if (game.state === State.GAMEOVER) {
      this._drawGameOver(ctx, game);
    } else if (game.state === State.RANK) {
      this._drawRankOverlay(ctx, game);
    }

    if (game.state === State.PLAYING && game.playTip && game.playTipT > 0) {
      this._drawPlayTip(ctx, game);
    }

    if (game.toast && game.comboTimer > 0) {
      this._drawCombo(ctx, game);
    }

    // 连击全屏淡闪光
    if (game.comboFlash > 0) {
      ctx.fillStyle = `rgba(212,100,60,${0.12 * game.comboFlash})`;
      ctx.fillRect(0, 0, GameConfig.designWidth, GameConfig.designHeight);
    }

    ctx.restore();
  }

  _drawBackdrop(ctx) {
    const w = GameConfig.designWidth;
    const h = GameConfig.designHeight;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fffaf2');
    g.addColorStop(0.45, T.cream);
    g.addColorStop(1, '#e8dcc8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 暹罗色块：顶部 seal 点缀条 + 奶油底
    ctx.fillStyle = 'rgba(58,42,36,0.04)';
    ctx.fillRect(0, 0, w, 120);
    ctx.fillStyle = 'rgba(212,168,75,0.16)';
    ctx.fillRect(0, 0, w, 8);

    // 爪印装饰（更密、随高度分布）
    ctx.fillStyle = 'rgba(92,64,51,0.055)';
    const paws = [
      [70, 180, 15], [650, 200, 13], [120, h * 0.35, 12],
      [600, h * 0.42, 16], [80, h * 0.62, 14], [640, h * 0.68, 12],
      [100, h * 0.88, 18], [620, h * 0.84, 15], [360, h * 0.92, 11],
    ];
    for (const [px, py, ps] of paws) this._paw(ctx, px, py, ps);

    // 角落猫耳剪影
    this._cornerEar(ctx, 0, h * 0.55, 1);
    this._cornerEar(ctx, w, h * 0.72, -1);
  }

  _cornerEar(ctx, x, y, dir) {
    ctx.save();
    ctx.fillStyle = 'rgba(58,42,36,0.05)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 70, y - 90);
    ctx.lineTo(x + dir * 20, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _paw(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
    const toes = [
      [-0.7, -0.55], [-0.2, -0.75], [0.25, -0.75], [0.7, -0.5],
    ];
    for (const [tx, ty] of toes) {
      ctx.beginPath();
      ctx.arc(x + tx * s, y + ty * s, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 简化暹罗猫头（装饰用） */
  _siameseFace(ctx, x, y, s) {
    ctx.save();
    // 脸
    ctx.fillStyle = T.creamSoft;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.95, s * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    // 耳
    ctx.fillStyle = T.sealPoint;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.85, y - s * 0.15);
    ctx.lineTo(x - s * 0.55, y - s * 1.05);
    ctx.lineTo(x - s * 0.2, y - s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.85, y - s * 0.15);
    ctx.lineTo(x + s * 0.55, y - s * 1.05);
    ctx.lineTo(x + s * 0.2, y - s * 0.35);
    ctx.closePath();
    ctx.fill();
    // 内耳
    ctx.fillStyle = 'rgba(220,140,140,0.55)';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.72, y - s * 0.25);
    ctx.lineTo(x - s * 0.52, y - s * 0.85);
    ctx.lineTo(x - s * 0.32, y - s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.72, y - s * 0.25);
    ctx.lineTo(x + s * 0.52, y - s * 0.85);
    ctx.lineTo(x + s * 0.32, y - s * 0.35);
    ctx.closePath();
    ctx.fill();
    // 蓝眼
    ctx.fillStyle = T.blueEye;
    ctx.beginPath();
    ctx.ellipse(x - s * 0.32, y - s * 0.05, s * 0.16, s * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(x + s * 0.32, y - s * 0.05, s * 0.16, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = T.white;
    ctx.beginPath();
    ctx.arc(x - s * 0.28, y - s * 0.12, s * 0.05, 0, Math.PI * 2);
    ctx.arc(x + s * 0.36, y - s * 0.12, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    // 鼻
    ctx.fillStyle = '#c87878';
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.12);
    ctx.lineTo(x - s * 0.08, y + s * 0.22);
    ctx.lineTo(x + s * 0.08, y + s * 0.22);
    ctx.closePath();
    ctx.fill();
    // 胡须
    ctx.strokeStyle = 'rgba(69,46,39,0.35)';
    ctx.lineWidth = Math.max(1, s * 0.04);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const yy = y + s * 0.18 + i * s * 0.1;
        ctx.beginPath();
        ctx.moveTo(x + side * s * 0.15, yy);
        ctx.lineTo(x + side * s * 0.95, yy - s * 0.05 + i * s * 0.03);
        ctx.stroke();
      }
    }
    // 嘴角 seal
    ctx.fillStyle = 'rgba(58,42,36,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.55, s * 0.55, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawArena(ctx) {
    const left = GameConfig.wallPadding;
    const right = GameConfig.designWidth - GameConfig.wallPadding;
    const floor = GameConfig.floorY;
    const H = GameConfig.designHeight;

    // 地面：奶油垫 + seal 边
    const groundH = H - floor;
    const gg = ctx.createLinearGradient(0, floor, 0, H);
    gg.addColorStop(0, '#e8dcc8');
    gg.addColorStop(1, '#d4c4a8');
    ctx.fillStyle = gg;
    ctx.fillRect(0, floor, GameConfig.designWidth, groundH);

    // 地垫花纹：浅爪印
    ctx.fillStyle = 'rgba(69,46,39,0.05)';
    this._paw(ctx, 160, floor + groundH * 0.45, 22);
    this._paw(ctx, 560, floor + groundH * 0.5, 18);
    this._paw(ctx, 360, floor + groundH * 0.55, 14);

    ctx.fillStyle = 'rgba(69,46,39,0.1)';
    ctx.fillRect(0, floor, GameConfig.designWidth, 6);
    // 金线装饰
    ctx.strokeStyle = 'rgba(212,168,75,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left + 20, floor + 3);
    ctx.lineTo(right - 20, floor + 3);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(69,46,39,0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(left, floor);
    ctx.lineTo(right, floor);
    ctx.stroke();

    // 侧墙：从 HUD 下到地面，带圆角柱头
    const wallTop = (GameConfig.hudTop || 0) + (GameConfig.hudHeight || 72);
    ctx.strokeStyle = 'rgba(69,46,39,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left, wallTop);
    ctx.lineTo(left, floor);
    ctx.moveTo(right, wallTop);
    ctx.lineTo(right, floor);
    ctx.stroke();
    // 墙顶猫耳装饰
    ctx.fillStyle = 'rgba(58,42,36,0.12)';
    ctx.beginPath();
    ctx.moveTo(left - 2, wallTop);
    ctx.lineTo(left + 14, wallTop - 18);
    ctx.lineTo(left + 18, wallTop);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(right + 2, wallTop);
    ctx.lineTo(right - 14, wallTop - 18);
    ctx.lineTo(right - 18, wallTop);
    ctx.closePath();
    ctx.fill();
  }

  _drawDeadline(ctx, game) {
    if (game.state === State.READY || game.state === State.LOADING || game.state === State.GUIDE) return;
    const y = GameConfig.deadlineY;
    const warning = game.deadlineTimer > 0;
    const over = game.state === State.GAMEOVER;

    ctx.save();
    if (over) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = T.danger;
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
    } else if (warning) {
      const flash = 0.45 + 0.55 * Math.sin(this.time * 10);
      ctx.globalAlpha = flash;
      ctx.strokeStyle = T.danger;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
    } else {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = T.dangerSoft;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
    }
    ctx.beginPath();
    ctx.moveTo(GameConfig.wallPadding, y);
    ctx.lineTo(GameConfig.designWidth - GameConfig.wallPadding, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = warning || over ? 0.95 : 0.5;
    ctx.fillStyle = T.danger;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const label = warning
      ? `危险 ${Math.max(0, GameConfig.deadlineStableTime - game.deadlineTimer).toFixed(1)}s`
      : '危险线';
    ctx.fillText(label, GameConfig.wallPadding + 8, y - 4);
    ctx.restore();
  }

  _drawBodies(ctx, game) {
    const bodies = game.world.bodies;
    // 先画静止/下落，再画正在吸收的，保证合成过程在上层
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.merging) continue;
      const sc = b.spawnAnim != null ? 0.28 + 0.72 * this._easeOutBack(b.spawnAnim) : 1;
      this._drawCat(ctx, b.x, b.y, b.r * sc, b.level, b.held, b.mergeGlow || 0, b.held ? 0 : b.angle);
    }
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b.merging) continue;
      const sc = b.mergeScale != null ? b.mergeScale : 0.5;
      if (sc < 0.05) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, sc);
      this._drawCat(ctx, b.x, b.y, b.r * sc, b.level, false, 0.45, b.angle);
      ctx.restore();
    }
    this._drawMergeReveal(ctx, game);
  }

  /** 吸收后半段淡入下一级，让人看清 1+1 正在变成 2 */
  _drawMergeReveal(ctx, game) {
    const anims = game.mergeAnims;
    if (!anims || !anims.length) return;
    for (let i = 0; i < anims.length; i++) {
      const m = anims[i];
      if (!m.nextLevel || m.nextLevel > GameConfig.maxLevel) continue;
      const rev = m.reveal || 0;
      if (rev <= 0.02) continue;
      const r = (GameConfig.radii[m.nextLevel - 1] || 30) * (0.35 + 0.65 * this._easeOutBack(rev));
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.65 * rev;
      this._drawCat(ctx, m.mx, m.my, r, m.nextLevel, false, 0.8);
      ctx.restore();
    }
  }

  _easeOutBack(t) {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  _drawCat(ctx, x, y, r, level, held, glow, angle) {
    // 合成光晕
    if (glow > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.35 * glow;
      ctx.fillStyle = T.goldSoft;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.15 + 0.2 * glow), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const img = assets.getCatImage(level);
    const rot = held ? 0 : (angle || 0);
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (img) {
      ctx.drawImage(img, -r, -r, r * 2, r * 2);
    } else {
      const hue = 30 + level * 12;
      ctx.fillStyle = `hsl(${hue}, 45%, ${70 - level * 2}%)`;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = T.chocolate;
      ctx.font = `${Math.max(14, r * 0.45)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(level), 0, 0);
    }
    ctx.restore();

    // 描边画在圆内，避免两只贴紧时描边叠在一起像「边缘重合」
    const lw = held ? 3 : (glow > 0.05 ? 3 : 2);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r - lw * 0.5), 0, Math.PI * 2);
    if (held) ctx.strokeStyle = T.blueEye;
    else if (glow > 0.05) ctx.strokeStyle = T.gold;
    else ctx.strokeStyle = 'rgba(69,46,39,0.35)';
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  _drawParticles(ctx, game) {
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life / (p.max || 0.5));
      ctx.fillStyle = p.color || T.gold;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawFxRings(ctx, game) {
    if (!game.fxRings || !game.fxRings.length) return;
    for (const ring of game.fxRings) {
      const a = Math.max(0, ring.life / (ring.max || 0.5));
      ctx.save();
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = ring.color || T.gold;
      ctx.lineWidth = (ring.line || 3) * a;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, Math.max(2, ring.r), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _drawScorePops(ctx, game) {
    if (!game.scorePops || !game.scorePops.length) return;
    for (const s of game.scorePops) {
      const t = Math.max(0, s.life / (s.max || 0.8));
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.4);
      const scale = 0.85 + 0.25 * (1 - t);
      ctx.translate(s.x, s.y);
      ctx.scale(scale, scale);
      ctx.font = s.combo ? 'bold 36px sans-serif' : 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(40,28,24,0.55)';
      ctx.lineWidth = 4;
      ctx.strokeText(s.text, 0, 0);
      ctx.fillStyle = s.combo ? T.combo : T.gold;
      ctx.fillText(s.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _drawGuide(ctx, game) {
    if (game.state !== State.PLAYING || !game.held) return;
    const x = game.held.x;
    const y0 = game.held.y + game.held.r + 4;
    const y1 = GameConfig.floorY;
    ctx.strokeStyle = T.guide;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawHud(ctx, game) {
    const top = GameConfig.hudTop || 0;
    const hh = GameConfig.hudHeight || 72;
    const W = GameConfig.designWidth;
    const midY = top + hh / 2;
    const playing = game.state === State.PLAYING;

    // 状态栏区域填充，与 HUD 一体
    if (top > 0) {
      ctx.fillStyle = 'rgba(248,241,230,0.98)';
      ctx.fillRect(0, 0, W, top);
    }

    ctx.fillStyle = 'rgba(248,241,230,0.95)';
    ctx.fillRect(0, top, W, hh);
    ctx.fillStyle = T.gold;
    ctx.fillRect(0, top + hh - 2, W, 3);
    // 中心蓝眼点缀
    ctx.beginPath();
    ctx.arc(W / 2, top + hh - 1, 5, 0, Math.PI * 2);
    ctx.fillStyle = T.blueEye;
    ctx.fill();
    // 两侧小爪印
    ctx.fillStyle = 'rgba(92,64,51,0.12)';
    this._paw(ctx, 48, top + hh - 6, 8);
    this._paw(ctx, W - 48, top + hh - 6, 8);

    // 布局：SCORE 左 | BEST 中右 | 设置 右（胶囊左侧）
    // 先算设置钮位置，BEST 再贴其左侧，避免互相遮挡
    const menuLeft = GameConfig.menuLeft || W;
    const btnS = 40;
    let settingsX = null;
    if (playing) {
      settingsX = Math.min(W - btnS - 10, menuLeft - btnS - 10);
      const settingsY = top + (hh - btnS) / 2;
      this._drawHudSettingsBtnAt(ctx, settingsX, settingsY, btnS);
    }

    const scoreX = 22 + (GameConfig.safeLeft || 0);
    ctx.fillStyle = T.chocolateMid;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(game.score), scoreX, midY);

    // BEST：右对齐到设置钮左侧，或胶囊左侧
    const bestRight = playing && settingsX != null
      ? settingsX - 14
      : Math.min(W - 24, menuLeft - 16);
    ctx.fillStyle = T.gold;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    // 限宽：若与分数重叠，缩短文案
    const bestLabel = `BEST ${game.highScore}`;
    const bestW = ctx.measureText(bestLabel).width;
    const scoreW = (() => {
      ctx.font = 'bold 34px sans-serif';
      return ctx.measureText(String(game.score)).width;
    })();
    if (bestRight - bestW > scoreX + scoreW + 16) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = T.gold;
      ctx.fillText(bestLabel, bestRight, midY);
    } else {
      // 空间紧：BEST 放分数下方小字，或缩短
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = T.gold;
      ctx.fillText(`★${game.highScore}`, bestRight, midY);
    }
  }

  _drawHudSettingsBtnAt(ctx, x, y, s) {
    this.hitAreas.btn_settings_hud = { x, y, w: s, h: s };
    ctx.fillStyle = 'rgba(232,196,140,0.95)';
    this._roundRect(ctx, x, y, s, s, 12);
    ctx.fill();
    ctx.strokeStyle = T.chocolate;
    ctx.lineWidth = 2;
    this._roundRect(ctx, x + 1, y + 1, s - 2, s - 2, 11);
    ctx.stroke();
    const cx = x + s / 2;
    const cy = y + s / 2;
    // 猫爪式设置：圆垫 + 三趾点，比齿轮更暹罗
    ctx.fillStyle = T.chocolate;
    ctx.beginPath();
    ctx.arc(cx, cy + 3, 6, 0, Math.PI * 2);
    ctx.fill();
    const toes = [[-7, -5], [0, -8], [7, -5]];
    for (const [tx, ty] of toes) {
      ctx.beginPath();
      ctx.arc(cx + tx, cy + ty, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawSettingsPanel(ctx, game) {
    ctx.fillStyle = T.overlay;
    ctx.fillRect(0, 0, GameConfig.designWidth, GameConfig.designHeight);

    const fromPlay = game._settingsReturn === State.PLAYING;
    const { cx, cy, cw, ch } = this._panelBox(560, fromPlay ? 730 : 640);
    this._drawCard(ctx, cx, cy, cw, ch);

    ctx.fillStyle = T.chocolate;
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('设置', GameConfig.designWidth / 2, cy + 62);

    this._drawToggleRow(ctx, 'tog_sound', cx + 50, cy + 122, cw - 100, '音效', !!game.settings.sound);
    this._drawToggleRow(ctx, 'tog_vibrate', cx + 50, cy + 210, cw - 100, '震动', !!game.settings.vibrate);
    this._drawToggleRow(ctx, 'tog_gold', cx + 50, cy + 298, cw - 100, '金色昵称', !!game.settings.goldName);

    ctx.fillStyle = 'rgba(69,46,39,0.45)';
    ctx.font = '20px sans-serif';
    ctx.fillText('开启后排行榜显示金色名字与 SVIP', GameConfig.designWidth / 2, cy + 410);

    this._drawButton(
      ctx,
      'btn_settings_close',
      cx + 100,
      cy + 460,
      360,
      64,
      fromPlay ? '继续游戏' : '返回',
      true,
    );
    if (fromPlay) {
      this._drawButton(ctx, 'btn_settings_home', cx + 100, cy + 540, 360, 60, '回到首页', false);
    }
  }

  _drawToggleRow(ctx, hitName, x, y, w, label, on) {
    const h = 72;
    ctx.fillStyle = '#f3ebe0';
    this._roundRect(ctx, x, y, w, h, 16);
    ctx.fill();

    ctx.fillStyle = T.chocolate;
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 28, y + h / 2);

    // 开关
    const tw = 96;
    const th = 44;
    const tx = x + w - tw - 24;
    const ty = y + (h - th) / 2;
    this.hitAreas[hitName] = { x: tx, y: ty, w: tw, h: th };

    ctx.fillStyle = on ? T.gold : 'rgba(69,46,39,0.2)';
    this._roundRect(ctx, tx, ty, tw, th, th / 2);
    ctx.fill();

    const knob = th - 8;
    const kx = on ? tx + tw - knob - 4 : tx + 4;
    ctx.fillStyle = T.creamSoft;
    ctx.beginPath();
    ctx.arc(kx + knob / 2, ty + th / 2, knob / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = on ? T.chocolate : 'rgba(69,46,39,0.55)';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(on ? '开' : '关', tx + tw / 2, ty + th / 2);
  }

  _drawCombo(ctx, game) {
    const comboN = game.combo || 2;
    // 危险线下方，避开手持猫与 HUD
    const baseY = (GameConfig.deadlineY || 260) + 48;
    ctx.save();
    ctx.translate(GameConfig.designWidth / 2, baseY);
    const pulse = 1 + 0.1 * Math.sin(this.time * 14) + Math.min(0.25, (comboN - 1) * 0.04);
    ctx.scale(pulse, pulse);

    // 背景爪印光晕
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = T.combo;
    this._paw(ctx, 0, 8, 36 + comboN * 2);
    ctx.globalAlpha = 1;

    ctx.fillStyle = T.combo;
    ctx.font = `bold ${Math.min(56, 40 + comboN * 2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = T.creamSoft;
    ctx.lineWidth = 5;
    const text = game.toast || `连击 ×${comboN}`;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);

    // 副标题
    if (comboN >= 3) {
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = T.gold;
      ctx.strokeStyle = 'rgba(40,28,24,0.35)';
      ctx.lineWidth = 3;
      const sub = comboN >= 6 ? '暹罗狂潮！' : comboN >= 4 ? '好猫！' : '漂亮';
      ctx.strokeText(sub, 0, 36);
      ctx.fillText(sub, 0, 36);
    }
    ctx.restore();
  }

  _drawLoading(ctx) {
    ctx.fillStyle = T.overlay;
    ctx.fillRect(0, 0, GameConfig.designWidth, GameConfig.designHeight);
    ctx.fillStyle = T.creamSoft;
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('加载暹罗中…', GameConfig.designWidth / 2, GameConfig.designHeight / 2);
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /**
   * 弹窗在当前 design 坐标系内水平+垂直居中
   * （designHeight 会随设备变化，不能写死 cy）
   */
  _panelBox(cw, ch) {
    const W = GameConfig.designWidth;
    const H = GameConfig.designHeight;
    const margin = 24;
    const topMin = Math.max(margin, (GameConfig.hudTop || 0) + 8);
    const bottomMax = H - margin;
    let useH = Math.min(ch, bottomMax - topMin);
    if (useH < 200) useH = Math.min(ch, H - margin * 2);
    const cx = (W - cw) / 2;
    let cy = (H - useH) / 2;
    if (cy < topMin) cy = topMin;
    if (cy + useH > bottomMax) cy = Math.max(topMin, bottomMax - useH);
    return { cx, cy, cw, ch: useH };
  }

  _drawCard(ctx, x, y, w, h) {
    // shadow
    ctx.fillStyle = 'rgba(40,28,24,0.2)';
    this._roundRect(ctx, x + 6, y + 8, w, h, 28);
    ctx.fill();
    ctx.fillStyle = T.creamSoft;
    this._roundRect(ctx, x, y, w, h, 28);
    ctx.fill();
    // seal 顶条
    ctx.save();
    ctx.beginPath();
    this._roundRect(ctx, x, y, w, 48, 28);
    ctx.clip();
    ctx.fillStyle = 'rgba(58,42,36,0.07)';
    ctx.fillRect(x, y, w, 48);
    ctx.restore();
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 4;
    this._roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 26);
    ctx.stroke();
    // 蓝眼 + 鼻梁装饰
    const cx = x + w / 2;
    const ey = y + 34;
    ctx.fillStyle = T.blueEye;
    ctx.beginPath();
    ctx.ellipse(cx - 20, ey, 8, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 20, ey, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = T.white;
    ctx.beginPath();
    ctx.arc(cx - 17, ey - 3, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 23, ey - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // 小爪印角标
    ctx.fillStyle = 'rgba(92,64,51,0.1)';
    this._paw(ctx, x + 28, y + h - 28, 12);
    this._paw(ctx, x + w - 28, y + h - 28, 12);
  }

  _drawButton(ctx, name, x, y, w, h, label, primary) {
    this.hitAreas[name] = { x, y, w, h };
    ctx.fillStyle = primary ? T.buttonFill : T.secondaryBtn;
    this._roundRect(ctx, x, y, w, h, 22);
    ctx.fill();
    ctx.strokeStyle = T.chocolate;
    ctx.lineWidth = primary ? 3 : 2;
    this._roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 20);
    ctx.stroke();
    if (primary) {
      ctx.strokeStyle = 'rgba(212,168,75,0.7)';
      ctx.lineWidth = 2;
      this._roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 16);
      ctx.stroke();
    }
    ctx.fillStyle = T.chocolate;
    ctx.font = primary ? 'bold 32px sans-serif' : 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  _drawTitleBadge(ctx, cx, cy) {
    // ears
    ctx.fillStyle = T.sealPoint;
    ctx.beginPath();
    ctx.moveTo(cx - 90, cy + 10);
    ctx.lineTo(cx - 55, cy - 55);
    ctx.lineTo(cx - 25, cy + 15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 90, cy + 10);
    ctx.lineTo(cx + 55, cy - 55);
    ctx.lineTo(cx + 25, cy + 15);
    ctx.closePath();
    ctx.fill();
    // face
    ctx.fillStyle = T.creamSoft;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 20, 100, 55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = T.chocolateMid;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = T.blueEye;
    ctx.beginPath();
    ctx.ellipse(cx - 32, cy + 12, 14, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 32, cy + 12, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawStartPanel(ctx, game) {
    ctx.fillStyle = T.overlay;
    ctx.fillRect(0, 0, GameConfig.designWidth, GameConfig.designHeight);

    const { cx, cy, cw, ch } = this._panelBox(560, 840);
    this._drawCard(ctx, cx, cy, cw, ch);
    // 大暹罗脸
    this._siameseFace(ctx, GameConfig.designWidth / 2, cy + 125, 56);

    ctx.fillStyle = T.chocolate;
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('合成大暹罗', GameConfig.designWidth / 2, cy + 220);
    ctx.fillStyle = T.chocolateMid;
    ctx.font = '22px sans-serif';
    ctx.fillText('Merge · Siamese Cat', GameConfig.designWidth / 2, cy + 258);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(69,46,39,0.65)';
    ctx.fillText(`★ 历史最佳 ${game.highScore}`, GameConfig.designWidth / 2, cy + 298);

    // 等级色点装饰条（暗示 10 阶）
    const dotsY = cy + 328;
    for (let i = 0; i < 10; i++) {
      const dx = GameConfig.designWidth / 2 + (i - 4.5) * 22;
      ctx.beginPath();
      ctx.arc(dx, dotsY, 5, 0, Math.PI * 2);
      ctx.fillStyle = i < 3 ? T.blueEye : i < 7 ? T.gold : T.sealPoint;
      ctx.fill();
    }

    this._drawButton(ctx, 'btn_start', cx + 100, cy + 360, 360, 68, '开始游戏', true);
    this._drawButton(ctx, 'btn_rank', cx + 100, cy + 440, 360, 60, '好友排行', false);
    this._drawButton(ctx, 'btn_share', cx + 100, cy + 515, 360, 60, '分享好友', false);
    this._drawButton(ctx, 'btn_help', cx + 100, cy + 590, 360, 60, '玩法说明', false);
    this._drawButton(ctx, 'btn_settings', cx + 100, cy + 665, 360, 60, '设置', false);
  }

  _drawPlayTip(ctx, game) {
    const alpha = Math.min(1, game.playTipT);
    ctx.save();
    ctx.globalAlpha = alpha;
    const tw = 520;
    const th = 56;
    const x = (GameConfig.designWidth - tw) / 2;
    const y = (GameConfig.hudTop || 0) + (GameConfig.hudHeight || 72) + 12;
    ctx.fillStyle = 'rgba(69,46,39,0.78)';
    this._roundRect(ctx, x, y, tw, th, 16);
    ctx.fill();
    ctx.fillStyle = T.creamSoft;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.playTip, GameConfig.designWidth / 2, y + th / 2);
    ctx.restore();
  }

  _drawGuidePanel(ctx, game) {
    ctx.fillStyle = T.overlay;
    ctx.fillRect(0, 0, GameConfig.designWidth, GameConfig.designHeight);

    const pages = GUIDE_PAGES;
    const page = pages[game.guidePage] || pages[0];
    const total = pages.length;
    const idx = game.guidePage;

    const { cx, cy, cw, ch } = this._panelBox(600, 820);
    this._drawCard(ctx, cx, cy, cw, ch);

    ctx.fillStyle = T.chocolate;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('玩法说明', GameConfig.designWidth / 2, cy + 70);

    ctx.fillStyle = T.gold;
    ctx.font = '22px sans-serif';
    ctx.fillText(`${idx + 1} / ${total}`, GameConfig.designWidth / 2, cy + 110);

    // 图示区
    const ix = cx + 60;
    const iy = cy + 140;
    const iw = cw - 120;
    const ih = 280;
    ctx.fillStyle = '#f3ebe0';
    this._roundRect(ctx, ix, iy, iw, ih, 20);
    ctx.fill();
    this._drawGuideIcon(ctx, page.icon, ix + iw / 2, iy + ih / 2, iw, ih);

    ctx.fillStyle = T.chocolate;
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(page.title, GameConfig.designWidth / 2, cy + 460);

    // 描述换行
    ctx.fillStyle = T.chocolateMid;
    ctx.font = '26px sans-serif';
    this._fillWrapText(ctx, page.desc, GameConfig.designWidth / 2, cy + 520, cw - 100, 36);

    // 页点
    const dotY = cy + 610;
    for (let i = 0; i < total; i++) {
      const dx = GameConfig.designWidth / 2 + (i - (total - 1) / 2) * 22;
      ctx.beginPath();
      ctx.arc(dx, dotY, i === idx ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === idx ? T.gold : 'rgba(69,46,39,0.25)';
      ctx.fill();
    }

    const last = idx >= total - 1;
    if (idx > 0) {
      this._drawButton(ctx, 'btn_guide_prev', cx + 40, cy + 660, 150, 60, '上一步', false);
    } else {
      this._drawButton(ctx, 'btn_guide_skip', cx + 40, cy + 660, 150, 60, '跳过', false);
    }
    this._drawButton(
      ctx,
      'btn_guide_next',
      cx + cw - 190,
      cy + 660,
      150,
      60,
      last ? (game._guideStartAfter ? '开始' : '完成') : '下一步',
      true,
    );
  }

  _fillWrapText(ctx, text, cx, y, maxW, lineH) {
    const chars = String(text).split('');
    let line = '';
    const lines = [];
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = chars[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineH) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, startY + i * lineH);
    }
  }

  _drawGuideIcon(ctx, icon, cx, cy, boxW, boxH) {
    ctx.save();
    ctx.translate(cx, cy);
    if (icon === 'drag') {
      // 猫 + 左右箭头
      this._miniCat(ctx, 0, -20, 42);
      ctx.strokeStyle = T.blueEye;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-110, 50);
      ctx.lineTo(-50, 50);
      ctx.moveTo(-50, 50);
      ctx.lineTo(-65, 35);
      ctx.moveTo(-50, 50);
      ctx.lineTo(-65, 65);
      ctx.moveTo(110, 50);
      ctx.lineTo(50, 50);
      ctx.moveTo(50, 50);
      ctx.lineTo(65, 35);
      ctx.moveTo(50, 50);
      ctx.lineTo(65, 65);
      ctx.stroke();
      ctx.fillStyle = T.chocolateMid;
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('拖动', 0, 95);
    } else if (icon === 'drop') {
      this._miniCat(ctx, 0, -50, 38);
      ctx.strokeStyle = T.gold;
      ctx.lineWidth = 5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 70);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, 70);
      ctx.lineTo(-12, 52);
      ctx.lineTo(12, 52);
      ctx.closePath();
      ctx.fillStyle = T.gold;
      ctx.fill();
      ctx.fillStyle = T.chocolateMid;
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('松手落下', 0, 105);
    } else if (icon === 'merge') {
      this._miniCat(ctx, -70, 10, 34);
      this._miniCat(ctx, 70, 10, 34);
      ctx.fillStyle = T.gold;
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('→', 0, 20);
      this._miniCat(ctx, 0, -55, 48);
      ctx.fillStyle = T.chocolateMid;
      ctx.font = '22px sans-serif';
      ctx.fillText('合成升级', 0, 105);
    } else if (icon === 'danger') {
      ctx.strokeStyle = T.danger;
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(-120, -40);
      ctx.lineTo(120, -40);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = T.danger;
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('危险线', 0, -60);
      this._miniCat(ctx, -30, 40, 36);
      this._miniCat(ctx, 40, 55, 44);
      this._miniCat(ctx, 0, 90, 30);
      ctx.fillStyle = T.chocolateMid;
      ctx.font = '22px sans-serif';
      ctx.fillText('别堆太高', 0, 140);
    }
    ctx.restore();
  }

  _miniCat(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = T.creamSoft;
    ctx.fill();
    ctx.strokeStyle = T.chocolateMid;
    ctx.lineWidth = 3;
    ctx.stroke();
    // ears
    ctx.fillStyle = T.sealPoint;
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.3);
    ctx.lineTo(-r * 0.45, -r * 1.05);
    ctx.lineTo(-r * 0.15, -r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.3);
    ctx.lineTo(r * 0.45, -r * 1.05);
    ctx.lineTo(r * 0.15, -r * 0.45);
    ctx.closePath();
    ctx.fill();
    // eyes
    ctx.fillStyle = T.blueEye;
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.05, r * 0.14, r * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.28, -r * 0.05, r * 0.14, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawGameOver(ctx, game) {
    ctx.fillStyle = T.overlay;
    ctx.fillRect(0, 0, GameConfig.designWidth, GameConfig.designHeight);

    const { cx, cy, cw, ch } = this._panelBox(520, 740);
    this._drawCard(ctx, cx, cy, cw, ch);
    this._siameseFace(ctx, GameConfig.designWidth / 2, cy + 88, 36);

    ctx.fillStyle = T.chocolate;
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('本局结束', GameConfig.designWidth / 2, cy + 150);

    ctx.fillStyle = T.chocolateMid;
    ctx.font = '32px sans-serif';
    ctx.fillText(`最终得分: ${game.finalScore}`, GameConfig.designWidth / 2, cy + 210);

    ctx.fillStyle = T.gold;
    ctx.font = '24px sans-serif';
    ctx.fillText(`★ BEST ${game.highScore}`, GameConfig.designWidth / 2, cy + 255);

    this._drawButton(ctx, 'btn_restart', cx + 80, cy + 300, 360, 68, '再来一局', true);
    this._drawButton(ctx, 'btn_share', cx + 80, cy + 384, 360, 60, '分享成绩', false);
    this._drawButton(ctx, 'btn_home', cx + 80, cy + 458, 360, 60, '回到首页', false);
    this._drawButton(ctx, 'btn_rank', cx + 80, cy + 532, 360, 60, '好友排行', false);
  }

  _drawRankOverlay(ctx, game) {
    ctx.fillStyle = T.overlay;
    ctx.fillRect(0, 0, GameConfig.designWidth, GameConfig.designHeight);

    // 排行榜卡片略高，仍垂直居中
    const box = this._panelBox(600, Math.min(980, GameConfig.designHeight - 80));
    const { cx, cy, cw, ch } = box;
    this._drawCard(ctx, cx, cy, cw, ch);

    // 与子域 540×800 等比绘制，避免头像被压扁
    const maxW = cw - 40;
    const maxH = Math.max(400, ch - 120);
    const fit = Math.min(maxW / RANK_LOGIC_W, maxH / RANK_LOGIC_H);
    const listW = Math.floor(RANK_LOGIC_W * fit);
    const listH = Math.floor(RANK_LOGIC_H * fit);
    const listX = cx + Math.floor((cw - listW) / 2);
    const listY = cy + 28 + Math.max(0, Math.floor((maxH - listH) / 2));

    this.hitAreas.rank_panel = { x: cx, y: cy, w: cw, h: Math.max(120, ch - 90) };
    this.hitAreas.rank_list = { x: listX, y: listY, w: listW, h: listH };
    game.rankListBox = { x: listX, y: listY, w: listW, h: listH };

    ctx.fillStyle = 'rgba(255,250,242,0.98)';
    this._roundRect(ctx, listX, listY, listW, listH, 16);
    ctx.fill();

    let drew = false;
    if (typeof wx !== 'undefined' && wx.getOpenDataContext) {
      const sc = wx.getOpenDataContext().canvas;
      if (sc && sc.width > 0) {
        ctx.save();
        this._roundRect(ctx, listX, listY, listW, listH, 16);
        ctx.clip();
        ctx.drawImage(sc, listX, listY, listW, listH);
        ctx.restore();
        drew = true;
      }
    }
    if (!drew) {
      const local = game.previewRankItems && game.previewRankItems();
      if (local && local.length) {
        this._drawLocalRank(ctx, game, local, listX, listY, listW, listH);
      } else {
        ctx.fillStyle = 'rgba(69,46,39,0.5)';
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('排行榜加载中…', GameConfig.designWidth / 2, listY + listH * 0.5);
      }
    }

    this._drawButton(ctx, 'btn_close_rank', cx + (cw - 300) / 2, cy + ch - 80, 300, 64, '关闭', false);
  }

  /** 金色 SVIP 角标，返回占用宽度 */
  _drawSvipBadge(ctx, x, mid, u) {
    const bw = 52 * u;
    const bh = 22 * u;
    ctx.fillStyle = T.gold;
    this._roundRect(ctx, x, mid - bh / 2, bw, bh, 6 * u);
    ctx.fill();
    ctx.fillStyle = T.chocolate;
    ctx.font = `bold ${Math.round(14 * u)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SVIP', x + bw / 2, mid);
    ctx.textAlign = 'left';
    return bw + 8 * u;
  }

  /** 浏览器预览：与子域同布局的本地榜，用来验滚动跟手 */
  _drawLocalRank(ctx, game, items, x, y, w, h) {
    const u = h / RANK_LOGIC_H;
    const headerH = RANK_HEADER_H * u;
    const tipsH = RANK_TIPS_H * u;
    const rowH = RANK_ROW_H * u;
    const pad = 16 * u;
    const listTop = y + headerH;
    const listH = h - headerH - tipsH;
    const contentH = items.length * rowH;
    const maxScroll = Math.max(0, contentH - listH);
    const scrollY = Math.max(0, Math.min(maxScroll, game.rankScrollY || 0));

    ctx.save();
    this._roundRect(ctx, x, y, w, h, 16);
    ctx.clip();

    ctx.fillStyle = '#fffaf2';
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, listTop, w, listH);
    ctx.clip();

    const i0 = Math.max(0, Math.floor(scrollY / rowH) - 1);
    const i1 = Math.min(items.length - 1, Math.ceil((scrollY + listH) / rowH) + 1);
    const topColors = [T.gold, '#9aa3ad', '#c47a4a'];

    for (let i = i0; i <= i1; i++) {
      const item = items[i];
      const ry = listTop + i * rowH - scrollY;
      const mid = ry + rowH * 0.5;
      ctx.fillStyle = item.isSelf ? 'rgba(212,168,75,0.22)' : (i % 2 ? '#fffaf2' : '#f3ebe0');
      ctx.fillRect(x, ry, w, rowH);

      ctx.fillStyle = i < 3 ? topColors[i] : T.blueEye;
      ctx.font = `bold ${Math.round(22 * u)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x + pad + 22 * u, mid);

      const avX = x + pad + 52 * u;
      const avR = Math.min(rowH * 0.34, 38 * u);
      ctx.fillStyle = item.isSelf ? T.goldSoft : '#e0d4c4';
      ctx.beginPath();
      ctx.arc(avX, mid, avR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = T.chocolate;
      ctx.font = `bold ${Math.round(18 * u)}px sans-serif`;
      ctx.fillText((item.name || '?').slice(0, 1), avX, mid);

      const vip = !!(item.svip || (item.isSelf && game.goldActive && game.goldActive()));
      const nameX = avX + avR + 12 * u;
      ctx.font = `bold ${Math.round(24 * u)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillStyle = vip ? T.gold : T.chocolate;
      ctx.fillText(item.name, nameX, mid);
      let extraX = nameX + ctx.measureText(item.name).width + 8 * u;
      if (vip) extraX += this._drawSvipBadge(ctx, extraX, mid, u);
      if (item.isSelf) {
        ctx.fillStyle = T.gold;
        ctx.font = `bold ${Math.round(18 * u)}px sans-serif`;
        ctx.fillText('我', extraX, mid);
      }

      ctx.fillStyle = T.gold;
      ctx.textAlign = 'right';
      ctx.font = `bold ${Math.round(26 * u)}px sans-serif`;
      ctx.fillText(String(item.score), x + w - pad, mid);
    }

    if (maxScroll > 0) {
      const trackH = listH - 16 * u;
      const thumbH = Math.max(36 * u, trackH * (listH / contentH));
      const thumbY = listTop + 8 * u + (trackH - thumbH) * (scrollY / maxScroll);
      const tx = x + w - 10 * u;
      ctx.fillStyle = 'rgba(69,46,39,0.1)';
      ctx.fillRect(tx, listTop + 8 * u, 5 * u, trackH);
      ctx.fillStyle = 'rgba(212,168,75,0.9)';
      ctx.fillRect(tx, thumbY, 5 * u, thumbH);
    }
    ctx.restore();

    ctx.fillStyle = '#f8f1e6';
    ctx.fillRect(x, y, w, headerH);
    ctx.strokeStyle = 'rgba(212,168,75,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + headerH);
    ctx.lineTo(x + w, y + headerH);
    ctx.stroke();
    ctx.fillStyle = T.chocolate;
    ctx.font = `bold ${Math.round(30 * u)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('好友排行', x + w / 2, y + headerH * 0.5);

    ctx.fillStyle = '#f8f1e6';
    ctx.fillRect(x, y + h - tipsH, w, tipsH);
    ctx.strokeStyle = 'rgba(212,168,75,0.35)';
    ctx.beginPath();
    ctx.moveTo(x, y + h - tipsH);
    ctx.lineTo(x + w, y + h - tipsH);
    ctx.stroke();
    ctx.fillStyle = 'rgba(69,46,39,0.55)';
    ctx.font = `${Math.round(18 * u)}px sans-serif`;
    ctx.fillText(`我的最高分 ${game.highScore} · 共 ${items.length} 位 · 滑动`, x + w / 2, y + h - tipsH * 0.5);
    ctx.restore();
  }
}

module.exports = Renderer;
