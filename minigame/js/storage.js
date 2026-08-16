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

/**
 * 删除小程序会清本地存储，托管分还在。启动时把云端更高的分写回本地。
 * @param {(score: number) => void} [onScore]
 */
function restoreHighScoreFromCloud(onScore) {
  const local = getHighScore();
  const done = (score) => {
    if (typeof onScore === 'function') onScore(score);
  };
  if (!isWx || !wx.getUserCloudStorage) {
    done(local);
    return;
  }
  try {
    wx.getUserCloudStorage({
      keyList: [GameConfig.cloudScoreKey, GameConfig.svipCloudKey || 'svip'],
      success: (res) => {
        let cloud = 0;
        let svipOn = false;
        const list = (res && res.KVDataList) || [];
        for (let i = 0; i < list.length; i++) {
          const row = list[i];
          if (!row) continue;
          if (row.key === GameConfig.cloudScoreKey) {
            cloud = parseInt(row.value, 10) || 0;
          } else if (row.key === (GameConfig.svipCloudKey || 'svip')) {
            svipOn = String(row.value) === '1';
          }
        }
        const best = Math.max(local, cloud);
        if (best > local) setHighScore(best);
        if (svipOn && !getSettings().goldName) setSettings({ goldName: true });
        done(best);
      },
      fail: () => done(local),
    });
  } catch (_) {
    done(local);
  }
}

let _onShowRestore = null;

function bindCloudScore(onScore) {
  restoreHighScoreFromCloud(onScore);
  if (!isWx || !wx.onShow) return;
  if (_onShowRestore && wx.offShow) {
    try { wx.offShow(_onShowRestore); } catch (_) { /* ignore */ }
  }
  _onShowRestore = () => restoreHighScoreFromCloud(onScore);
  wx.onShow(_onShowRestore);
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

  const svip = !!(opts.svip != null ? opts.svip : isGoldActive());
  wx.setUserCloudStorage({
    KVDataList: [
      { key: GameConfig.cloudScoreKey, value: String(score) },
      { key: GameConfig.svipCloudKey || 'svip', value: svip ? '1' : '0' },
    ],
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

let _onHide = null;

function bindOnHide(getHigh) {
  unbindOnHide();
  if (!isWx || !wx.onHide) return;
  _onHide = () => syncScoreToCloud(getHigh(), { force: true });
  wx.onHide(_onHide);
}

function unbindOnHide() {
  if (!_onHide) return;
  try {
    if (isWx && wx.offHide) wx.offHide(_onHide);
  } catch (_) { /* ignore */ }
  _onHide = null;
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
  goldName: false,
};

function isGoldActive(s) {
  const st = s || getSettings();
  return !!st.goldName;
}

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
      goldName: !!obj.goldName,
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
  restoreHighScoreFromCloud,
  bindCloudScore,
  markCloudDirty,
  syncScoreToCloud,
  bindOnHide,
  unbindOnHide,
  isGuideSeen,
  setGuideSeen,
  getSettings,
  setSettings,
  isGoldActive,
};
