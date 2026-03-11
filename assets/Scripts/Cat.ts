import { _decorator, Component, Node, Contact2DType, Collider2D, IPhysics2DContact, RigidBody2D, Vec3 } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('Cat')
export class Cat extends Component {
    @property({ tooltip: '猫咪等级 (1-10)' })
    public level: number = 1;

    public isMerging: boolean = false; 

    private _collider: Collider2D | null = null;

    onEnable() {
        this._collider = this.getComponent(Collider2D) || this.node.getComponentInChildren(Collider2D) || this.node.parent?.getComponent(Collider2D);
        if (this._collider) {
            this._collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    onDisable() {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        if (this.isMerging || !this.node.isValid) return;

        // 预防：如果猫咪处于预览状态（Static），禁止合成
        const rb = this.getComponent(RigidBody2D) || this.node.parent?.getComponent(RigidBody2D);
        if (rb && rb.type === 0) return; 

        const otherNode = otherCollider.node;
        if (!otherNode || !otherNode.isValid) return;

        const otherCat = otherNode.getComponent(Cat) || otherNode.getComponentInChildren(Cat) || otherNode.parent?.getComponent(Cat);
        if (!otherCat || otherCat.isMerging || !otherCat.node.isValid) return;

        if (otherCat.level === this.level) {
            // UUID 排序确保单次触发
            if (this.node.uuid < otherCat.node.uuid) {
                this.isMerging = true;
                otherCat.isMerging = true;

                const posA = selfCollider.node.worldPosition;
                const posB = otherCollider.node.worldPosition;
                const midPos = new Vec3((posA.x + posB.x) / 2, (posA.y + posB.y) / 2, 0);

                if (GameManager.instance) {
                    GameManager.instance.mergeCats(this.level, midPos);
                }

                // 立即禁用物理和碰撞
                this.prepareForDestroy();
                otherCat.prepareForDestroy();

                // 延迟到下一帧彻底销毁
                this.scheduleOnce(() => {
                    this.safeDestroy(this.node);
                    this.safeDestroy(otherCat!.node);
                }, 0);
            }
        }
    }

    private prepareForDestroy() {
        this.isMerging = true;
        this.node.active = false;
        
        // 尝试隐藏父级预制体根节点
        if (this.node.parent && this.node.parent.name.includes('Cat_Lv')) {
            this.node.parent.active = false;
        }
        
        const rb = this.getComponent(RigidBody2D) || this.node.parent?.getComponent(RigidBody2D);
        if (rb) {
            rb.enabled = false;
        }
    }

    private safeDestroy(node: Node) {
        if (!node || !node.isValid) return;
        let root = node;
        // 如果是预制体结构，销毁最顶层
        if (node.parent && node.parent.name.includes('Cat_Lv')) {
            root = node.parent;
        }
        root.destroy();
    }
}
