import {
    _decorator, Component, Node, Collider2D, Contact2DType, RigidBody2D,
    UIOpacity, Tween, tween, Color, Sprite, ERigidBody2DType, UITransform,
} from 'cc';
import { GameManager } from './GameManager';
import { Cat } from './Cat';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;
const T = GameConfig.theme;

@ccclass('Deadline')
export class Deadline extends Component {
    @property({ tooltip: '触发死亡的停留时间 (秒)' })
    public limitTime: number = GameConfig.deadlineStableTime;

    private _warningCats: Map<string, Node> = new Map();
    private _timer: number = 0;
    private _uiOpacity: UIOpacity | null = null;
    private _isFlashing: boolean = false;
    private _collider: Collider2D | null = null;

    onLoad() {
        this._uiOpacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
        if (this._uiOpacity) this._uiOpacity.opacity = 0;

        const transform = this.getComponent(UITransform);
        if (transform) {
            if (transform.contentSize.width === 0) transform.setContentSize(720, 5);
        }

        const sprite = this.getComponent(Sprite);
        if (sprite) {
            sprite.color = T.dangerSoft;
        }

        this.node.setSiblingIndex(this.node.parent ? this.node.parent.children.length - 1 : 100);
        this._collider = this.getComponent(Collider2D);
    }

    onEnable() {
        if (this._collider) {
            this._collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this._collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }

    onDisable() {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this._collider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
        this.stopFlashing(true);
        this._warningCats.clear();
        this._timer = 0;
    }

    private findCat(node: Node): Cat | null {
        return node.getComponent(Cat)
            || node.getComponentInChildren(Cat)
            || node.parent?.getComponent(Cat)
            || null;
    }

    private findRb(node: Node): RigidBody2D | null {
        return node.getComponent(RigidBody2D)
            || node.parent?.getComponent(RigidBody2D)
            || node.getComponentInChildren(RigidBody2D)
            || null;
    }

    private onBeginContact(_self: Collider2D, other: Collider2D) {
        if (!other || !other.node) return;
        const otherNode = other.node;
        const cat = this.findCat(otherNode);
        const rb = this.findRb(otherNode);

        if (cat && !cat.isMerging && rb && rb.type === ERigidBody2DType.Dynamic) {
            this._warningCats.set(otherNode.uuid, otherNode);
        }
    }

    private onEndContact(_self: Collider2D, other: Collider2D) {
        if (other && otherNodeValid(other) && this._warningCats.has(other.node.uuid)) {
            this._warningCats.delete(other.node.uuid);
            if (this._warningCats.size === 0) {
                this._timer = 0;
                this.stopFlashing(true);
            }
        }
    }

    update(dt: number) {
        if (!GameManager.instance || GameManager.instance.isGameOver) return;

        // 1. 清理无效 / 合成中的节点
        if (this._warningCats.size > 0) {
            const keysToRemove: string[] = [];
            this._warningCats.forEach((node, uuid) => {
                if (!node || !node.isValid || !node.parent) {
                    keysToRemove.push(uuid);
                    return;
                }
                const cat = this.findCat(node);
                if (cat && cat.isMerging) {
                    keysToRemove.push(uuid);
                }
            });
            keysToRemove.forEach(k => this._warningCats.delete(k));
            if (this._warningCats.size === 0) {
                this._timer = 0;
                this.stopFlashing(true);
            }
        }

        // 2. 核心判定：区域内猫咪“停稳”（速度接近 0）
        let hasStableCat = false;
        if (this._warningCats.size > 0) {
            this._warningCats.forEach((node) => {
                const cat = this.findCat(node);
                if (cat?.isMerging) return;
                const rb = this.findRb(node);
                if (rb && rb.linearVelocity.y > GameConfig.deadlineStableVy) {
                    hasStableCat = true;
                }
            });
        }

        if (hasStableCat) {
            this._timer += dt;
            this.startFlashing();

            if (this._timer >= this.limitTime) {
                console.warn('[Deadline] GAME OVER triggered!');
                GameManager.instance.gameOver();
                this._timer = 0;
                this.showSteady();
            }
        } else {
            this._timer = 0;
            this.stopFlashing(true);
        }
    }

    private startFlashing() {
        if (this._isFlashing || !this._uiOpacity) return;
        this._isFlashing = true;

        const sprite = this.getComponent(Sprite);
        if (sprite) sprite.color = T.dangerSoft;

        tween(this._uiOpacity)
            .to(0.3, { opacity: 255 })
            .to(0.3, { opacity: 80 })
            .union()
            .repeatForever()
            .start();
    }

    /**
     * @param fullyHide 无猫时彻底隐藏（opacity=0）；仅暂停闪烁时保持半透明
     */
    private stopFlashing(fullyHide: boolean = false) {
        if (!this._isFlashing && fullyHide && this._uiOpacity) {
            this._uiOpacity.opacity = 0;
            return;
        }
        if (!this._isFlashing) return;
        this._isFlashing = false;
        if (this._uiOpacity) {
            Tween.stopAllByTarget(this._uiOpacity);
            this._uiOpacity.opacity = fullyHide ? 0 : 80;
        }
    }

    private showSteady() {
        if (this._uiOpacity) {
            Tween.stopAllByTarget(this._uiOpacity);
            this._uiOpacity.opacity = 255;
        }
        this._isFlashing = false;

        const sprite = this.getComponent(Sprite);
        if (sprite) {
            sprite.color = T.danger;
        }
    }
}

function otherNodeValid(other: Collider2D): boolean {
    return !!(other && other.node);
}
