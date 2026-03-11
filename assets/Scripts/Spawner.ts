import { _decorator, Component, Node, Prefab, instantiate, Vec3, input, Input, EventTouch, RigidBody2D, ERigidBody2DType, EventMouse, view, UITransform, screen } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Spawner')
export class Spawner extends Component {
    @property({ type: [Prefab], tooltip: '猫咪预制体列表(1-3级)' })
    public catPrefabs: Prefab[] = [];

    @property({ type: Node, tooltip: '生成高度参考点' })
    public spawnPoint: Node = null!;

    private currentCat: Node | null = null;
    private isWaiting: boolean = false;
    private designWidth: number = 720; // 设计宽度

    onEnable() {
        console.log('Spawner: Simple Math Mode Active');
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

    // 极其可靠的数学计算：(点击位置 / 屏幕总宽) * 设计宽度 - 偏移量
    private getXByMath(screenX: number): number {
        const windowSize = screen.windowSize;
        const ratio = screenX / windowSize.width;
        // 映射到 -360 到 360 的区间
        return (ratio * this.designWidth) - (this.designWidth / 2);
    }

    onMouseDown(event: EventMouse) { this.handleStart(event.getLocationX()); }
    onMouseMove(event: EventMouse) { this.handleMove(event.getLocationX()); }
    onMouseUp(event: EventMouse) { this.handleEnd(); }

    onTouchStart(event: EventTouch) { this.handleStart(event.getLocationX()); }
    onTouchMove(event: EventTouch) { this.handleMove(event.getLocationX()); }
    onTouchEnd(event: EventTouch) { this.handleEnd(); }

    private handleStart(screenX: number) {
        if (this.isWaiting || this.currentCat) return;
        const x = this.getXByMath(screenX);
        this.createCat(x);
    }

    private handleMove(screenX: number) {
        if (!this.currentCat) return;
        const x = this.getXByMath(screenX);
        this.currentCat.setPosition(new Vec3(x, this.currentCat.position.y, 0));
    }

    private handleEnd() {
        if (!this.currentCat) return;
        this.dropCat();
    }

    createCat(x: number) {
        if (this.catPrefabs.length === 0) return;

        const randomIndex = Math.floor(Math.random() * Math.min(this.catPrefabs.length, 3));
        const prefab = this.catPrefabs[randomIndex];

        if (prefab) {
            this.currentCat = instantiate(prefab);
            
            const rb = this.currentCat.getComponent(RigidBody2D);
            if (rb) {
                rb.type = ERigidBody2DType.Static;
            }

            // 强制挂载到 Canvas 下
            const canvas = this.node.scene.getChildByPath('Canvas');
            if (canvas) {
                canvas.addChild(this.currentCat);
            } else {
                this.node.parent?.addChild(this.currentCat);
            }

            // 设置初始 Y 坐标，如果没设则默认为 500
            const y = this.spawnPoint ? this.spawnPoint.position.y : 500;
            this.currentCat.setPosition(new Vec3(x, y, 0));
            
            console.log(`Spawned at X: ${x.toFixed(2)}, Y: ${y}`);
        }
    }

    dropCat() {
        if (!this.currentCat) return;

        const rb = this.currentCat.getComponent(RigidBody2D);
        if (rb) {
            rb.type = ERigidBody2DType.Dynamic;
            rb.wakeUp(); 
            console.log('Cat Dropped');
        }

        this.currentCat = null;
        this.isWaiting = true;
        this.scheduleOnce(() => { this.isWaiting = false; }, 0.8);
    }
}
