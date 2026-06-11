import { _decorator, Component, Node, PhysicsSystem2D, EPhysics2DDrawFlags, Vec2, log, Prefab, instantiate, Vec3, Label, director, Color, Graphics, UITransform, Button, EventHandler, tween, Tween, UIOpacity, find } from 'cc';
import { WeChatRank } from './WeChatRank';
import { Spawner } from './Spawner';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager = null!;
    public static get instance() { return this._instance; }

    @property({ type: [Prefab], tooltip: '所有等级的猫咪预制体' })
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
    private scoreTable: number[] = [1, 2, 4, 8, 16, 32, 64, 128, 256, 1000];
    // 本局是否刷新过纪录，等游戏结束时一次性上传云端，避免触发微信接口频率限制
    private pendingCloudSync: boolean = false;

    onLoad() {
        GameManager._instance = this;
        PhysicsSystem2D.instance.enable = true;
        PhysicsSystem2D.instance.gravity = new Vec2(0, -960);
        PhysicsSystem2D.instance.debugDrawFlags = 0;
        this.highScore = Number(director.getScene()?.name === 'scene' ? localStorage.getItem('highestScore_Cat') : 0) || 0;
        
        this.setupUI();
    }

    private setupUI() {
        // 1. 处理排行榜关闭按钮的文字和位置
        const closeBtnNode = find("Canvas/RankPanel/CloseButton");
        if (closeBtnNode) {
            const label = closeBtnNode.getComponentInChildren(Label);
            if (label) {
                label.string = "关闭";
                label.fontSize = 30;
            }
            // 调整位置到下方
            closeBtnNode.setPosition(0, -480, 0);
            
            // 确保按钮有点击事件（如果场景里没配好）
            let btn = closeBtnNode.getComponent(Button);
            if (btn && btn.clickEvents.length === 0) {
                const eventHandler = new EventHandler();
                eventHandler.target = this.weChatRank.node;
                eventHandler.component = 'WeChatRank';
                eventHandler.handler = 'hideFriendRank';
                btn.clickEvents.push(eventHandler);
            }
        }

        // 2. 如果没有动态创建 StartPanel，尝试寻找它（如果用户在编辑器里手动加了）
        // 否则我们可以在这里用代码微调已有按钮
        const startBtnNode = find("Canvas/StartButton"); // 假设用户可能放了一个按钮在 Canvas 下
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
        if (this.scoreLabel) this.scoreLabel.string = "0";
        if (this.highScoreLabel) this.highScoreLabel.string = `BEST: ${this.highScore}`;
        if (this.gameOverPanel) this.gameOverPanel.active = false;
        if (this.comboLabel) this.comboLabel.node.active = false;
        
        // 确保开始面板在最前面并显示
        if (this.startPanel) {
            this.startPanel.active = true;
            this.startPanel.setSiblingIndex(this.startPanel.parent ? this.startPanel.parent.children.length - 1 : 999);
        } else {
            // 如果没配 startPanel，但有 Spawner，我们需要某种方式开始
            // 暂时保持现状，或者提醒用户
            log("GameManager: startPanel is not assigned.");
        }
    }

    /**
     * 点击开始游戏按钮调用
     */
    public startGame() {
        log("GameManager: startGame called");
        if (this.startPanel) this.startPanel.active = false;
        if (this.spawner) {
            this.spawner.startGame();
        } else {
            // 自动寻找 Spawner
            const spawnerNode = find("Canvas/Spawner");
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
        if (this.isGameOver || currentLevel >= 10) return;

        this.comboCount++;
        if (this.comboCount > 1) this.showComboUI(this.comboCount);

        this.addScore(this.scoreTable[currentLevel - 1]);
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
        // 确保连击提示在最顶层，不被猫咪遮挡
        node.setSiblingIndex(node.parent ? node.parent.children.length - 1 : 999);
        this.comboLabel.string = `Combo x${count}`;
        Tween.stopAllByTarget(node);
        node.setScale(new Vec3(0.5, 0.5, 1));
        const uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        uiOpacity.opacity = 255;
        tween(node)
            .to(0.15, { scale: new Vec3(1.5, 1.5, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: new Vec3(1.2, 1.2, 1) })
            .delay(0.5)
            .call(() => {
                tween(uiOpacity).to(0.3, { opacity: 0 }).call(() => {
                    if (this.comboCount <= 1) node.active = false;
                }).start();
            }).start();
    }

    public addScore(points: number) {
        if (this.isGameOver) return;
        this.currentScore += points;
        if (this.scoreLabel) {
            this.scoreLabel.string = this.currentScore.toString();
            tween(this.scoreLabel.node)
                .to(0.08, { scale: new Vec3(1.3, 1.3, 1) })
                .to(0.1, { scale: new Vec3(1, 1, 1) })
                .start();
        }

        if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
            localStorage.setItem('highestScore_Cat', this.highScore.toString());
            this.pendingCloudSync = true;
            if (this.highScoreLabel) this.highScoreLabel.string = `BEST: ${this.highScore}`;
        }
    }

    private syncScoreToCloud() {
        if (!this.pendingCloudSync) return;
        this.pendingCloudSync = false;
        if (typeof wx !== 'undefined') {
            wx.setUserCloudStorage({
                KVDataList: [{ key: 'score', value: this.highScore.toString() }],
                success: () => { console.log('Score uploaded to WeChat'); }
            });
        }
    }

    public gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        console.warn("GAME OVER!");
        PhysicsSystem2D.instance.enable = false;
        this.syncScoreToCloud();

        // 核心更新：如果存在面板，将其显示出来并更新里面的分数
        if (this.gameOverPanel && this.gameOverPanel.isValid) {
            this.gameOverPanel.active = true;
            
            // 强力保障：将面板移至最顶层，防止被猫咪或背景遮挡
            this.gameOverPanel.setSiblingIndex(this.gameOverPanel.parent ? this.gameOverPanel.parent.children.length - 1 : 999);
            
            // 查找专门命名的 Label 或寻找子节点中的分数 Label
            const labels = this.gameOverPanel.getComponentsInChildren(Label);
            const scoreDisplay = labels.find(l => l.node.name === 'FinalScoreLabel') || labels[1];
            if (scoreDisplay) {
                scoreDisplay.string = `最终得分: ${this.currentScore}`;
            }
        } 
        // 兜底方案：如果没有面板，依然使用微信弹窗
        else if (typeof wx !== 'undefined') {
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
                }
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
