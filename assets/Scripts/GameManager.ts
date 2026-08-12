import {
    _decorator, Component, Node, PhysicsSystem2D, Vec2, log, Prefab, instantiate, Vec3,
    Label, director, Button, EventHandler, tween, Tween, UIOpacity, find,
} from 'cc';
import { WeChatRank } from './WeChatRank';
import { Spawner } from './Spawner';
import { GameConfig } from './GameConfig';
import { SiameseUITheme } from './SiameseUITheme';

const { ccclass, property } = _decorator;
const T = GameConfig.theme;

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager = null!;
    public static get instance() { return this._instance; }

    @property({ type: [Prefab], tooltip: '所有等级的猫咪预制体（权威列表；Spawner 优先读这里）' })
    public catPrefabs: Prefab[] = [];

    @property({ type: Node, tooltip: '猫咪容器' })
    public catContainer: Node = null!;

    @property({ type: Label, tooltip: '当前分数 Label' })
    public scoreLabel: Label = null!;

    @property({ type: Label, tooltip: '历史最高分 Label' })
    public highScoreLabel: Label = null!;

    @property({ type: Node, tooltip: '开始面板' })
    public startPanel: Node = null!;

    @property({ type: Node, tooltip: '游戏结束面板' })
    public gameOverPanel: Node = null!;

    @property({ type: WeChatRank, tooltip: '微信排行榜组件' })
    public weChatRank: WeChatRank = null!;

    @property({ type: Spawner, tooltip: '生成器组件' })
    public spawner: Spawner = null!;

    @property({ type: Label, tooltip: '连击提示 Label' })
    public comboLabel: Label = null!;

    @property
    public currentScore: number = 0;

    @property
    public highScore: number = 0;

    public isGameOver: boolean = false;

    private comboCount: number = 0;
    private pendingCloudSync: boolean = false;
    private _onHideHandler: (() => void) | null = null;

    onLoad() {
        GameManager._instance = this;
        SiameseUITheme.resetFlag();

        PhysicsSystem2D.instance.enable = true;
        PhysicsSystem2D.instance.gravity = GameConfig.gravity.clone();
        PhysicsSystem2D.instance.debugDrawFlags = 0;

        // 直接读本地最高分，不依赖场景名
        const raw = localStorage.getItem(GameConfig.storageKey);
        this.highScore = raw != null && raw !== '' ? (Number(raw) || 0) : 0;

        this.setupUI();
        this.bindWeChatLifecycle();
    }

    onDestroy() {
        this.unbindWeChatLifecycle();
        if (GameManager._instance === this) {
            GameManager._instance = null!;
        }
    }

    private bindWeChatLifecycle() {
        if (typeof wx === 'undefined') return;
        this._onHideHandler = () => {
            // 切后台时若有未上传的破纪录分，尝试补传
            this.syncScoreToCloud();
        };
        try {
            wx.onHide(this._onHideHandler);
        } catch (_) { /* ignore */ }
    }

    private unbindWeChatLifecycle() {
        if (typeof wx === 'undefined' || !this._onHideHandler) return;
        try {
            if (typeof wx.offHide === 'function') {
                wx.offHide(this._onHideHandler);
            }
        } catch (_) { /* ignore */ }
        this._onHideHandler = null;
    }

    private setupUI() {
        const canvas = find('Canvas');
        if (canvas) SiameseUITheme.apply(canvas);

        const closeBtnNode = find('Canvas/RankPanel/CloseButton');
        if (closeBtnNode) {
            const label = closeBtnNode.getComponentInChildren(Label);
            if (label) {
                label.string = '关闭';
                label.fontSize = 30;
                label.color = T.buttonText;
            }
            closeBtnNode.setPosition(0, -480, 0);

            let btn = closeBtnNode.getComponent(Button);
            if (btn && btn.clickEvents.length === 0 && this.weChatRank) {
                const eventHandler = new EventHandler();
                eventHandler.target = this.weChatRank.node;
                eventHandler.component = 'WeChatRank';
                eventHandler.handler = 'hideFriendRank';
                btn.clickEvents.push(eventHandler);
            }
        }

        const startBtnNode = find('Canvas/StartButton');
        if (startBtnNode) {
            let btn = startBtnNode.getComponent(Button);
            if (btn && btn.clickEvents.length === 0) {
                const eventHandler = new EventHandler();
                eventHandler.target = this.node;
                eventHandler.component = 'GameManager';
                eventHandler.handler = 'startGame';
                btn.clickEvents.push(eventHandler);
            }
        }
    }

    start() {
        if (this.scoreLabel) {
            this.scoreLabel.string = '0';
            this.scoreLabel.color = T.scoreText;
        }
        if (this.highScoreLabel) {
            this.highScoreLabel.string = `BEST: ${this.highScore}`;
            this.highScoreLabel.color = T.gold;
        }
        if (this.gameOverPanel) this.gameOverPanel.active = false;
        if (this.comboLabel) this.comboLabel.node.active = false;

        if (this.startPanel) {
            this.startPanel.active = true;
            this.startPanel.setSiblingIndex(
                this.startPanel.parent ? this.startPanel.parent.children.length - 1 : 999,
            );
        } else {
            log('GameManager: startPanel is not assigned.');
        }
    }

    public startGame() {
        log('GameManager: startGame called');
        if (this.startPanel) this.startPanel.active = false;
        if (this.spawner) {
            this.spawner.startGame();
        } else {
            const spawnerNode = find('Canvas/Spawner');
            if (spawnerNode) {
                const spawner = spawnerNode.getComponent(Spawner);
                if (spawner) spawner.startGame();
            }
        }
    }

    public resetCombo() {
        this.comboCount = 0;
    }

    public mergeCats(currentLevel: number, worldPos: Vec3) {
        if (this.isGameOver || currentLevel >= GameConfig.maxLevel) return;

        this.comboCount++;
        if (this.comboCount > 1) this.showComboUI(this.comboCount);

        const scoreIdx = currentLevel - 1;
        const points = GameConfig.scoreTable[scoreIdx] ?? 0;
        this.addScore(points);
        if (typeof wx !== 'undefined') wx.vibrateShort({ type: 'medium' });

        const nextLevel = currentLevel + 1;
        const nextPrefab = this.catPrefabs[nextLevel - 1];

        if (nextPrefab) {
            const newNode = instantiate(nextPrefab);
            const container = this.catContainer || this.node.scene.getChildByName('Canvas');

            if (container) {
                container.addChild(newNode);
                newNode.setWorldPosition(worldPos);

                newNode.setScale(new Vec3(0, 0, 1));
                tween(newNode)
                    .to(0.2, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'backOut' })
                    .to(0.1, { scale: new Vec3(1, 1, 1) })
                    .start();
            }
        }
    }

    private showComboUI(count: number) {
        if (!this.comboLabel) return;
        const node = this.comboLabel.node;
        node.active = true;
        node.setSiblingIndex(node.parent ? node.parent.children.length - 1 : 999);
        this.comboLabel.string = `Combo x${count}`;
        this.comboLabel.color = T.combo;

        const uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        // 必须同时停掉 node 与 opacity 上的旧 tween，避免连击竞态把透明度拉没
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(uiOpacity);

        node.setScale(new Vec3(0.5, 0.5, 1));
        uiOpacity.opacity = 255;

        tween(node)
            .to(0.15, { scale: new Vec3(1.5, 1.5, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: new Vec3(1.2, 1.2, 1) })
            .delay(0.5)
            .call(() => {
                tween(uiOpacity)
                    .to(0.3, { opacity: 0 })
                    .call(() => {
                        if (this.comboCount <= 1) node.active = false;
                    })
                    .start();
            })
            .start();
    }

    public addScore(points: number) {
        if (this.isGameOver) return;
        this.currentScore += points;
        if (this.scoreLabel) {
            this.scoreLabel.string = this.currentScore.toString();
            Tween.stopAllByTarget(this.scoreLabel.node);
            this.scoreLabel.node.setScale(new Vec3(1, 1, 1));
            tween(this.scoreLabel.node)
                .to(0.08, { scale: new Vec3(1.3, 1.3, 1) })
                .to(0.1, { scale: new Vec3(1, 1, 1) })
                .start();
        }

        if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
            localStorage.setItem(GameConfig.storageKey, this.highScore.toString());
            this.pendingCloudSync = true;
            if (this.highScoreLabel) {
                this.highScoreLabel.string = `BEST: ${this.highScore}`;
            }
        }
    }

    private syncScoreToCloud() {
        if (!this.pendingCloudSync) return;
        if (typeof wx === 'undefined') {
            this.pendingCloudSync = false;
            return;
        }
        const value = this.highScore.toString();
        // 先清标记，避免并发重复；失败时再置回
        this.pendingCloudSync = false;
        wx.setUserCloudStorage({
            KVDataList: [{ key: GameConfig.cloudScoreKey, value }],
            success: () => { console.log('Score uploaded to WeChat'); },
            fail: (err: any) => {
                console.warn('Score upload failed, will retry later', err);
                this.pendingCloudSync = true;
            },
        });
    }

    public gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;

        console.warn('GAME OVER!');
        PhysicsSystem2D.instance.enable = false;

        // 清理生成器：取消冷却、销毁瞄准中的猫
        if (this.spawner) {
            this.spawner.onGameOver();
        } else {
            const spawnerNode = find('Canvas/Spawner');
            spawnerNode?.getComponent(Spawner)?.onGameOver();
        }

        this.syncScoreToCloud();

        if (this.gameOverPanel && this.gameOverPanel.isValid) {
            this.gameOverPanel.active = true;
            this.gameOverPanel.setSiblingIndex(
                this.gameOverPanel.parent ? this.gameOverPanel.parent.children.length - 1 : 999,
            );

            // 优先按节点名找 FinalScoreLabel，避免 labels[1] 顺序依赖
            const finalNode = find('ContentBox/FinalScoreLabel', this.gameOverPanel)
                || this.gameOverPanel.getChildByName('FinalScoreLabel');
            let scoreDisplay: Label | null = finalNode?.getComponent(Label) ?? null;
            if (!scoreDisplay) {
                const labels = this.gameOverPanel.getComponentsInChildren(Label);
                scoreDisplay = labels.find(l => l.node.name === 'FinalScoreLabel') || null;
            }
            if (scoreDisplay) {
                scoreDisplay.string = `最终得分: ${this.currentScore}`;
                scoreDisplay.color = T.scoreText;
            }
        } else if (typeof wx !== 'undefined') {
            wx.showModal({
                title: '游戏结束',
                content: `最终得分: ${this.currentScore}`,
                confirmText: '看排行榜',
                cancelText: '再来一局',
                success: (res) => {
                    if (res.confirm) {
                        if (this.weChatRank) this.weChatRank.showFriendRank();
                    } else {
                        this.restartGame();
                    }
                },
            });
        } else {
            alert(`Game Over! Score: ${this.currentScore}`);
            this.restartGame();
        }
    }

    public restartGame() {
        this.isGameOver = false;
        PhysicsSystem2D.instance.enable = true;
        const sceneName = director.getScene()?.name || 'scene';
        director.loadScene(sceneName);
    }
}
