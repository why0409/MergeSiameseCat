import { _decorator, Component, Node, Contact2DType, Collider2D, IPhysics2DContact, RigidBody2D, Vec3, Vec2, Tween } from 'cc';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

@ccclass('Cat')
export class Cat extends Component {
    @property({ tooltip: '猫咪等级 (1-10)' })
    public level: number = 1;

    public isMerging: boolean = false;

    private _collider: Collider2D | null = null;

    onLoad() {
        this._collider = this._findComponentSafe(this.node, Collider2D);
    }

    onEnable() {
        if (this._collider) {
            this._collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
    }

    onDisable() {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
    }

    private _findComponentSafe<T extends Component>(startNode: Node, type: any): T | null {
        if (!startNode || !startNode.isValid) return null;
        let comp = startNode.getComponent(type);
        if (comp) return comp as T;
        comp = startNode.getComponentInChildren(type);
        if (comp) return comp as T;
        let curr = startNode.parent;
        while (curr) {
            comp = curr.getComponent(type);
            if (comp) return comp as T;
            curr = curr.parent;
        }
        return null;
    }

    /**
     * 获取实体的根节点（即预制体实例化的那个节点）
     */
    private _getEntityRoot(node: Node): Node {
        let curr = node;
        // 向上查找，直到父节点是 Canvas 或 catContainer，或者没有父节点为止
        while (curr.parent && 
               curr.parent.name !== 'Canvas' && 
               curr.parent.name !== 'catContainer' && 
               curr.parent.name !== 'Scene') {
            curr = curr.parent;
        }
        return curr;
    }

    private _onBeginContact(self: Collider2D, other: Collider2D, contact: IPhysics2DContact | null) {
        if (this.isMerging || !this.node.isValid || !other || !other.node || !other.node.isValid) return;

        const otherCat = this._findComponentSafe<Cat>(other.node, Cat);
        
        if (otherCat && 
            otherCat !== this && 
            otherCat.level === this.level && 
            !otherCat.isMerging && 
            otherCat.node.isValid) {
            
            // 使用根节点的 UUID 进行唯一性判定
            const myRoot = this._getEntityRoot(this.node);
            const otherRoot = this._getEntityRoot(otherCat.node);

            if (myRoot.uuid < otherRoot.uuid) {
                this._startMergeSequence(otherCat, myRoot, otherRoot);
            }
        }
    }

    private _startMergeSequence(otherCat: Cat, myRoot: Node, otherRoot: Node) {
        this.isMerging = true;
        otherCat.isMerging = true;

        // 1. 立即停止所有可能干扰 scale 的动画
        Tween.stopAllByTarget(myRoot);
        Tween.stopAllByTarget(otherRoot);

        // 2. 视觉瞬间消除：缩放归零 + 移出屏幕
        // 这一步在物理回调中是安全的，且能立即生效
        myRoot.setScale(new Vec3(0, 0, 0));
        otherRoot.setScale(new Vec3(0, 0, 0));
        
        // 记录坐标用于生成新猫
        const posA = myRoot.worldPosition.clone();
        const posB = otherRoot.worldPosition.clone();
        const midPos = new Vec3((posA.x + posB.x) / 2, (posA.y + posB.y) / 2, 0);

        // 移出屏幕防止物理引擎在这一帧继续计算碰撞
        myRoot.setWorldPosition(new Vec3(9999, 9999, 0));
        otherRoot.setWorldPosition(new Vec3(9999, 9999, 0));

        // 3. 异步彻底清理
        this.scheduleOnce(() => {
            // 核心修复：在生成新猫前，再次确认游戏是否已经结束
            if (GameManager.instance && !GameManager.instance.isGameOver) {
                GameManager.instance.mergeCats(this.level, midPos);
            }

            // 彻底销毁根节点
            if (myRoot.isValid) myRoot.destroy();
            if (otherRoot.isValid) otherRoot.destroy();
        }, 0);
    }
}
