import { _decorator, Component, Node, PhysicsSystem2D, EPhysics2DDrawFlags, Vec2, log, Prefab, instantiate, Vec3, Label, director, Color, Graphics, UITransform, Button, EventHandler } from 'cc';
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

    @property
    public currentScore: number = 0;

    @property
    public highScore: number = 0;

    public isGameOver: boolean = false;

    private scoreTable: number[] = [1, 2, 4, 8, 16, 32, 64, 128, 256, 1000];

    onLoad() {
        GameManager._instance = this;
        PhysicsSystem2D.instance.enable = true;
        PhysicsSystem2D.instance.gravity = new Vec2(0, -960);
        
        // 发布时关闭物理调试
        PhysicsSystem2D.instance.debugDrawFlags = 0;

        // 从本地读取历史最高分
        this.highScore = Number(director.getScene()?.name === 'scene' ? localStorage.getItem('highestScore_Cat') : 0) || 0;
    }

    start() {
        if (this.scoreLabel) this.scoreLabel.string = "0";
        if (this.highScoreLabel) this.highScoreLabel.string = `BEST: ${this.highScore}`;
        if (this.gameOverPanel) this.gameOverPanel.active = false;
    }

    public mergeCats(currentLevel: number, worldPos: Vec3) {
        if (this.isGameOver || currentLevel >= 10) return;

        this.addScore(this.scoreTable[currentLevel - 1]);

        this.scheduleOnce(() => {
            const nextLevel = currentLevel + 1;
            const nextPrefab = this.catPrefabs[nextLevel - 1];

            if (nextPrefab) {
                const newNode = instantiate(nextPrefab);
                const container = this.catContainer || this.node.scene.getChildByName('Canvas');
                
                if (container) {
                    container.addChild(newNode);
                    newNode.setWorldPosition(worldPos);
                    
                    // 播放一个简单的缩放动画（如果是 3.7.4 支持 Tween 的话）
                    newNode.setScale(new Vec3(0.1, 0.1, 1));
                    this.scheduleOnce(() => {
                        newNode.setScale(new Vec3(1, 1, 1));
                    }, 0.05);
                }
            }
        });
    }

    public addScore(points: number) {
        if (this.isGameOver) return;
        this.currentScore += points;
        
        if (this.scoreLabel) {
            this.scoreLabel.string = this.currentScore.toString();
        }

        if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
            localStorage.setItem('highestScore_Cat', this.highScore.toString());
            if (this.highScoreLabel) {
                this.highScoreLabel.string = `BEST: ${this.highScore}`;
            }
        }
    }

    public gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        console.warn("GAME OVER!");

        // 停止物理模拟
        PhysicsSystem2D.instance.enable = false;

        // 显示结算面板
        if (this.gameOverPanel) {
            this.gameOverPanel.active = true;
            // 尝试在面板里寻找显示最终分数的文本（可选）
            const finalScoreLabel = this.gameOverPanel.getComponentInChildren(Label);
            if (finalScoreLabel) {
                finalScoreLabel.string = `游戏结束\n得分: ${this.currentScore}`;
            }
        } else {
            // 如果你还没做面板，我用微信原生的弹窗提示你
            if (window['wx']) {
                window['wx'].showModal({
                    title: '游戏结束',
                    content: `你的得分是: ${this.currentScore}`,
                    confirmText: '重新开始',
                    showCancel: false,
                    success: () => { this.restartGame(); }
                });
            } else {
                alert(`Game Over! Score: ${this.currentScore}`);
                this.restartGame();
            }
        }
    }

    public restartGame() {
        console.log("Restarting...");
        this.isGameOver = false;
        const sceneName = director.getScene()?.name || 'scene';
        director.loadScene(sceneName);
    }
}
