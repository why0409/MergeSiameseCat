import {
    _decorator, Component, Node, Label, Sprite, Color, UITransform, Graphics,
    Button, find, Widget, resources, SpriteFrame,
} from 'cc';
import { GameConfig } from './GameConfig';

const { ccclass } = _decorator;
const T = GameConfig.theme;

/**
 * 运行时暹罗猫主题：色板 + Graphics 面板；若 resources/UI 下有贴图则叠加使用。
 * 由 GameManager.setupUI 主动调用 apply()。
 */
@ccclass('SiameseUITheme')
export class SiameseUITheme extends Component {
    /** 场景重载后允许再次应用 */
    public static resetFlag() {
        // reserved
    }

    public static apply(canvas: Node | null) {
        if (!canvas || !canvas.isValid) return;

        // 1) 全屏柔和奶油底（在最底层画一层，避免盖住物理墙）
        SiameseUITheme.ensurePlayfieldBackdrop(canvas);

        // 2) 顶栏
        const topBar = find('TopBar', canvas) || canvas.getChildByName('TopBar');
        if (topBar) SiameseUITheme.styleTopBar(topBar);

        // 3) 分数 / 最高分 / 连击
        SiameseUITheme.styleLabelByPath(canvas, 'TopBar/Label', {
            color: T.scoreText,
            fontSize: 42,
            outline: T.creamSoft,
            outlineWidth: 2,
        });
        // 场景里分数 Label 直接叫 Label，也可能是 ScoreLabel
        const scoreNode = find('TopBar/Label', canvas);
        if (scoreNode) {
            const lb = scoreNode.getComponent(Label);
            if (lb && (lb.string === 'label' || lb.string === 'Label')) lb.string = '0';
        }
        SiameseUITheme.styleLabelByPath(canvas, 'TopBar/HighScoreLabel', {
            color: T.gold,
            fontSize: 28,
            outline: T.chocolate,
            outlineWidth: 1,
        });
        const combo = find('ComboLabel', canvas) || canvas.getChildByName('ComboLabel');
        if (combo) {
            const lb = combo.getComponent(Label) || combo.getComponentInChildren(Label);
            if (lb) {
                lb.color = T.combo;
                lb.fontSize = 48;
                lb.enableOutline = true;
                lb.outlineColor = T.creamSoft;
                lb.outlineWidth = 3;
            }
        }

        // 4) 开始面板
        const startPanel = find('StartPanel', canvas) || canvas.getChildByName('StartPanel');
        if (startPanel) SiameseUITheme.styleStartPanel(startPanel);

        // 5) 结算面板
        const gameOver = find('GameOverPanel', canvas) || canvas.getChildByName('GameOverPanel');
        if (gameOver) SiameseUITheme.styleGameOverPanel(gameOver);

        // 6) 排行榜关按钮
        const closeBtn = find('RankPanel/CloseButton', canvas);
        if (closeBtn) SiameseUITheme.styleButton(closeBtn, T.secondaryBtn, '关闭');

        // 7) Deadline 默认色（预警前半透明奶油线，危险时脚本会改红）
        const deadline = find('Deadline', canvas) || canvas.getChildByName('Deadline');
        if (deadline) {
            const sp = deadline.getComponent(Sprite);
            if (sp) sp.color = T.dangerSoft;
        }

        // 8) 尝试加载 resources/UI 贴图增强（编辑器导入 bundle 后生效）
        SiameseUITheme.tryLoadSprites(canvas);
    }

