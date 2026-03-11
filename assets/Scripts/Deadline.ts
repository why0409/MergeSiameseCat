import { _decorator, Component, Node, Collider2D, Contact2DType, IPhysics2DContact, RigidBody2D, log } from 'cc';
import { GameManager } from './GameManager';
import { Cat } from './Cat';
const { ccclass, property } = _decorator;

@ccclass('Deadline')
export class Deadline extends Component {
    @property({ tooltip: '触发死亡的停留时间 (秒)' })
    public limitTime: number = 2.0;

    private _warningCats: Map<string, Node> = new Map();
    private _timer: number = 0;

    onEnable() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }

    private onBeginContact(self: Collider2D, other: Collider2D) {
        const otherNode = other.node;
        const cat = otherNode.getComponent(Cat) || otherNode.getComponentInChildren(Cat) || otherNode.parent?.getComponent(Cat);
        
        // 只有掉落状态的猫咪才计入
        const rb = otherNode.getComponent(RigidBody2D) || otherNode.parent?.getComponent(RigidBody2D);
        
        if (cat && rb && rb.type === 2) { // 2 为 Dynamic
            this._warningCats.set(otherNode.uuid, otherNode);
            console.log(`[Deadline] Cat entered: Lv${cat.level}, total: ${this._warningCats.size}`);
        }
    }

    private onEndContact(self: Collider2D, other: Collider2D) {
        if (this._warningCats.has(other.node.uuid)) {
            this._warningCats.delete(other.node.uuid);
            console.log(`[Deadline] Cat left, remaining: ${this._warningCats.size}`);
            if (this._warningCats.size === 0) {
                this._timer = 0;
            }
        }
    }

    update(dt: number) {
        if (!GameManager.instance || GameManager.instance.isGameOver) return;

        // 清理掉无效的（已经销毁的）节点引用
        if (this._warningCats.size > 0) {
            for (let [uuid, node] of this._warningCats) {
                if (!node || !node.isValid || !node.parent) {
                    this._warningCats.delete(uuid);
                }
            }
        }

        if (this._warningCats.size > 0) {
            this._timer += dt;
            // 调试日志：如果你看到这个计时在增加，说明检测到了
            // console.log(`[Deadline] Timer: ${this._timer.toFixed(1)}s`);
            
            if (this._timer >= this.limitTime) {
                console.warn("[Deadline] GAME OVER triggered!");
                GameManager.instance.gameOver();
                this._timer = 0;
            }
        } else {
            this._timer = 0;
        }
    }
}
