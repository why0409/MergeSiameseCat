import { _decorator, Component, Node, SubContextView, log } from 'cc';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

/**
 * 微信排行榜显示控制（主域侧）
 */
@ccclass('WeChatRank')
export class WeChatRank extends Component {
    @property({ type: Node, tooltip: '排行榜面板（内含 SubContextView）' })
    public rankPanel: Node = null!;

    private subContextView: SubContextView | null = null;

    onLoad() {
        if (this.rankPanel) {
            this.rankPanel.active = false;
            this.subContextView = this.rankPanel.getComponentInChildren(SubContextView);
        } else {
            log('WeChatRank: rankPanel NOT found!');
        }
    }

    /**
     * 打开并刷新排行榜
     */
    public showFriendRank() {
        if (!this.rankPanel) {
            log('showFriendRank: rankPanel is null!');
            return;
        }

        this.rankPanel.active = true;
        // 确保排行榜面板显示在最顶层，避免被结算面板遮挡
        this.rankPanel.setSiblingIndex(
            this.rankPanel.parent ? this.rankPanel.parent.children.length - 1 : 999,
        );

        if (typeof wx !== 'undefined') {
            const score = localStorage.getItem(GameConfig.storageKey) || '0';
            wx.getOpenDataContext().postMessage({
                command: 'showFriendRank',
                score,
            });
        } else {
            log('WeChat Rank is only available on WeChat platform.');
        }
    }

    /**
     * 关闭排行榜
     */
    public hideFriendRank() {
        if (this.rankPanel) {
            this.rankPanel.active = false;
        }
    }
}
