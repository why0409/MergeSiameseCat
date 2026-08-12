import {
    _decorator, Component, Node, Prefab, instantiate, Vec3, input, Input, EventTouch,
    RigidBody2D, ERigidBody2DType, EventMouse, UITransform, Graphics, Color, Vec2,
    Collider2D, Button,
} from 'cc';
import { GameManager } from './GameManager';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

@ccclass('Spawner')
export class Spawner extends Component {
    @property({ type: [Prefab], tooltip: '猫咪预制体列表(可选；优先使用 GameManager.catPrefabs)' })
    public catPrefabs: Prefab[] = [];

    @property({ type: Node, tooltip: '生成高度参考点' })
    public spawnPoint: Node = null!;

    @property({ type: Graphics, tooltip: '指引线组件' })
    public guideLine: Graphics = null!;

    private currentCat: Node | null = null;
    private isWaiting: boolean = false;
    private isTouching: boolean = false;
    private lastX: number = 0;
    private targetX: number = 0;
    private isGameStarted: boolean = false;
    private dropScheduleCb: (() => void) | null = null;

    start() {
        // 等待 startGame
    }

    public startGame() {
        if (this.isGameStarted) return;
        this.isGameStarted = true;
        this.targetX = (Math.random() - 0.5) * 400;
        this.createCat(this.targetX);
    }

    /** 游戏结束时清理瞄准猫与冷却调度 */
    public onGameOver() {
        this.isTouching = false;
        this.isWaiting = false;
        if (this.dropScheduleCb) {
            this.unschedule(this.dropScheduleCb);
            this.dropScheduleCb = null;
        }
        if (this.guideLine) this.guideLine.node.active = false;
        if (this.currentCat && this.currentCat.isValid) {
            this.currentCat.destroy();
        }
        this.currentCat = null;
    }

    onEnable() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    private getPrefabList(): Prefab[] {
        const fromGm = GameManager.instance?.catPrefabs;
        if (fromGm && fromGm.length > 0) return fromGm;
        return this.catPrefabs;
    }

