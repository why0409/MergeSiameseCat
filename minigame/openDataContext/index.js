/**
 * 开放数据域：好友排行榜
 * 主域传入的 score 为本地权威最高分，用于校正「自己」的展示分
 */
const LOGIC_H = 800;

let canvas = null;
let ctx = null;
let list = [];
/** 主域本地最高分（权威） */
let selfBest = 0;
let selfAvatar = '';
let selfName = '';
let scrollY = 0;
let maxScrollY = 0;
const avatarCache = Object.create(null);

function ensure() {
  if (ctx) return true;
  if (typeof wx === 'undefined' || !wx.getSharedCanvas) return false;
  canvas = wx.getSharedCanvas();
  ctx = canvas.getContext('2d');
  return !!ctx;
}

function scoreOf(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function loadAvatar(url) {
  if (!url || avatarCache[url] !== undefined) return;
  const img = wx.createImage();
  avatarCache[url] = 'loading';
  img.onload = () => {
    avatarCache[url] = img;
    paint();
  };
  img.onerror = () => {
    avatarCache[url] = null;
    paint();
  };
  img.src = url;
}

function drawAvatar(cx, cy, r, url) {
  const d = r * 2;
  const img = url ? avatarCache[url] : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img && img !== 'loading') {
    const s = Math.max(d / (img.width || 1), d / (img.height || 1));
    const dw = (img.width || 1) * s;
    const dh = (img.height || 1) * s;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = '#e0d4c4';
    ctx.fillRect(cx - r, cy - r, d, d);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(69,46,39,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function ellipsis(text, maxW) {
  const full = String(text || '好友');
  if (ctx.measureText(full).width <= maxW) return full;
  let s = full;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

/** 用本地最高分校正「我」的展示分，并保证在列表中 */
function applySelfScore() {
  list.forEach((it) => { it.isSelf = false; });

  let me = null;
  if (selfAvatar) me = list.find((it) => it.avatar === selfAvatar);
  if (!me && selfName) me = list.find((it) => it.name === selfName);

  if (me) {
    me.score = Math.max(me.score, selfBest);
    me.isSelf = true;
  } else {
    list.push({
      name: selfName || '我',
      avatar: selfAvatar || '',
      score: selfBest,
      isSelf: true,
    });
    if (selfAvatar) loadAvatar(selfAvatar);
  }

  list.sort((a, b) => b.score - a.score);
}

function paint() {
  if (!ensure()) return;

  const w = canvas.width;
  const h = canvas.height;
  const u = h / LOGIC_H;
  const headerH = Math.round(56 * u);
  const tipsH = Math.round(44 * u);
  const rowH = Math.round(78 * u);
  const pad = Math.round(16 * u);
  const rankW = Math.round(44 * u);
  const scoreW = Math.round(100 * u);
  const titleSize = Math.round(30 * u);
  const nameSize = Math.round(24 * u);
  const scoreSize = Math.round(26 * u);
  const rankSize = Math.round(22 * u);
  const tipsSize = Math.round(18 * u);
  const listTop = headerH;
  const listH = h - headerH - tipsH;
  const contentH = list.length * rowH;
  maxScrollY = Math.max(0, contentH - listH);
  scrollY = Math.max(0, Math.min(maxScrollY, scrollY));
  const avatarR = Math.round(Math.min(rowH * 0.34, 38 * u));

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fffaf2';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, listTop, w, listH);
  ctx.clip();

  if (!list.length) {
    ctx.fillStyle = 'rgba(69,46,39,0.5)';
    ctx.font = `${Math.round(24 * u)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(selfBest > 0 ? `我的最高分 ${selfBest}` : '暂无好友数据', w / 2, listTop + listH * 0.45);
  } else {
    const i0 = Math.max(0, Math.floor(scrollY / rowH) - 1);
    const i1 = Math.min(list.length - 1, Math.ceil((scrollY + listH) / rowH) + 1);
    const topColors = ['#d4a84b', '#9aa3ad', '#c47a4a'];

    for (let i = i0; i <= i1; i++) {
      const item = list[i];
      const y = listTop + i * rowH - scrollY;
      const mid = y + rowH * 0.5;
      const self = !!item.isSelf;

      ctx.fillStyle = self ? 'rgba(212,168,75,0.22)' : (i % 2 ? '#fffaf2' : '#f3ebe0');
      ctx.fillRect(0, y, w, rowH);

      ctx.fillStyle = i < 3 ? topColors[i] : '#5aa0d2';
      ctx.font = `bold ${rankSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), pad + rankW * 0.5, mid);

      const avX = pad + rankW + avatarR + Math.round(8 * u);
      drawAvatar(avX, mid, avatarR, item.avatar);

      const nameX = avX + avatarR + Math.round(12 * u);
      const nameMax = w - nameX - scoreW - pad - (self ? Math.round(40 * u) : 0);
      ctx.fillStyle = '#452e27';
      ctx.font = `bold ${nameSize}px sans-serif`;
      ctx.textAlign = 'left';
      const name = ellipsis(item.name, nameMax);
      ctx.fillText(name, nameX, mid);

      if (self) {
        const nw = ctx.measureText(name).width;
        ctx.fillStyle = '#d4a84b';
        ctx.font = `bold ${tipsSize}px sans-serif`;
        ctx.fillText('我', nameX + nw + Math.round(8 * u), mid);
      }

      ctx.fillStyle = '#d4a84b';
      ctx.font = `bold ${scoreSize}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(String(item.score), w - pad, mid);
    }

    if (maxScrollY > 0) {
      const trackH = listH - Math.round(16 * u);
      const thumbH = Math.max(Math.round(36 * u), trackH * (listH / contentH));
      const thumbY = listTop + Math.round(8 * u) + (trackH - thumbH) * (scrollY / maxScrollY);
      const tx = w - Math.round(10 * u);
      ctx.fillStyle = 'rgba(69,46,39,0.1)';
      ctx.fillRect(tx, listTop + 8 * u, 5 * u, trackH);
      ctx.fillStyle = 'rgba(212,168,75,0.9)';
      ctx.fillRect(tx, thumbY, 5 * u, thumbH);
    }
  }
  ctx.restore();

  // 顶栏
  ctx.fillStyle = '#f8f1e6';
  ctx.fillRect(0, 0, w, headerH);
  ctx.strokeStyle = 'rgba(212,168,75,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, headerH);
  ctx.lineTo(w, headerH);
  ctx.stroke();
  ctx.fillStyle = '#452e27';
  ctx.font = `bold ${titleSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('好友排行', w / 2, headerH * 0.5);

  // 底栏：展示本地权威分
  ctx.fillStyle = '#f8f1e6';
  ctx.fillRect(0, h - tipsH, w, tipsH);
  ctx.strokeStyle = 'rgba(212,168,75,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, h - tipsH);
  ctx.lineTo(w, h - tipsH);
  ctx.stroke();
  ctx.fillStyle = 'rgba(69,46,39,0.55)';
  ctx.font = `${tipsSize}px sans-serif`;
  ctx.textAlign = 'center';
  let tip = `我的最高分 ${selfBest}`;
  if (list.length > 0) {
    tip += maxScrollY > 0 ? ` · 共 ${list.length} 位 · 滑动` : ` · 共 ${list.length} 位`;
  }
  ctx.fillText(tip, w / 2, h - tipsH * 0.5);
}

function resolveSelfProfile(cb) {
  // 子域获取自己的头像昵称，便于在好友列表中对齐
  if (typeof wx.getUserInfo !== 'function') {
    cb();
    return;
  }
  try {
    wx.getUserInfo({
      openIdList: ['selfOpenId'],
      lang: 'zh_CN',
      success: (res) => {
        const u = (res.data && res.data[0]) || (res.userInfo) || null;
        if (u) {
          selfAvatar = u.avatarUrl || selfAvatar;
          selfName = u.nickName || u.nickname || selfName;
        }
        cb();
      },
      fail: () => cb(),
    });
  } catch (_) {
    cb();
  }
}

function fetchList() {
  if (typeof wx === 'undefined' || !wx.getFriendCloudStorage) {
    list = [];
    applySelfScore();
    paint();
    return;
  }

  resolveSelfProfile(() => {
    wx.getFriendCloudStorage({
      keyList: ['score'],
      success: (res) => {
        list = (res.data || []).map((u) => {
          let score = 0;
          const kv = (u.KVDataList || []).find((x) => x.key === 'score');
          if (kv) score = scoreOf(kv.value);
          return {
            name: u.nickname || '好友',
            avatar: u.avatarUrl || '',
            score,
            isSelf: false,
          };
        });
        applySelfScore();
        scrollY = 0;
        list.forEach((item) => loadAvatar(item.avatar));
        paint();
      },
      fail: () => {
        list = [];
        applySelfScore();
        paint();
      },
    });
  });
}

wx.onMessage((msg) => {
  if (!msg || !msg.command) return;
  if (msg.command === 'show') {
    selfBest = scoreOf(msg.score);
    scrollY = 0;
    fetchList();
  } else if (msg.command === 'scroll') {
    if (!ensure()) return;
    scrollY = Math.max(0, (Number(msg.y) || 0) * (canvas.height / LOGIC_H));
    paint();
  }
});

ensure();
