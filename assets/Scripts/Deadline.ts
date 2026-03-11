import { _decorator, Component, Node, Collider2D, Contact2DType, IPhysics2DContact, RigidBody2D, log } from 'cc';
import { GameManager } from './GameManager';
import { Cat } from './Cat';
const { ccclass, property } = _decorator;

@ccclass('Deadline')
export class Deadline extends Component {
    @property({ tooltip: '触发死亡的停留时间 (秒)' })
    public limitTime: number = 2.0;

    private _warningCats: Set<string> = new Set();
    private _timer: number = 0;

    onEnable() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }

    private onBeginContact(self: Collider2D, other: Collider2D) {
        // 只有已经落地并变动的猫咪计入死亡判定
        const cat = other.node.getComponent(Cat) || other.node.getComponentInChildren(Cat);
        const rb = other.node.getComponent(RigidBody2D) || other.node.parent?.getComponent(RigidBody2D);
        
        // 我们根据 UUID 记录，防止节点销毁导致的 Set 引用问题
        if (cat && rb) {
            this._warningCats.add(other.node.uuid);
        }
    }

    private onEndContact(self: Collider2D, other: Collider2D) {
        this._warningCats.delete(other.node.uuid);
        if (this._warningCats.size === 0) {
            this._timer = 0;
        }
    }

    update(dt: number) {
        if (!GameManager.instance || GameManager.instance.isGameOver) return;

        if (this._warningCats.size > 0) {
            this._timer += dt;
            if (this._timer >= this.limitTime) {
                console.warn("[Deadline] Time Limit Reached! Game Over.");
                GameManager.instance.gameOver();
                this._timer = 0;
            }
        } else {
            this._timer = 0;
        }
    }
}
