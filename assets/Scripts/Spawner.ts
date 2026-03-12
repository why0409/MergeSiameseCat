import { _decorator, Component, Node, Prefab, instantiate, Vec3, input, Input, EventTouch, RigidBody2D, ERigidBody2DType, EventMouse, view, UITransform, screen, Graphics, Color, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Spawner')
export class Spawner extends Component {
    @property({ type: [Prefab], tooltip: '猫咪预制体列表(1-3级)' })
    public catPrefabs: Prefab[] = [];

    @property({ type: Node, tooltip: '生成高度参考点' })
    public spawnPoint: Node = null!;

    @property({ type: Graphics, tooltip: '指引线组件' })
    public guideLine: Graphics = null!;

    private currentCat: Node | null = null;
    private isWaiting: boolean = false;
    private designWidth: number = 720; 
    private isTouching: boolean = false;
    private lastX: number = 0;
    private targetX: number = 0;

    start() {
        this.targetX = (Math.random() - 0.5) * 400; 
        this.createCat(this.targetX);
    }

    onEnable() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    private getXByMath(screenX: number): number {
        const ratio = screenX / screen.windowSize.width;
        let x = (ratio * this.designWidth) - (this.designWidth / 2);
        const limit = 320; 
        return Math.max(-limit, Math.min(limit, x));
    }

    onMouseDown(event: EventMouse) { this.handleStart(event.getLocationX()); }
    onMouseMove(event: EventMouse) { this.handleMove(event.getLocationX()); }
    onMouseUp(event: EventMouse) { this.handleEnd(); }
    onTouchStart(event: EventTouch) { this.handleStart(event.getLocationX()); }
    onTouchMove(event: EventTouch) { this.handleMove(event.getLocationX()); }
    onTouchEnd(event: EventTouch) { this.handleEnd(); }

    private handleStart(screenX: number) {
        if (this.isWaiting) return;
        this.isTouching = true;
        this.targetX = this.getXByMath(screenX);
        
        if (!this.currentCat || !this.currentCat.isValid) {
            this.createCat(this.targetX);
        }
    }

    private handleMove(screenX: number) {
        if (!this.isTouching) return;
        this.targetX = this.getXByMath(screenX);
    }

    private handleEnd() {
        this.isTouching = false;
        if (!this.currentCat || !this.currentCat.isValid || this.isWaiting) return;
        this.dropCat();
    }

    update(dt: number) {
        // 实现平滑跟随
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
        // 优化颜色：使用更柔和的半透明白色
        this.guideLine.strokeColor = new Color(255, 255, 255, 80);
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
        if (this.catPrefabs.length === 0) return;
        const randomIndex = Math.floor(Math.random() * Math.min(this.catPrefabs.length, 3));
        const prefab = this.catPrefabs[randomIndex];

        if (prefab) {
            this.currentCat = instantiate(prefab);
            const rb = this.currentCat.getComponent(RigidBody2D);
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
        if (this.guideLine) this.guideLine.node.active = false;

        // 下落重置连击
        if (GameManager.instance) GameManager.instance.resetCombo();

        // 微信轻微震动
        if (typeof wx !== 'undefined') wx.vibrateShort({ type: 'light' });
...
        const rb = this.currentCat.getComponent(RigidBody2D);
        if (rb) {
            rb.type = ERigidBody2DType.Dynamic;
            rb.wakeUp();
            rb.linearVelocity = new Vec2(0, -10); 
        }

        const droppedX = this.lastX;
        this.currentCat = null;
        this.isWaiting = true;

        this.scheduleOnce(() => {
            this.isWaiting = false;
            if (!this.isTouching) {
                let nextX = droppedX;
                if (Math.abs(nextX) < 60) nextX = nextX > 0 ? 100 : -100;
                this.createCat(nextX);
            }
        }, 0.4); 
    }
}
