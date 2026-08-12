/** 全局配置（designHeight 会随屏幕比例动态拉高，铺满全屏） */
const GameConfig = {
  designWidth: 720,
  /** 基准高度；实际高度由 applyScreenLayout 按屏宽比扩展 */
  designHeight: 1280,
  baseDesignHeight: 1280,

  wallPadding: 16,
  /**
   * 场地纵坐标（向下为正）
   * spawn / 危险线相对顶部固定；floor 贴实际 designHeight 底部
   */
  spawnY: 150,
  deadlineY: 260,
  floorY: 1260,
  spawnXLimit: 330,

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
 * 按屏幕尺寸扩展设计高度，使游戏内容铺满整屏（无上下大块 letterbox）
 * 宽度固定 720 设计像素；高度 = 720 * (屏高/屏宽)
 */
function applyScreenLayout(screenW, screenH) {
  const w = Math.max(1, screenW || 375);
  const h = Math.max(1, screenH || 667);
  // 与屏同比例的设计高度
  let designH = Math.round(GameConfig.designWidth * (h / w));
  // 合理范围，避免极端机型
  if (designH < 1100) designH = 1100;
  if (designH > 1800) designH = 1800;

  GameConfig.designHeight = designH;
  // 地面贴底；顶部投放区保持固定偏移
  GameConfig.floorY = designH - 24;
  GameConfig.spawnY = 150;
  GameConfig.deadlineY = 260;

  return {
    designWidth: GameConfig.designWidth,
    designHeight: designH,
    scale: w / GameConfig.designWidth,
  };
}

GameConfig.applyScreenLayout = applyScreenLayout;

module.exports = GameConfig;