    private getXByMath(event: EventTouch | EventMouse): number {
        const uiLocation = event.getUILocation();
        const canvas = this.node.scene.getChildByName('Canvas');
        if (canvas) {
            const uiTransform = canvas.getComponent(UITransform);
            if (uiTransform) {
                const localPos = uiTransform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0));
                const limit = GameConfig.spawnXLimit;
                return Math.max(-limit, Math.min(limit, localPos.x));
            }
        }
        return 0;
    }

    onMouseDown(event: EventMouse) { if (this.isPlayable()) this.handleStart(event); }
    onMouseMove(event: EventMouse) { if (this.isPlayable()) this.handleMove(event); }
    onMouseUp(_event: EventMouse) { if (this.isPlayable()) this.handleEnd(); }
    onTouchStart(event: EventTouch) { if (this.isPlayable()) this.handleStart(event); }
    onTouchMove(event: EventTouch) { if (this.isPlayable()) this.handleMove(event); }
    onTouchEnd(_event: EventTouch) { if (this.isPlayable()) this.handleEnd(); }
    onTouchCancel(_event: EventTouch) {
        // 系统打断触摸：若已按下则按松手处理，避免 isTouching 卡死
        if (!this.isPlayable()) {
            this.isTouching = false;
            return;
        }
        this.handleEnd();
    }

    private isPlayable(): boolean {
        return this.isGameStarted && !(GameManager.instance && GameManager.instance.isGameOver);
    }

    /**
     * 触摸落在 UI 按钮或排行榜面板上时拦截，避免穿透投掷
     */
    private isTouchBlocked(event: EventTouch | EventMouse): boolean {
        const rankPanel = GameManager.instance?.weChatRank?.rankPanel;
        if (rankPanel && rankPanel.activeInHierarchy) return true;

        // 开始面板 / 结算面板打开时不响应
        const startPanel = GameManager.instance?.startPanel;
        if (startPanel && startPanel.activeInHierarchy) return true;
        const overPanel = GameManager.instance?.gameOverPanel;
        if (overPanel && overPanel.activeInHierarchy) return true;

        const uiPos = event.getUILocation();
        const touchPoint = new Vec3(uiPos.x, uiPos.y, 0);
        const canvas = this.node.scene.getChildByName('Canvas');
        if (!canvas) return false;

        const buttons = canvas.getComponentsInChildren(Button);
        for (const btn of buttons) {
            if (!btn.node.activeInHierarchy || !btn.interactable) continue;
            const transform = btn.node.getComponent(UITransform);
            if (!transform) continue;
            const local = transform.convertToNodeSpaceAR(touchPoint);
            if (local.x >= -transform.anchorX * transform.width &&
                local.x <= (1 - transform.anchorX) * transform.width &&
                local.y >= -transform.anchorY * transform.height &&
                local.y <= (1 - transform.anchorY) * transform.height) {
                return true;
            }
        }
        return false;
    }

    private handleStart(event: EventTouch | EventMouse) {
        if (this.isTouchBlocked(event)) {
            this.isTouching = false;
            return;
        }

        this.targetX = this.getXByMath(event);
        this.isTouching = true;

        if (this.isWaiting) return;

        if (!this.currentCat || !this.currentCat.isValid) {
            this.createCat(this.targetX);
        }
    }

    private handleMove(event: EventTouch | EventMouse) {
        this.targetX = this.getXByMath(event);
        if (!this.isTouching) return;
    }

    private handleEnd() {
        if (!this.isTouching) return;
        this.isTouching = false;
        if (this.isWaiting) return;
        if (!this.currentCat || !this.currentCat.isValid) return;

        this.currentCat.setPosition(this.targetX, this.currentCat.position.y, 0);
        this.lastX = this.targetX;
        this.dropCat();
    }

    update(_dt: number) {
        if (this.currentCat && this.currentCat.isValid && !this.isWaiting) {
            const currentPos = this.currentCat.position;
            const newX = currentPos.x + (this.targetX - currentPos.x) * 0.25;
            this.currentCat.setPosition(newX, currentPos.y, 0);
            this.lastX = newX;
            this.drawGuideLine(newX);
        }
    }

    private drawGuideLine(x: number) {
        if (!this.guideLine) return;
        this.guideLine.node.active = true;
        this.guideLine.clear();
        // 暹罗蓝半透明虚线
        this.guideLine.strokeColor = new Color(90, 160, 210, 100);
        this.guideLine.lineWidth = 3;

        const startY = (this.spawnPoint && this.spawnPoint.isValid) ? this.spawnPoint.position.y : 500;
        const endY = -600;
        const dashLen = 15;
        const gapLen = 10;

        let currentY = startY;
        while (currentY > endY) {
            this.guideLine.moveTo(x, currentY);
            currentY -= dashLen;
            this.guideLine.lineTo(x, Math.max(currentY, endY));
            currentY -= gapLen;
        }
        this.guideLine.stroke();
    }

    createCat(x: number) {
        if (!this.isPlayable()) return;

        const prefabs = this.getPrefabList();
        if (!prefabs || prefabs.length === 0) return;

        const poolSize = Math.min(prefabs.length, GameConfig.spawnableLevels);
        const randomIndex = Math.floor(Math.random() * poolSize);
        const prefab = prefabs[randomIndex];

        if (prefab) {
            this.currentCat = instantiate(prefab);

            // 初始禁用碰撞体，防止在顶部挤压下方堆叠
            const col = this.currentCat.getComponent(Collider2D) || this.currentCat.getComponentInChildren(Collider2D);
            if (col) col.enabled = false;

            const rb = this.currentCat.getComponent(RigidBody2D) || this.currentCat.getComponentInChildren(RigidBody2D);
            if (rb) {
                rb.enabled = true;
                rb.type = ERigidBody2DType.Static;
            }
            const canvas = this.node.scene.getChildByPath('Canvas');
            const container = canvas ? canvas.getChildByName('CatContainer') || canvas : this.node.scene.getChildByName('Canvas');
            if (container) container.addChild(this.currentCat);

            const y = (this.spawnPoint && this.spawnPoint.isValid) ? this.spawnPoint.position.y : 500;
            this.currentCat.setPosition(x, y, 0);
            this.currentCat.setScale(new Vec3(0.1, 0.1, 1));
            const targetNode = this.currentCat;
            this.scheduleOnce(() => {
                if (targetNode && targetNode.isValid) targetNode.setScale(new Vec3(1, 1, 1));
            }, 0.05);
            this.drawGuideLine(x);
        }
    }

    dropCat() {
        if (!this.currentCat || !this.currentCat.isValid) return;
        if (!this.isPlayable()) return;
        if (this.guideLine) this.guideLine.node.active = false;

        if (GameManager.instance) GameManager.instance.resetCombo();

        if (typeof wx !== 'undefined') wx.vibrateShort({ type: 'light' });

        const col = this.currentCat.getComponent(Collider2D) || this.currentCat.getComponentInChildren(Collider2D);
        if (col) col.enabled = true;

        const rb = this.currentCat.getComponent(RigidBody2D) || this.currentCat.getComponentInChildren(RigidBody2D);
        if (rb) {
            rb.type = ERigidBody2DType.Dynamic;
            rb.wakeUp();
            rb.linearVelocity = new Vec2(0, -10);
        }

        this.currentCat = null;
        this.isWaiting = true;

        if (this.dropScheduleCb) {
            this.unschedule(this.dropScheduleCb);
        }
        this.dropScheduleCb = () => {
            this.dropScheduleCb = null;
            this.isWaiting = false;
            // 冷却结束后若已 game over，禁止再生成
            if (!this.isPlayable()) return;
            this.createCat(this.targetX);
        };
        this.scheduleOnce(this.dropScheduleCb, GameConfig.dropCooldown);
    }
}
