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

  gravity: 2200,
  restitution: 0.22,
  friction: 0.1,
  dropVy: 180,

  dropCooldown: 0.4,
  maxLevel: 10,
  spawnableLevels: 3,
  /**
   * 得分：合成「两个 Lv.N → Lv.N+1」时按被合成等级计分
   * index 0 = 合成出 Lv2 的分，…，index 8 = 合成出 Lv10，index 9 预留给满级事件
   */
  scoreTable: [1, 2, 4, 8, 16, 32, 64, 128, 256, 1000],
  /**
   * 连击加成：同一次下落内连续合成
   * 实际得分 = base * min(1 + (combo-1)*comboBonusRate, comboMaxMult)
   * combo=1 → 1x；combo=2 → 1.5x；combo=3 → 2x … 上限 comboMaxMult
   */
  comboBonusRate: 0.5,
  comboMaxMult: 4,
  /**
   * Lv6–10 再收一档，减轻满屏挤压。
   * 两只 Lv8：152×4=608，加墙仍低于 720；Lv10 直径约半屏。
   */
  radii: [30, 50, 70, 90, 106, 120, 136, 152, 168, 184],

  /** 两只猫吸向中点的时长（秒），让玩家看清 1+1 */
  mergeAbsorbTime: 0.2,
  /** 新猫弹出后再等这么久才允许下一次合成，看清 2、再 2+2→3 */
  mergeLockTime: 0.26,
  /** 新猫弹出动画时长 */
  mergePopTime: 0.22,

  deadlineStableTime: 1.2,
  deadlineMinLife: 0.7,

  storageKey: 'highestScore_Cat',
  cloudScoreKey: 'score',
  guideKey: 'guideSeen_Cat_v1',
  settingsKey: 'settings_Cat_v1',

  /**
   * 每帧物理子步数。一帧 dt 会拆成 dt/subSteps 连跑这么多次。
   * 2：够用，下落和堆叠手感正常。不要再改成 3——
   * 子步越多，同一帧里分离/阻尼/合成会多做一轮，容易把堆往上顶、下落变肉。
   */
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
