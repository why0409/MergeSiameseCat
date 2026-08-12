/** 全局配置 */
const GameConfig = {
  designWidth: 720,
  designHeight: 1280,

  wallPadding: 16,
  /**
   * 场地纵坐标（向下为正）
   * - spawn / 危险线在顶部投放区附近（同类玩法惯例）
   * - floor 贴设计底
   */
  spawnY: 160,
  /** 危险线：投放点下方一点，不要画在屏幕正中 */
  deadlineY: 300,
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

  /** 越过危险线后持续该秒数结束 */
  deadlineStableTime: 1.2,
  /** 猫在场超过该秒数才参与危险判定（跳过刚投下穿过的阶段） */
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

module.exports = GameConfig;
