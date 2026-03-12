import { _decorator, Component, Node, Contact2DType, Collider2D, IPhysics2DContact, RigidBody2D, Vec3, ERigidBody2DType } from 'cc';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

/**
 * 核心猫咪组件：负责碰撞逻辑与合成判定
 */
@ccclass('Cat')
export class Cat extends Component {
    @property({ tooltip: '猫咪等级 (1-10)' })
    public level: number = 1;

    // 标志位：防止由于多次碰撞引发重复合成
    public isMerging: boolean = false;

    private _collider: Collider2D | null = null;

    onEnable() {
        // 自动获取碰撞体，尝试从自身、子节点或父节点获取（适配预制体结构）
        this._collider = this.getComponent(Collider2D) || this.node.getComponentInChildren(Collider2D);
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
        // 合成中或已销毁节点不再处理
        if (this.isMerging || !this.node || !this.node.isValid) return;

        // 核心安全检查：获取自身刚体类型
        const selfRB = this.node.getComponent(RigidBody2D);
        if (!selfRB || selfRB.type !== ERigidBody2DType.Dynamic) return;

        const otherNode = otherCollider.node;
        if (!otherNode || !otherNode.isValid) return;

        // 获取对方组件，必须是相同等级的猫，且对方也得是下落状态
        const otherCat = otherNode.getComponent(Cat) || otherNode.getComponentInChildren(Cat);
        if (!otherCat || otherCat.isMerging || !otherCat.node || !otherCat.node.isValid) return;

        const otherRB = otherNode.getComponent(RigidBody2D);
        if (!otherRB || otherRB.type !== ERigidBody2DType.Dynamic) return;

        if (otherCat.level === this.level) {
            // 通过比较 UUID 确保在两个物体碰撞时，逻辑只执行一次
            if (this.node.uuid < otherCat.node.uuid) {
                this.isMerging = true;
                otherCat.isMerging = true;

                // 计算两个球的中心点，作为新猫生成的坐标
                const posA = selfCollider.node.worldPosition;
                const posB = otherCollider.node.worldPosition;
                const midPos = new Vec3((posA.x + posB.x) / 2, (posA.y + posB.y) / 2, 0);

                // 调用管理器执行合成
                if (GameManager.instance) {
                    GameManager.instance.mergeCats(this.level, midPos);
                }

                // 物理状态立即清理，防止干扰后续模拟
                this.prepareForDestroy();
                otherCat.prepareForDestroy();

                // 下一帧销毁，确保物理回调安全结束
                this.scheduleOnce(() => {
                    this.safeDestroyNode(this.node);
                    this.safeDestroyNode(otherCat.node);
                }, 0);
            }
        }
    }

    private prepareForDestroy() {
        this.isMerging = true;
        this.node.active = false;
        
        const rb = this.getComponent(RigidBody2D);
        if (rb) rb.enabled = false;
    }

    private safeDestroyNode(node: Node) {
        if (!node || !node.isValid) return;
        node.destroy();
    }
}
