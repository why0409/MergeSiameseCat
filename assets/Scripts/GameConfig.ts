import { Color, Vec2 } from 'cc';

/**
 * 全局可调参数与暹罗主题色板。
 * 玩法数值、存储 key、UI 色都集中在此，避免魔法数散落。
 */
export const GameConfig = {
    /** 设计分辨率宽（Canvas） */
    designWidth: 720,
    /** 生成/拖拽 X 轴半宽限制 */
    spawnXLimit: 320,
    /** 下落冷却（秒） */
    dropCooldown: 0.4,
    /** 物理重力 */
    gravity: new Vec2(0, -960),
    /** 最高等级（1-based） */
    maxLevel: 10,
    /** 随机生成可用的最低等级数量（Lv1–LvN） */
    spawnableLevels: 3,
    /** 合成得分表：index = level-1（合成该级时得分） */
    scoreTable: [1, 2, 4, 8, 16, 32, 64, 128, 256, 1000] as readonly number[],
    /** Deadline 稳定停留触发时间（秒） */
    deadlineStableTime: 2.0,
    /** 纵向速度大于该值视为“已停稳”（非快速下落） */
    deadlineStableVy: -1.0,
    /** 本机最高分 key */
    storageKey: 'highestScore_Cat',
    /** 微信云存储 key */
    cloudScoreKey: 'score',

    /** 暹罗猫主题色板 */
    theme: {
        /** 奶油底 / 面板填充 */
        cream: new Color(248, 241, 230, 255),
        creamSoft: new Color(255, 250, 242, 255),
        /** 深巧克力描边 / 主文字 */
        chocolate: new Color(69, 46, 39, 255),
        chocolateMid: new Color(92, 64, 51, 255),
        /** 重点色（面罩/耳朵） */
        sealPoint: new Color(58, 42, 36, 255),
        /** 暹罗蓝眼睛强调色 */
        blueEye: new Color(90, 160, 210, 255),
        blueEyeSoft: new Color(160, 200, 230, 255),
        /** 金色点缀（皇冠/高分） */
        gold: new Color(212, 168, 75, 255),
        goldSoft: new Color(232, 200, 120, 255),
        /** 危险线 */
        danger: new Color(220, 70, 70, 255),
        dangerSoft: new Color(255, 120, 100, 255),
        /** 遮罩半透明 */
        overlay: new Color(40, 28, 24, 180),
        /** 按钮填充 */
        buttonFill: new Color(232, 196, 140, 255),
        buttonPressed: new Color(200, 160, 100, 255),
        buttonText: new Color(69, 46, 39, 255),
        /** 排行榜 / 次要按钮 */
        secondaryBtn: new Color(180, 210, 230, 255),
        white: new Color(255, 255, 255, 255),
        scoreText: new Color(92, 64, 51, 255),
        combo: new Color(212, 100, 60, 255),
    },
} as const;

export type GameTheme = typeof GameConfig.theme;
