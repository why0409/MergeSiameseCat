/** 全局配置（会随设备自动适配） */
const GameConfig = {
  designWidth: 720,
  designHeight: 1280,
  baseDesignHeight: 1280,

  wallPadding: 16,
  spawnY: 150,
  deadlineY: 260,
  floorY: 1260,
  spawnXLimit: 330,

  /** 安全区（设计坐标，由 applyScreenLayout 写入） */
  safeTop: 0,
  safeBottom: 0,
  safeLeft: 0,
  safeRight: 0,
  /** HUD 顶边（避开状态栏/胶囊） */
  hudTop: 0,
  hudHeight: 72,
  /** 微信胶囊左缘（设计坐标），BEST 等勿越过 */
  menuLeft: 720,

  gravity: 2100,
  restitution: 0.18,
  friction: 0.14,
  dropVy: 120,

  dropCooldown: 0.4,
  maxLevel: 10,
  spawnableLevels: 3,
  scoreTable: [1, 2, 4, 8, 16, 32, 64, 128, 256, 1000],
  radii: [30, 50, 70, 90, 110, 130, 155, 175, 200, 230],

  deadlineStableTime: 1.2,
  deadlineMinLife: 0.7,

  storageKey: 'highestScore_Cat',
  cloudScoreKey: 'score',
  guideKey: 'guideSeen_Cat_v1',
  settingsKey: 'settings_Cat_v1',

  subSteps: 2,

  theme: {
    cream: '#f8f1e6',
    creamSoft: '#fffaf2',
    chocolate: '#452e27',
    chocolateMid: '#5c4033',
    sealPoint: '#3a2a24',
    blueEye: '#5aa0d2',
    gold: '#d4a84b',
    goldSoft: '#e8c878',
    danger: '#dc4646',
    dangerSoft: 'rgba(255,120,100,0.9)',
    overlay: 'rgba(40,28,24,0.72)',
    buttonFill: '#e8c48c',
    buttonPressed: '#c8a064',
    secondaryBtn: '#b4d2e6',
    combo: '#d4643c',
    white: '#ffffff',
    guide: 'rgba(90,160,210,0.45)',
    ground: '#e8dcc8',
  },
};

/**
 * 根据设备信息自动适配设计坐标系
 * @param {object} device getDeviceLayout() 返回值
 */
function applyScreenLayout(device) {
  const w = Math.max(1, (device && device.windowWidth) || 375);
  const h = Math.max(1, (device && device.windowHeight) || 667);
  const scale = w / GameConfig.designWidth;

  // 与屏幕同比例的设计高度 → 铺满竖屏
  let designH = Math.round(GameConfig.designWidth * (h / w));
  if (designH < 1100) designH = 1100;
  if (designH > 1900) designH = 1900;
  GameConfig.designHeight = designH;

  // 屏幕像素 → 设计坐标
  const toDesign = (px) => (px || 0) / scale;

  GameConfig.safeTop = toDesign(device.safeTopPx || 0);
  GameConfig.safeBottom = toDesign(device.safeBottomPx || 0);
  GameConfig.safeLeft = toDesign(device.safeLeftPx || 0);
  GameConfig.safeRight = toDesign(device.safeRightPx || 0);
  GameConfig.hudTop = toDesign(device.hudTopPx || 0);
  GameConfig.menuLeft = toDesign(device.menuLeftPx != null ? device.menuLeftPx : w);

  // HUD 高度随顶部安全区略增
  GameConfig.hudHeight = 64 + Math.min(40, GameConfig.hudTop * 0.15);

  // 投放点 / 危险线：在 HUD 下方
  const topPad = GameConfig.hudTop + GameConfig.hudHeight;
  GameConfig.spawnY = topPad + 70;
  GameConfig.deadlineY = topPad + 160;

  // 地面：贴底并避开 Home 指示条
  GameConfig.floorY = designH - Math.max(20, GameConfig.safeBottom + 12);

  // 左右墙可略吃进安全区
  GameConfig.wallPadding = Math.max(12, GameConfig.safeLeft + 8);

  return {
    designWidth: GameConfig.designWidth,
    designHeight: designH,
    scale,
  };
}

GameConfig.applyScreenLayout = applyScreenLayout;

module.exports = GameConfig;
