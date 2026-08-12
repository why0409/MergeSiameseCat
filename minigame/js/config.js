/** 全局配置 */
const GameConfig = {
  designWidth: 720,
  designHeight: 1280,

  wallPadding: 20,
  floorY: 1180,
  /** 危险线 y（向下为正，越小越靠上） */
  deadlineY: 250,
  spawnY: 150,
  spawnXLimit: 320,

  /** 重力（略慢于先前，更从容） */
  gravity: 2100,
  restitution: 0.2,
  friction: 0.14,

  /** 松手初速度（向下） */
  dropVy: 120,

  dropCooldown: 0.4,
  maxLevel: 10,
  spawnableLevels: 3,
  scoreTable: [1, 2, 4, 8, 16, 32, 64, 128, 256, 1000],
  radii: [30, 50, 70, 90, 110, 130, 155, 175, 200, 230],

  deadlineStableTime: 1.5,
  /** 停稳速度阈值：|v| 小于此才算堆在危险线上 */
  deadlineSettleSpeed: 55,

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
  },
};

module.exports = GameConfig;
