import { _decorator, Component, Node, Contact2DType, Collider2D, IPhysics2DContact, RigidBody2D, Vec3, ERigidBody2DType } from 'cc';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

@ccclass('Cat')
export class Cat extends Component {
    @property({ tooltip: '猫咪等级 (1-10)' })
    public level: number = 1;

    public isMerging: boolean = false;

    // 缓存查找到的组件
    private _collider: Collider2D | null = null;

    onLoad() {
        // 核心修复：全路径搜索 Collider2D
        this._collider = this.getComponent(Collider2D) || 
                         this.getComponentInChildren(Collider2D) || 
                         this.node.parent?.getComponent(Collider2D) || null;

        if (this._collider) {
            console.log(`[Cat] Lv${this.level} 已成功绑定碰撞体: ${this._collider.node.name}`);
        } else {
            console.error(`[Cat] Lv${this.level} 依然未找到 Collider2D！请手动检查预制体层级。`);
        }
    }

    onEnable() {
        if (this._collider) {
            this._collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    onDisable() {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    private onBeginContact(self: Collider2D, other: Collider2D, contact: IPhysics2DContact | null) {
        if (!other || !other.node) return;
        
        // 调试：只要有碰撞就打印
        console.log(`[Collision] Lv${this.level} (${this.node.name}) 撞到了 ${other.node.name}`);

        if (this.isMerging || !this.node.isValid) return;

        // 获取对方的 Cat 组件 (全路径搜索)
        const otherCat = other.node.getComponent(Cat) || 
                         other.node.getComponentInChildren(Cat) || 
                         other.node.parent?.getComponent(Cat);
        
        if (otherCat && otherCat.level === this.level && !otherCat.isMerging) {
            // 获取双方刚体进行状态校验
            const selfRB = this.getComponent(RigidBody2D) || this.getComponentInChildren(RigidBody2D) || this.node.parent?.getComponent(RigidBody2D);
            const otherRB = other.node.getComponent(RigidBody2D) || other.node.getComponentInChildren(RigidBody2D) || other.node.parent?.getComponent(RigidBody2D);

            if (selfRB && otherRB && selfRB.type === ERigidBody2DType.Dynamic && otherRB.type === ERigidBody2DType.Dynamic) {
                // UUID 排序确保单次合成
                if (this.node.uuid < other.node.uuid) {
                    this.executeMerge(otherCat, other.node.worldPosition);
                }
            }
        }
    }

    private executeMerge(otherCat: Cat, otherWorldPos: Vec3) {
        console.log(`[Merge] Lv${this.level} 合成中...`);
        this.isMerging = true;
        otherCat.isMerging = true;

        const posA = this.node.worldPosition;
        const midPos = new Vec3((posA.x + otherWorldPos.x) / 2, (posA.y + otherWorldPos.y) / 2, 0);

        if (GameManager.instance) {
            GameManager.instance.mergeCats(this.level, midPos);
        }

        this.scheduleOnce(() => {
            // 延迟禁用物理逻辑和节点，防止在物理步进中产生错误
            if (this.node && this.node.isValid) {
                if (this._collider) this._collider.enabled = false;
                this.node.active = false;
            }
            
            if (otherCat.node && otherCat.node.isValid) {
                const otherCol = otherCat.getComponent(Collider2D) || otherCat.getComponentInChildren(Collider2D);
                if (otherCol) otherCol.enabled = false;
                otherCat.node.active = false;
            }

            // 彻底销毁节点及其所有层级
            this.safeDestroy(this.node);
            this.safeDestroy(otherCat.node);
        }, 0);
    }

    private safeDestroy(node: Node) {
        if (!node || !node.isValid) return;
        // 如果挂载在特殊的预制体容器里，向上销毁一级
        if (node.parent && (node.parent.name.includes('Cat') || node.parent.name.includes('New Node'))) {
            node.parent.destroy();
        } else {
            node.destroy();
        }
    }
}