    private static tryLoadSprites(canvas: Node) {
        const loadSf = (path: string, cb: (sf: SpriteFrame) => void) => {
            resources.load(path, SpriteFrame, (err, sf) => {
                if (!err && sf) {
                    cb(sf);
                    return;
                }
                // 兼容 path 未带 /spriteFrame 的情况
                resources.load(path + '/spriteFrame', SpriteFrame, (err2, sf2) => {
                    if (!err2 && sf2) cb(sf2);
                });
            });
        };

        loadSf('UI/ui_title_cat', (sf) => {
            const startPanel = find('StartPanel', canvas) || canvas.getChildByName('StartPanel');
            if (!startPanel) return;
            let mascot = startPanel.getChildByName('ThemeMascot');
            if (!mascot) {
                mascot = new Node('ThemeMascot');
                startPanel.addChild(mascot);
                mascot.setPosition(0, 420, 0);
                mascot.addComponent(UITransform).setContentSize(180, 180);
                const sp = mascot.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                sp.spriteFrame = sf;
            } else {
                const sp = mascot.getComponent(Sprite);
                if (sp) sp.spriteFrame = sf;
            }
        });

        loadSf('UI/ui_btn_primary', (sf) => {
            const startBtn = find('StartPanel/Start', canvas);
            SiameseUITheme.applySpriteToButton(startBtn, sf);
            const restart = find('GameOverPanel/ContentBox/RestartBtn', canvas);
            SiameseUITheme.applySpriteToButton(restart, sf);
        });

        loadSf('UI/ui_btn_secondary', (sf) => {
            const rank = find('StartPanel/Rank', canvas);
            SiameseUITheme.applySpriteToButton(rank, sf);
            const rank2 = find('GameOverPanel/ContentBox/RankBtn', canvas);
            SiameseUITheme.applySpriteToButton(rank2, sf);
        });
    }

    private static applySpriteToButton(btnNode: Node | null, sf: SpriteFrame) {
        if (!btnNode) return;
        const sp = btnNode.getComponent(Sprite);
        if (sp) {
            sp.spriteFrame = sf;
            sp.type = Sprite.Type.SLICED;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.color = Color.WHITE;
        }
        const btn = btnNode.getComponent(Button);
        if (btn) {
            btn.transition = Button.Transition.COLOR;
            btn.normalColor = Color.WHITE;
            btn.pressedColor = new Color(220, 220, 220, 255);
            btn.hoverColor = Color.WHITE;
        }
        // 有贴图后去掉手绘描边框，避免叠层
        const frame = btnNode.getChildByName('ThemeFrame');
        if (frame) frame.active = false;

        const label = btnNode.getComponentInChildren(Label);
        if (label) {
            label.color = T.buttonText;
            label.enableOutline = true;
            label.outlineColor = T.creamSoft;
            label.outlineWidth = 1;
        }
    }

    // ───────── building blocks ─────────

    private static ensurePlayfieldBackdrop(canvas: Node) {
        let bg = canvas.getChildByName('SiameseBackdrop');
        if (!bg) {
            bg = new Node('SiameseBackdrop');
            canvas.insertChild(bg, 0);
            const ut = bg.addComponent(UITransform);
            ut.setContentSize(GameConfig.designWidth, 1280);
            const g = bg.addComponent(Graphics);
            SiameseUITheme.paintBackdrop(g);
            // 尽量贴满
            const w = bg.addComponent(Widget);
            w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
            w.top = w.bottom = w.left = w.right = 0;
            w.alignMode = 2;
            w.updateAlignment();
        } else {
            const g = bg.getComponent(Graphics);
            if (g) SiameseUITheme.paintBackdrop(g);
        }
    }

