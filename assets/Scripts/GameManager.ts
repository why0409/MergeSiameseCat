import { _decorator, Component, Node, PhysicsSystem2D, EPhysics2DDrawFlags, Vec2, log, Prefab, instantiate, Vec3, Label, director, Color, Graphics, UITransform, Button, EventHandler, tween, Tween, UIOpacity } from 'cc';
import { WeChatRank } from './WeChatRank';

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

    @property({ type: Node, tooltip: '游戏结束面板' })
    public gameOverPanel: Node = null!;

    @property({ type: WeChatRank, tooltip: '微信排行榜组件' })
    public weChatRank: WeChatRank = null!;

    @property({ type: Label, tooltip: '连击提示 Label' })
    public comboLabel: Label = null!;

    @property
    public currentScore: number = 0;

    @property
    public highScore: number = 0;

    public isGameOver: boolean = false;

    private comboCount: number = 0;
    private scoreTable: number[] = [1, 2, 4, 8, 16, 32, 64, 128, 256, 1000];

    onLoad() {
        GameManager._instance = this;
        PhysicsSystem2D.instance.enable = true;
        PhysicsSystem2D.instance.gravity = new Vec2(0, -960);
        PhysicsSystem2D.instance.debugDrawFlags = 0;
        this.highScore = Number(director.getScene()?.name === 'scene' ? localStorage.getItem('highestScore_Cat') : 0) || 0;
    }

    start() {
        if (this.scoreLabel) this.scoreLabel.string = "0";
        if (this.highScoreLabel) this.highScoreLabel.string = `BEST: ${this.highScore}`;
        if (this.gameOverPanel) this.gameOverPanel.active = false;
        if (this.comboLabel) this.comboLabel.node.active = false;
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

        this.scheduleOnce(() => {
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
        });
    }

    private showComboUI(count: number) {
        if (!this.comboLabel) return;
        const node = this.comboLabel.node;
        node.active = true;
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
            if (typeof wx !== 'undefined') {
                wx.setUserCloudStorage({
                    KVDataList: [{ key: 'score', value: this.highScore.toString() }],
                    success: () => { console.log('Score uploaded to WeChat'); }
                });
            }
            if (this.highScoreLabel) this.highScoreLabel.string = `BEST: ${this.highScore}`;
        }
    }

    public gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        console.warn("GAME OVER!");
        PhysicsSystem2D.instance.enable = false;

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
