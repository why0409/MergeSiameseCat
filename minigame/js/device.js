/**
 * 设备信息与安全区（微信小游戏 / 浏览器）
 */
function readSystemInfo() {
  if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
    try {
      return wx.getSystemInfoSync() || {};
    } catch (_) {
      return {};
    }
  }
  return {
    windowWidth: (typeof window !== 'undefined' && window.innerWidth) || 375,
    windowHeight: (typeof window !== 'undefined' && window.innerHeight) || 667,
    pixelRatio: (typeof window !== 'undefined' && window.devicePixelRatio) || 2,
    statusBarHeight: 0,
  };
}

function readMenuButtonRect() {
  if (typeof wx !== 'undefined' && wx.getMenuButtonBoundingClientRect) {
    try {
      return wx.getMenuButtonBoundingClientRect() || null;
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * 汇总布局用设备参数（逻辑像素）
 */
function getDeviceLayout() {
  const sys = readSystemInfo();
  const w = Math.max(1, sys.windowWidth || sys.screenWidth || 375);
  const h = Math.max(1, sys.windowHeight || sys.screenHeight || 667);
  const dpr = sys.pixelRatio || sys.devicePixelRatio || 2;

  // 安全区（刘海 / 底部横条）
  const safe = sys.safeArea || null;
  const safeTopPx = safe
    ? Math.max(0, safe.top || 0)
    : Math.max(0, sys.statusBarHeight || 0);
  const safeBottomPx = safe
    ? Math.max(0, h - (safe.bottom || h))
    : 0;
  const safeLeftPx = safe ? Math.max(0, safe.left || 0) : 0;
  const safeRightPx = safe ? Math.max(0, w - (safe.right || w)) : 0;

  // 微信右上角胶囊
  const menu = readMenuButtonRect();
  let menuBottomPx = 0;
  let menuLeftPx = w;
  if (menu && menu.bottom) {
    menuBottomPx = menu.bottom;
    menuLeftPx = menu.left != null ? menu.left : w;
  }

  // HUD 需要避开状态栏 + 胶囊
  const hudTopPx = Math.max(safeTopPx, menuBottomPx > 0 ? menuBottomPx + 6 : safeTopPx);

  return {
    windowWidth: w,
    windowHeight: h,
    pixelRatio: Math.min(3, Math.max(1, dpr)),
    safeTopPx,
    safeBottomPx,
    safeLeftPx,
    safeRightPx,
    hudTopPx,
    menuLeftPx,
    menuBottomPx,
    platform: sys.platform || 'unknown',
    model: sys.model || '',
  };
}

module.exports = {
  getDeviceLayout,
  readSystemInfo,
};
