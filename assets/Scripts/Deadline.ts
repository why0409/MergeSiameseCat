import { _decorator, Component, Node, Collider2D, Contact2DType, IPhysics2DContact, RigidBody2D, log, UIOpacity, Tween, tween, Color, Sprite, ERigidBody2DType, UITransform } from 'cc';
import { GameManager } from './GameManager';
import { Cat } from './Cat';
const { ccclass, property } = _decorator;

@ccclass('Deadline')
export class Deadline extends Component {
    @property({ tooltip: '触发死亡的停留时间 (秒)' })
    public limitTime: number = 2.0;

    private _warningCats: Map<string, Node> = new Map();
    private _timer: number = 0;
    private _uiOpacity: UIOpacity | null = null;
    private _isFlashing: boolean = false;

    onLoad() {
        this._uiOpacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
        if (this._uiOpacity) this._uiOpacity.opacity = 0;

        // 强力保障：确保有尺寸和基本的白色贴图（如果没有分配的话）
        const transform = this.getComponent(UITransform);
        if (transform) {
            if (transform.contentSize.width === 0) transform.setContentSize(720, 5);
        }

        const sprite = this.getComponent(Sprite);
        if (sprite && !sprite.spriteFrame) {
            // 如果没图，设置一个默认的纯白颜色
            sprite.color = new Color(255, 255, 255, 255);
        }

        // 提升层级，防止被背景遮挡
        this.node.setSiblingIndex(this.node.parent ? this.node.parent.children.length - 1 : 100);
    }

    onEnable() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }

    private onBeginContact(self: Collider2D, other: Collider2D) {
        if (!other || !other.node) return;
        const otherNode = other.node;
        const cat = otherNode.getComponent(Cat) || otherNode.getComponentInChildren(Cat) || otherNode.parent?.getComponent(Cat);

        // 只有掉落状态的猫咪且非正在合成的猫咪才计入
        const rb = otherNode.getComponent(RigidBody2D) || otherNode.parent?.getComponent(RigidBody2D);

        if (cat && !cat.isMerging && rb && rb.type === ERigidBody2DType.Dynamic) {
            this._warningCats.set(otherNode.uuid, otherNode);
            // console.log(`[Deadline] Warning: Cat Lv${cat.level} entered.`);
        }
    }

    private onEndContact(self: Collider2D, other: Collider2D) {
        if (other && other.node && this._warningCats.has(other.node.uuid)) {
            this._warningCats.delete(other.node.uuid);
            if (this._warningCats.size === 0) {
                this._timer = 0;
                this.stopFlashing();
            }
        }
    }

    update(dt: number) {
        if (!GameManager.instance || GameManager.instance.isGameOver) return;

        // 1. 清理无效节点
        if (this._warningCats.size > 0) {
            const keysToRemove: string[] = [];
            this._warningCats.forEach((node, uuid) => {
                if (!node || !node.isValid || !node.parent) {
                    keysToRemove.push(uuid);
                }
            });
            keysToRemove.forEach(k => this._warningCats.delete(k));
        }

        // 2. 核心判定：只有当区域内的猫咪“停稳”了（速度接近0），才视为真正的预警
        let hasStableCat = false;
        if (this._warningCats.size > 0) {
            this._warningCats.forEach((node, uuid) => {
                const rb = node.getComponent(RigidBody2D) || node.parent?.getComponent(RigidBody2D);
                // 如果纵向速度大于 -1.0 (说明不是在快速下落)，则认为是堆叠上来的
                if (rb && rb.linearVelocity.y > -1.0) {
                    hasStableCat = true;
                }
            });
        }

        // 3. 根据是否有停稳的猫咪执行逻辑
        if (hasStableCat) {
            this._timer += dt;

            // 只要有猫在这个区域停住，就开始闪烁预警
            this.startFlashing();

            if (this._timer >= this.limitTime) {
                console.warn("[Deadline] GAME OVER triggered!");
                GameManager.instance.gameOver();
                this._timer = 0;
                // 游戏结束时让线彻底变红并常亮
                this.showSteady();
            }
        } else {
            // 如果只是猫咪快速经过，或者区域内没猫，则重置计时器并停止闪烁
            this._timer = 0;
            this.stopFlashing();
        }
    }
    private startFlashing() {
        if (this._isFlashing || !this._uiOpacity) return;
        this._isFlashing = true;

        // 呼吸闪烁效果
        tween(this._uiOpacity)
            .to(0.3, { opacity: 255 })
            .to(0.3, { opacity: 80 })
            .union()
            .repeatForever()
            .start();
    }

    private stopFlashing() {
        if (!this._isFlashing) return;
        this._isFlashing = false;
        Tween.stopAllByTarget(this._uiOpacity);
        // 停止后恢复到 80 的半透明状态
        if (this._uiOpacity) this._uiOpacity.opacity = 80;
    }

    private showSteady() {
        Tween.stopAllByTarget(this._uiOpacity);
        if (this._uiOpacity) this._uiOpacity.opacity = 255;

        // 变红
        const sprite = this.getComponent(Sprite);
        if (sprite) {
            sprite.color = new Color(255, 0, 0, 255);
        }
    }
}
