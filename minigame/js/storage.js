/**
 * 本地最高分 + 微信云存储
 * 约定：本地为权威；上云保证 rank 与 BEST 一致
 */
const GameConfig = require('./config');

const isWx = typeof wx !== 'undefined';

function getHighScore() {
  try {
    if (isWx && wx.getStorageSync) {
      return Number(wx.getStorageSync(GameConfig.storageKey)) || 0;
    }
    if (typeof localStorage !== 'undefined') {
      return Number(localStorage.getItem(GameConfig.storageKey)) || 0;
    }
  } catch (_) { /* ignore */ }
  return 0;
}

function setHighScore(score) {
  const s = String(Math.floor(Number(score) || 0));
  try {
    if (isWx && wx.setStorageSync) wx.setStorageSync(GameConfig.storageKey, s);
    if (typeof localStorage !== 'undefined') localStorage.setItem(GameConfig.storageKey, s);
  } catch (_) { /* ignore */ }
}

/** 是否有未成功上云的破纪录分 */
let dirty = false;

function markCloudDirty() {
  dirty = true;
}

/**
 * 上传最高分到微信托管数据（排行榜用 key: score）
 * @param {number} highScore
 * @param {{ force?: boolean, onDone?: function }} opt
 *   force: 忽略 dirty，始终上传（打开排行榜 / 结算时用）
 */
function syncScoreToCloud(highScore, opt) {
  const opts = opt || {};
  const score = Math.floor(Number(highScore) || 0);
  const done = typeof opts.onDone === 'function' ? opts.onDone : null;

  if (!isWx || !wx.setUserCloudStorage) {
    dirty = false;
    if (done) done(false);
    return;
  }
  if (!opts.force && !dirty) {
    if (done) done(true);
    return;
  }

  wx.setUserCloudStorage({
    KVDataList: [{ key: GameConfig.cloudScoreKey, value: String(score) }],
    success: () => {
      dirty = false;
      if (done) done(true);
    },
    fail: (err) => {
      dirty = true;
      console.warn('[storage] cloud upload fail', err);
      if (done) done(false);
    },
  });
}

function bindOnHide(getHigh) {
  if (isWx && wx.onHide) {
    wx.onHide(() => syncScoreToCloud(getHigh(), { force: true }));
  }
}

function isGuideSeen() {
  try {
    if (isWx && wx.getStorageSync) {
      return !!wx.getStorageSync(GameConfig.guideKey);
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(GameConfig.guideKey) === '1';
    }
  } catch (_) { /* ignore */ }
  return false;
}

function setGuideSeen() {
  try {
    if (isWx && wx.setStorageSync) wx.setStorageSync(GameConfig.guideKey, '1');
    if (typeof localStorage !== 'undefined') localStorage.setItem(GameConfig.guideKey, '1');
  } catch (_) { /* ignore */ }
}

const DEFAULT_SETTINGS = {
  vibrate: true,
  sound: true,
};

function _readRaw(key) {
  try {
    if (isWx && wx.getStorageSync) return wx.getStorageSync(key);
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch (_) { /* ignore */ }
  return null;
}

function _writeRaw(key, val) {
  try {
    if (isWx && wx.setStorageSync) wx.setStorageSync(key, val);
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
  } catch (_) { /* ignore */ }
}

function getSettings() {
  const raw = _readRaw(GameConfig.settingsKey);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      vibrate: obj.vibrate !== false,
      sound: obj.sound !== false,
    };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function setSettings(partial) {
  const next = { ...getSettings(), ...partial };
  _writeRaw(GameConfig.settingsKey, JSON.stringify(next));
  return next;
}

module.exports = {
  getHighScore,
  setHighScore,
  markCloudDirty,
  syncScoreToCloud,
  bindOnHide,
  isGuideSeen,
  setGuideSeen,
  getSettings,
  setSettings,
};
