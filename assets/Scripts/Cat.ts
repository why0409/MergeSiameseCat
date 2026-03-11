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
        if (this.isMerging) return;

        const otherNode = otherCollider.node;
        const otherCat = otherNode.getComponent(Cat) || otherNode.getComponentInChildren(Cat) || otherNode.parent?.getComponent(Cat);

        if (!otherCat) return;

        if (otherCat.level === this.level && !otherCat.isMerging) {
            if (this.node.uuid < otherCat.node.uuid) {
                this.isMerging = true;
                otherCat.isMerging = true;

                const posA = selfCollider.node.worldPosition;
                const posB = otherCollider.node.worldPosition;
                const midPos = new Vec3((posA.x + posB.x) / 2, (posA.y + posB.y) / 2, 0);

                if (GameManager.instance) {
                    GameManager.instance.mergeCats(this.level, midPos);
                }

                this.prepareForDestroy();
                otherCat.prepareForDestroy();

                this.scheduleOnce(() => {
                    this.safeDestroy(this.node);
                    this.safeDestroy(otherCat!.node);
                }, 0);
            }
        }
    }

    private prepareForDestroy() {
        this.isMerging = true;
        
        // 关键：禁用碰撞体即可，不再切换 RigidBody 类型
        const rb = this.getComponent(RigidBody2D) || this.node.parent?.getComponent(RigidBody2D);
        if (rb) {
            rb.enabled = false;
        }

        const col = this.getComponent(Collider2D) || this.node.parent?.getComponent(Collider2D);
        if (col) {
            col.enabled = false;
        }

        // 立即隐藏
        this.node.active = false;
        if (this.node.parent && this.node.parent.name.includes('Cat_Lv')) {
            this.node.parent.active = false;
        }
    }

    private safeDestroy(node: Node) {
        if (!node || !node.isValid) return;
        let root = node;
        if (node.parent && node.parent.name.includes('Cat_Lv')) {
            root = node.parent;
        }
        root.destroy();
    }
}
