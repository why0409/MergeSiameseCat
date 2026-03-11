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
    private designWidth: number = 720; 

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
        // 使用 view.getVisibleSize() 适配 3.7.4 的多分辨率
        const visibleSize = view.getVisibleSize();
        const ratio = screenX / screen.windowSize.width;
        return (ratio * this.designWidth) - (this.designWidth / 2);
    }

    onMouseDown(event: EventMouse) { this.handleStart(event.getLocationX()); }
    onMouseMove(event: EventMouse) { this.handleMove(event.getLocationX()); }
    onMouseUp(event: EventMouse) { this.handleEnd(); }

    onTouchStart(event: EventTouch) { this.handleStart(event.getLocationX()); }
    onTouchMove(event: EventTouch) { this.handleMove(event.getLocationX()); }
    onTouchEnd(event: EventTouch) { this.handleEnd(); }

    private handleStart(screenX: number) {
        if (this.isWaiting) return;
        // 如果当前已经有一只猫且它是有效的，不重复创建
        if (this.currentCat && this.currentCat.isValid) return;
        
        const x = this.getXByMath(screenX);
        this.createCat(x);
    }

    private handleMove(screenX: number) {
        // 关键修复：极致的有效性检查
        if (!this.currentCat || !this.currentCat.isValid || !this.currentCat.parent) {
            this.currentCat = null;
            return;
        }
        
        const x = this.getXByMath(screenX);
        const currentPos = this.currentCat.position;
        // 只有当坐标确实需要变动时才调用 setPosition
        if (Math.abs(currentPos.x - x) > 0.1) {
            this.currentCat.setPosition(x, currentPos.y, 0);
        }
    }

    private handleEnd() {
        if (!this.currentCat || !this.currentCat.isValid) {
            this.currentCat = null;
            return;
        }
        this.dropCat();
    }

    createCat(x: number) {
        if (this.catPrefabs.length === 0) return;

        const randomIndex = Math.floor(Math.random() * Math.min(this.catPrefabs.length, 3));
        const prefab = this.catPrefabs[randomIndex];

        if (prefab) {
            this.currentCat = instantiate(prefab);
            
            const rb = this.currentCat.getComponent(RigidBody2D);
            if (rb) rb.type = 0; // Static

            const canvas = this.node.scene.getChildByPath('Canvas');
            if (canvas) {
                canvas.addChild(this.currentCat);
            }

            // 获取安全高度
            const y = (this.spawnPoint && this.spawnPoint.isValid) ? this.spawnPoint.position.y : 500;
            this.currentCat.setPosition(x, y, 0);
        }
    }

    dropCat() {
        // 再次检查有效性
        if (!this.currentCat || !this.currentCat.isValid) {
            this.currentCat = null;
            return;
        }

        const rb = this.currentCat.getComponent(RigidBody2D);
        if (rb) {
            rb.type = 2; // Dynamic
            rb.wakeUp(); 
        }

        this.currentCat = null; // 立即释放引用
        this.isWaiting = true;
        this.scheduleOnce(() => { this.isWaiting = false; }, 0.5);
    }
}
