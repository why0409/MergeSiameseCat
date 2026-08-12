/**
 * Canvas 渲染：场地、猫、UI 面板
 */
const GameConfig = require('./config');
const { State, RANK_LOGIC_W, RANK_LOGIC_H, GUIDE_PAGES } = require('./game');
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
   * 适配屏幕：contain 设计分辨率
   */
  resize(screenW, screenH, dpr) {
    this.dpr = dpr || 1;
    const dw = GameConfig.designWidth;
    const dh = GameConfig.designHeight;
    const scale = Math.min(screenW / dw, screenH / dh);
    this.scale = scale;
    this.offsetX = (screenW - dw * scale) / 2;
    this.offsetY = (screenH - dh * scale) / 2;

    this.canvas.width = Math.floor(screenW * this.dpr);
    this.canvas.height = Math.floor(screenH * this.dpr);
    if (this.canvas.style) {
      this.canvas.style.width = `${screenW}px`;
      this.canvas.style.height = `${screenH}px`;
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
    this._drawParticles(ctx, game);
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

    // 对局中右上角设置入口
    if (game.state === State.PLAYING) {
      this._drawHudSettingsBtn(ctx);
    }

    if (game.state === State.PLAYING && game.playTip && game.playTipT > 0) {
      this._drawPlayTip(ctx, game);
    }

    if (game.toast && game.comboTimer > 0) {
      this._drawCombo(ctx, game);
    }

    ctx.restore();
  }

  _drawBackdrop(ctx) {
    const w = GameConfig.designWidth;
    const h = GameConfig.designHeight;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fffaf2');
    g.addColorStop(0.5, T.cream);
    g.addColorStop(1, '#efe4d4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 爪印装饰
    ctx.fillStyle = 'rgba(92,64,51,0.06)';
    this._paw(ctx, 80, 100, 16);
    this._paw(ctx, 640, 140, 14);
    this._paw(ctx, 90, 1100, 18);
    this._paw(ctx, 630, 1050, 15);

    // 顶金条
    ctx.fillStyle = 'rgba(212,168,75,0.18)';
    ctx.fillRect(0, 0, w, 72);
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

  _drawArena(ctx) {
    const left = GameConfig.wallPadding;
    const right = GameConfig.designWidth - GameConfig.wallPadding;
    const floor = GameConfig.floorY;
    // 底边
    ctx.strokeStyle = 'rgba(69,46,39,0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(left, floor);
    ctx.lineTo(right, floor);
    ctx.stroke();
    // 侧墙细线
    ctx.beginPath();
    ctx.moveTo(left, 80);
    ctx.lineTo(left, floor);
    ctx.moveTo(right, 80);
    ctx.lineTo(right, floor);
    ctx.stroke();
  }

  _drawDeadline(ctx, game) {
    if (game.state === State.READY || game.state === State.LOADING) return;
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
      // 常显淡线，玩家知道危险位置
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = T.dangerSoft;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
    }
    ctx.beginPath();
    ctx.moveTo(GameConfig.wallPadding, y);
    ctx.lineTo(GameConfig.designWidth - GameConfig.wallPadding, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = warning || over ? 0.9 : 0.4;
    ctx.fillStyle = T.danger;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(warning ? `危险 ${Math.max(0, GameConfig.deadlineStableTime - game.deadlineTimer).toFixed(1)}s` : '危险线', GameConfig.wallPadding + 8, y - 4);
    ctx.restore();
  }

  _drawBodies(ctx, game) {
    const bodies = game.world.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.merging) continue;
      if (b.spawnAnim != null && b.spawnAnim < 1) {
        b.spawnAnim = Math.min(1, b.spawnAnim + 0.08);
      }
      const sc = b.spawnAnim != null ? 0.3 + 0.7 * this._easeOutBack(b.spawnAnim) : 1;
      this._drawCat(ctx, b.x, b.y, b.r * sc, b.level, b.held);
    }
  }

  _easeOutBack(t) {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  _drawCat(ctx, x, y, r, level, held) {
    const img = assets.getCatImage(level);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (img) {
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    } else {
      const hue = 30 + level * 12;
      ctx.fillStyle = `hsl(${hue}, 45%, ${70 - level * 2}%)`;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = T.chocolate;
      ctx.font = `${Math.max(14, r * 0.45)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(level), x, y);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = held ? T.blueEye : 'rgba(69,46,39,0.35)';
    ctx.lineWidth = held ? 3 : 2;
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
    // 顶栏
    ctx.fillStyle = 'rgba(248,241,230,0.92)';
    ctx.fillRect(0, 0, GameConfig.designWidth, 72);
    ctx.fillStyle = T.gold;
    ctx.fillRect(0, 70, GameConfig.designWidth, 3);
    ctx.beginPath();
    ctx.arc(GameConfig.designWidth / 2, 71, 5, 0, Math.PI * 2);
    ctx.fillStyle = T.blueEye;
    ctx.fill();

    ctx.fillStyle = T.chocolateMid;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(game.score), 28, 38);

    ctx.fillStyle = T.gold;
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'right';
    // 右侧给设置按钮留空
    ctx.fillText(`BEST: ${game.highScore}`, GameConfig.designWidth - 88, 38);
  }

  _drawHudSettingsBtn(ctx) {
    const x = GameConfig.designWidth - 64;
    const y = 12;
    const s = 48;
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
    ctx.strokeStyle = T.chocolate;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
      ctx.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15);
      ctx.stroke();
    }
  }

  _drawSettingsPanel(ctx, game) {
    ctx.fillStyle = T.overlay;
    ctx.fillRect(0, 0, GameConfig.designWidth, GameConfig.designHeight);

    const cw = 560;
    const ch = 520;
    const cx = (GameConfig.designWidth - cw) / 2;
    const cy = 340;
    this._drawCard(ctx, cx, cy, cw, ch);

    ctx.fillStyle = T.chocolate;
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('设置', GameConfig.designWidth / 2, cy + 70);

    this._drawToggleRow(ctx, 'tog_sound', cx + 50, cy + 150, cw - 100, '音效', !!game.settings.sound);
    this._drawToggleRow(ctx, 'tog_vibrate', cx + 50, cy + 250, cw - 100, '震动', !!game.settings.vibrate);

    ctx.fillStyle = 'rgba(69,46,39,0.45)';
    ctx.font = '20px sans-serif';
    ctx.fillText('设置会自动保存到本机', GameConfig.designWidth / 2, cy + 360);

    this._drawButton(ctx, 'btn_settings_close', cx + 100, cy + 400, 360, 64, '返回', true);
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
    ctx.save();
    ctx.translate(GameConfig.designWidth / 2, 160);
    const pulse = 1 + 0.08 * Math.sin(this.time * 12);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = T.combo;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = T.creamSoft;
    ctx.lineWidth = 4;
    ctx.strokeText(game.toast, 0, 0);
    ctx.fillText(game.toast, 0, 0);
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

  _drawCard(ctx, x, y, w, h) {
    // shadow
    ctx.fillStyle = 'rgba(40,28,24,0.2)';
    this._roundRect(ctx, x + 6, y + 8, w, h, 28);
    ctx.fill();
    ctx.fillStyle = T.creamSoft;
    this._roundRect(ctx, x, y, w, h, 28);
    ctx.fill();
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 4;
    this._roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 26);
    ctx.stroke();
    // eyes
    const cx = x + w / 2;
    const ey = y + 36;
    ctx.fillStyle = T.blueEye;
    ctx.beginPath();
    ctx.arc(cx - 18, ey, 7, 0, Math.PI * 2);
    ctx.arc(cx + 18, ey, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = T.white;
    ctx.beginPath();
    ctx.arc(cx - 16, ey - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 20, ey - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
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

    const cw = 560;
    const ch = 720;
    const cx = (GameConfig.designWidth - cw) / 2;
    const cy = 240;
    this._drawCard(ctx, cx, cy, cw, ch);
    this._drawTitleBadge(ctx, GameConfig.designWidth / 2, cy + 120);

    ctx.fillStyle = T.chocolate;
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('合成大暹罗', GameConfig.designWidth / 2, cy + 210);
    ctx.fillStyle = T.chocolateMid;
    ctx.font = '22px sans-serif';
    ctx.fillText('Merge · Siamese Cat', GameConfig.designWidth / 2, cy + 250);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(69,46,39,0.65)';
    ctx.fillText(`历史最佳 ${game.highScore}`, GameConfig.designWidth / 2, cy + 290);

    this._drawButton(ctx, 'btn_start', cx + 100, cy + 330, 360, 68, '开始游戏', true);
    this._drawButton(ctx, 'btn_rank', cx + 100, cy + 410, 360, 60, '好友排行', false);
    this._drawButton(ctx, 'btn_help', cx + 100, cy + 485, 360, 60, '玩法说明', false);
    this._drawButton(ctx, 'btn_settings', cx + 100, cy + 560, 360, 60, '设置', false);
  }

  _drawPlayTip(ctx, game) {
    const alpha = Math.min(1, game.playTipT);
    ctx.save();
    ctx.globalAlpha = alpha;
    const tw = 520;
    const th = 56;
    const x = (GameConfig.designWidth - tw) / 2;
    const y = 100;
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

    const cw = 600;
    const ch = 820;
    const cx = (GameConfig.designWidth - cw) / 2;
    const cy = 180;
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

    const cw = 520;
    const ch = 520;
    const cx = (GameConfig.designWidth - cw) / 2;
    const cy = 340;
    this._drawCard(ctx, cx, cy, cw, ch);

    ctx.fillStyle = T.chocolate;
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('本局结束', GameConfig.designWidth / 2, cy + 100);

    ctx.fillStyle = T.chocolateMid;
    ctx.font = '32px sans-serif';
    ctx.fillText(`最终得分: ${game.finalScore}`, GameConfig.designWidth / 2, cy + 180);

    ctx.fillStyle = T.gold;
    ctx.font = '24px sans-serif';
    ctx.fillText(`BEST: ${game.highScore}`, GameConfig.designWidth / 2, cy + 230);

    this._drawButton(ctx, 'btn_restart', cx + 80, cy + 300, 360, 72, '再来一局', true);
    this._drawButton(ctx, 'btn_rank', cx + 80, cy + 400, 360, 64, '好友排行', false);
  }

  _drawRankOverlay(ctx, game) {
    ctx.fillStyle = T.overlay;
    ctx.fillRect(0, 0, GameConfig.designWidth, GameConfig.designHeight);

    const cw = 600;
    const ch = 980;
    const cx = (GameConfig.designWidth - cw) / 2;
    const cy = 120;
    this._drawCard(ctx, cx, cy, cw, ch);

    // 与子域 540×800 等比绘制，避免头像被压扁
    const maxW = cw - 40;
    const maxH = 780;
    const fit = Math.min(maxW / RANK_LOGIC_W, maxH / RANK_LOGIC_H);
    const listW = Math.floor(RANK_LOGIC_W * fit);
    const listH = Math.floor(RANK_LOGIC_H * fit);
    const listX = cx + Math.floor((cw - listW) / 2);
    const listY = cy + 28 + Math.floor((maxH - listH) / 2);

    this.hitAreas.rank_panel = { x: cx, y: cy, w: cw, h: ch - 90 };
    this.hitAreas.rank_list = { x: listX, y: listY, w: listW, h: listH };

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
      ctx.fillStyle = 'rgba(69,46,39,0.5)';
      ctx.font = '26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('排行榜加载中…', GameConfig.designWidth / 2, listY + listH * 0.5);
    }

    this._drawButton(ctx, 'btn_close_rank', cx + 150, cy + 860, 300, 64, '关闭', false);
  }
}

module.exports = Renderer;
