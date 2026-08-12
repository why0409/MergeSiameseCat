/**
 * 简易音效（WebAudio 振荡器，无需音频文件）
 * 受 settings.sound 控制
 */
let ctx = null;
let enabled = true;

function setEnabled(on) {
  enabled = !!on;
}

function ensureCtx() {
  if (ctx) return ctx;
  const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
    || (typeof AudioContext !== 'undefined' ? AudioContext : null);
  // 微信小游戏：部分基础库提供 wx.createWebAudioContext
  if (!AC && typeof wx !== 'undefined' && wx.createWebAudioContext) {
    try {
      ctx = wx.createWebAudioContext();
      return ctx;
    } catch (_) { /* ignore */ }
  }
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch (_) {
    ctx = null;
  }
  return ctx;
}

/** 用户手势后解锁（浏览器自动播放策略） */
function unlock() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended' && c.resume) {
    c.resume().catch(() => {});
  }
}

function beep(freq, dur, type, gain) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended' && c.resume) c.resume();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (_) { /* ignore */ }
}

function play(name, level) {
  if (!enabled) return;
  switch (name) {
    case 'drop':
      beep(220, 0.08, 'triangle', 0.06);
      break;
    case 'merge': {
      const f = 320 + Math.min(9, (level || 1) - 1) * 36;
      beep(f, 0.1, 'sine', 0.09);
      setTimeout(() => beep(f * 1.33, 0.12, 'sine', 0.07), 50);
      break;
    }
    case 'gameover':
      beep(180, 0.15, 'sawtooth', 0.05);
      setTimeout(() => beep(140, 0.2, 'sawtooth', 0.05), 120);
      break;
    case 'ui':
      beep(520, 0.05, 'square', 0.03);
      break;
    case 'combo':
      beep(660, 0.08, 'sine', 0.07);
      break;
    default:
      break;
  }
}

module.exports = {
  setEnabled,
  unlock,
  play,
};