    private static paintBackdrop(g: Graphics) {
        g.clear();
        const W = GameConfig.designWidth;
        const H = 1400;
        // 垂直奶油渐变条带
        const steps = 12;
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const r = Math.round(255 - t * 12);
            const gr = Math.round(250 - t * 14);
            const b = Math.round(242 - t * 18);
            g.fillColor = new Color(r, gr, b, 255);
            const y0 = H / 2 - (i / steps) * H;
            const y1 = H / 2 - ((i + 1) / steps) * H;
            g.rect(-W / 2, y1, W, y0 - y1 + 1);
            g.fill();
        }
        // 顶部浅金装饰条
        g.fillColor = new Color(T.gold.r, T.gold.g, T.gold.b, 40);
        g.rect(-W / 2, 520, W, 80);
        g.fill();
        // 底部浅巧克力
        g.fillColor = new Color(T.chocolate.r, T.chocolate.g, T.chocolate.b, 28);
        g.rect(-W / 2, -640, W, 100);
        g.fill();
        // 角落爪印装饰（简化圆点）
        g.fillColor = new Color(T.chocolateMid.r, T.chocolateMid.g, T.chocolateMid.b, 22);
        const paws = [
            [-280, 480], [280, 460], [-300, -500], [300, -480],
        ];
        for (const [px, py] of paws) {
            SiameseUITheme.drawPaw(g, px, py, 14);
        }
    }

    private static drawPaw(g: Graphics, x: number, y: number, s: number) {
        g.circle(x, y - s * 0.2, s * 0.55);
        g.fill();
        g.circle(x - s * 0.7, y + s * 0.55, s * 0.28);
        g.fill();
        g.circle(x - s * 0.2, y + s * 0.75, s * 0.28);
        g.fill();
        g.circle(x + s * 0.25, y + s * 0.75, s * 0.28);
        g.fill();
        g.circle(x + s * 0.7, y + s * 0.5, s * 0.28);
        g.fill();
    }

    private static styleTopBar(topBar: Node) {
        const sp = topBar.getComponent(Sprite);
        if (sp) {
            sp.color = new Color(T.cream.r, T.cream.g, T.cream.b, 230);
        }
        // 底部描边感：若有 Graphics 则重画，否则加一层细线节点
        let line = topBar.getChildByName('ThemeUnderline');
        if (!line) {
            line = new Node('ThemeUnderline');
            topBar.addChild(line);
            const ut = line.addComponent(UITransform);
            ut.setContentSize(GameConfig.designWidth, 4);
            line.setPosition(0, -36, 0);
            const g = line.addComponent(Graphics);
            g.fillColor = T.gold;
            g.rect(-GameConfig.designWidth / 2, -2, GameConfig.designWidth, 4);
            g.fill();
            // 中央小蓝点（眼睛强调）
            g.fillColor = T.blueEye;
            g.circle(0, 0, 5);
            g.fill();
        }
    }

    private static styleStartPanel(panel: Node) {
        // 半透明巧克力遮罩
        const dim = panel.getChildByName('Sprite');
        if (dim) {
            const sp = dim.getComponent(Sprite);
            if (sp) sp.color = T.overlay;
        }

        // 中央卡片
        let card = panel.getChildByName('ThemeCard');
        if (!card) {
            card = new Node('ThemeCard');
            panel.insertChild(card, 1);
            const ut = card.addComponent(UITransform);
            ut.setContentSize(560, 720);
            card.setPosition(0, 40, 0);
            const g = card.addComponent(Graphics);
            SiameseUITheme.drawPanelCard(g, 560, 720);
        }

        // 标题装饰（猫耳 + 文字节点若存在则染色）
        let title = panel.getChildByName('ThemeTitle');
        if (!title) {
            title = new Node('ThemeTitle');
            panel.addChild(title);
            title.setPosition(0, 280, 0);
            const ut = title.addComponent(UITransform);
            ut.setContentSize(480, 140);
            const g = title.addComponent(Graphics);
            SiameseUITheme.drawTitleBadge(g);

            const textNode = new Node('TitleText');
            title.addChild(textNode);
            textNode.setPosition(0, -10, 0);
            textNode.addComponent(UITransform).setContentSize(400, 60);
            const lb = textNode.addComponent(Label);
            lb.string = '合成大暹罗';
            lb.fontSize = 48;
            lb.color = T.chocolate;
            lb.horizontalAlign = 1; // CENTER
            lb.verticalAlign = 1;
            lb.enableOutline = true;
            lb.outlineColor = T.creamSoft;
            lb.outlineWidth = 2;

            const sub = new Node('Subtitle');
            title.addChild(sub);
            sub.setPosition(0, -58, 0);
            sub.addComponent(UITransform).setContentSize(400, 36);
            const subLb = sub.addComponent(Label);
            subLb.string = 'Merge · Siamese Cat';
            subLb.fontSize = 22;
            subLb.color = T.chocolateMid;
            subLb.horizontalAlign = 1;
        }

        // 按钮
        const startBtn = panel.getChildByName('Start');
        if (startBtn) SiameseUITheme.styleButton(startBtn, T.buttonFill, '开始游戏', true);
        const rankBtn = panel.getChildByName('Rank');
        if (rankBtn) SiameseUITheme.styleButton(rankBtn, T.secondaryBtn, '好友排行');
    }

    private static styleGameOverPanel(panel: Node) {
        const sp = panel.getComponent(Sprite);
        if (sp) sp.color = T.overlay;

        const box = panel.getChildByName('ContentBox');
        if (box) {
            // 用 Graphics 盖一层主题卡片
            let decor = box.getChildByName('ThemeCard');
            if (!decor) {
                decor = new Node('ThemeCard');
                box.insertChild(decor, 0);
                const ut = decor.addComponent(UITransform);
                ut.setContentSize(520, 560);
                const g = decor.addComponent(Graphics);
                SiameseUITheme.drawPanelCard(g, 520, 560);
            }
            // 弱化原白底 sprite
            const boxSp = box.getComponent(Sprite);
            if (boxSp) boxSp.color = new Color(255, 255, 255, 0);
        }

        const title = find('ContentBox/Title', panel);
        if (title) {
            const lb = title.getComponent(Label);
            if (lb) {
                lb.string = '本局结束';
                lb.color = T.chocolate;
                lb.fontSize = 44;
                lb.enableOutline = true;
                lb.outlineColor = T.goldSoft;
                lb.outlineWidth = 2;
            }
        }
        const finalScore = find('ContentBox/FinalScoreLabel', panel);
        if (finalScore) {
            const lb = finalScore.getComponent(Label);
            if (lb) {
                lb.color = T.scoreText;
                lb.fontSize = 36;
            }
        }
        const restart = find('ContentBox/RestartBtn', panel);
        if (restart) SiameseUITheme.styleButton(restart, T.buttonFill, '再来一局', true);
        const rank = find('ContentBox/RankBtn', panel);
        if (rank) SiameseUITheme.styleButton(rank, T.secondaryBtn, '好友排行');
    }

    private static drawPanelCard(g: Graphics, w: number, h: number) {
        g.clear();
        const hw = w / 2;
        const hh = h / 2;
        const r = 28;
        // 阴影
        g.fillColor = new Color(40, 28, 24, 50);
        SiameseUITheme.roundRect(g, -hw + 6, -hh - 8, w, h, r);
        g.fill();
        // 主体奶油
        g.fillColor = T.creamSoft;
        SiameseUITheme.roundRect(g, -hw, -hh, w, h, r);
        g.fill();
        // 金边
        g.strokeColor = T.gold;
        g.lineWidth = 4;
        SiameseUITheme.roundRect(g, -hw + 2, -hh + 2, w - 4, h - 4, r - 2);
        g.stroke();
        // 内描边巧克力
        g.strokeColor = new Color(T.chocolate.r, T.chocolate.g, T.chocolate.b, 60);
        g.lineWidth = 2;
        SiameseUITheme.roundRect(g, -hw + 10, -hh + 10, w - 20, h - 20, r - 6);
        g.stroke();
        // 顶饰蓝点（眼睛）
        g.fillColor = T.blueEye;
        g.circle(-18, hh - 36, 7);
        g.fill();
        g.circle(18, hh - 36, 7);
        g.fill();
        g.fillColor = T.white;
        g.circle(-16, hh - 34, 2.5);
        g.fill();
        g.circle(20, hh - 34, 2.5);
        g.fill();
    }

    private static drawTitleBadge(g: Graphics) {
        g.clear();
        // 猫耳
        g.fillColor = T.sealPoint;
        g.moveTo(-90, 20);
        g.lineTo(-55, 70);
        g.lineTo(-25, 25);
        g.close();
        g.fill();
        g.moveTo(90, 20);
        g.lineTo(55, 70);
        g.lineTo(25, 25);
        g.close();
        g.fill();
        // 内耳粉
        g.fillColor = new Color(230, 180, 170, 255);
        g.moveTo(-78, 28);
        g.lineTo(-55, 58);
        g.lineTo(-40, 30);
        g.close();
        g.fill();
        g.moveTo(78, 28);
        g.lineTo(55, 58);
        g.lineTo(40, 30);
        g.close();
        g.fill();
        // 脸椭圆
        g.fillColor = T.creamSoft;
        g.ellipse(0, 0, 100, 55);
        g.fill();
        g.strokeColor = T.chocolateMid;
        g.lineWidth = 3;
        g.ellipse(0, 0, 100, 55);
        g.stroke();
        // 眼睛
        g.fillColor = T.blueEye;
        g.ellipse(-32, 8, 14, 18);
        g.fill();
        g.ellipse(32, 8, 14, 18);
        g.fill();
        g.fillColor = T.white;
        g.circle(-28, 14, 4);
        g.fill();
        g.circle(36, 14, 4);
        g.fill();
        // 鼻子
        g.fillColor = new Color(200, 140, 140, 255);
        g.moveTo(0, -6);
        g.lineTo(-8, -16);
        g.lineTo(8, -16);
        g.close();
        g.fill();
    }

    private static roundRect(g: Graphics, x: number, y: number, w: number, h: number, r: number) {
        const rr = Math.min(r, w / 2, h / 2);
        g.moveTo(x + rr, y);
        g.lineTo(x + w - rr, y);
        g.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
        g.lineTo(x + w, y + h - rr);
        g.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
        g.lineTo(x + rr, y + h);
        g.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
        g.lineTo(x, y + rr);
        g.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
        g.close();
    }

    private static styleButton(btnNode: Node, fill: Color, text?: string, primary = false) {
        const sp = btnNode.getComponent(Sprite);
        if (sp) {
            sp.color = fill;
        }
        const btn = btnNode.getComponent(Button);
        if (btn) {
            btn.transition = Button.Transition.COLOR;
            btn.normalColor = fill;
            btn.hoverColor = new Color(
                Math.min(255, fill.r + 15),
                Math.min(255, fill.g + 15),
                Math.min(255, fill.b + 10),
                255,
            );
            btn.pressedColor = T.buttonPressed;
            btn.disabledColor = new Color(fill.r, fill.g, fill.b, 120);
        }
        // 圆角描边装饰
        let frame = btnNode.getChildByName('ThemeFrame');
        if (!frame) {
            frame = new Node('ThemeFrame');
            btnNode.addChild(frame);
            const ut = btnNode.getComponent(UITransform);
            const w = ut ? ut.width : 220;
            const h = ut ? ut.height : 70;
            frame.addComponent(UITransform).setContentSize(w, h);
            const g = frame.addComponent(Graphics);
            g.strokeColor = primary ? T.chocolate : T.chocolateMid;
            g.lineWidth = primary ? 3 : 2;
            SiameseUITheme.roundRect(g, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, Math.min(h / 2, 18));
            g.stroke();
            if (primary) {
                g.strokeColor = new Color(T.gold.r, T.gold.g, T.gold.b, 180);
                g.lineWidth = 2;
                SiameseUITheme.roundRect(g, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, Math.min(h / 2, 14));
                g.stroke();
            }
        }
        if (text) {
            const label = btnNode.getComponentInChildren(Label);
            if (label) {
                label.string = text;
                label.color = T.buttonText;
                label.fontSize = primary ? 34 : 30;
                label.enableOutline = true;
                label.outlineColor = T.creamSoft;
                label.outlineWidth = 1;
            }
        }
    }

    private static styleLabelByPath(
        root: Node,
        path: string,
        opt: { color: Color; fontSize: number; outline?: Color; outlineWidth?: number },
    ) {
        const n = find(path, root);
        if (!n) return;
        const lb = n.getComponent(Label);
        if (!lb) return;
        lb.color = opt.color;
        lb.fontSize = opt.fontSize;
        if (opt.outline) {
            lb.enableOutline = true;
            lb.outlineColor = opt.outline;
            lb.outlineWidth = opt.outlineWidth ?? 2;
        }
    }
}
