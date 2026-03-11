import { _decorator, Component, Node, PhysicsSystem2D, EPhysics2DDrawFlags, Vec2, log, Prefab, instantiate, Vec3, Label, director } from 'cc';
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
        
        PhysicsSystem2D.instance.debugDrawFlags = EPhysics2DDrawFlags.Pair | 
            EPhysics2DDrawFlags.CenterOfMass | 
            EPhysics2DDrawFlags.Shape;
    }

    start() {
        if (this.scoreLabel) {
            console.log("[GameManager] Score Label linked successfully!");
            this.scoreLabel.string = "0";
        } else {
            console.error("[GameManager] ERROR: Score Label is NOT linked in Inspector!");
        }

        if (this.highScoreLabel) {
            this.highScoreLabel.string = "BEST: 0";
        }
        
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }
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
            if (this.highScoreLabel) {
                this.highScoreLabel.string = `BEST: ${this.highScore}`;
            }
        }
    }

    public gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        if (this.gameOverPanel) {
            this.gameOverPanel.active = true;
        }
        
        console.error("GAME OVER!");
    }

    public restartGame() {
        // 重启当前场景
        const sceneName = director.getScene()?.name || 'scene';
        director.loadScene(sceneName);
    }
}
