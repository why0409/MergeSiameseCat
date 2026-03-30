import { _decorator, Component, Node, SubContextView, log } from 'cc';
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
        log("WeChatRank onLoad");
        if (this.rankPanel) {
            this.rankPanel.active = false;
            this.subContextView = this.rankPanel.getComponentInChildren(SubContextView);
            log("WeChatRank: rankPanel found, subContextView:", this.subContextView != null);
        } else {
            log("WeChatRank: rankPanel NOT found!");
        }
    }

    /**
     * 打开并刷新排行榜
     */
    public showFriendRank() {
        log("showFriendRank called");
        if (!this.rankPanel) {
            log("showFriendRank: rankPanel is null!");
            return;
        }
        
        log("showFriendRank: setting rankPanel active and bringing to front");
        this.rankPanel.active = true;
        // 确保排行榜面板显示在最顶层，避免被结算面板遮挡
        this.rankPanel.setSiblingIndex(this.rankPanel.parent ? this.rankPanel.parent.children.length - 1 : 999);

        if (typeof wx !== 'undefined') {
            log("showFriendRank: sending message to openDataContext");
            // 给子域（开放数据域）发消息，通知其渲染排行榜
            wx.getOpenDataContext().postMessage({
                command: 'showFriendRank',
                score: localStorage.getItem('highestScore_Cat') || '0'
            });
        } else {
            log("WeChat Rank is only available on WeChat platform.");
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
