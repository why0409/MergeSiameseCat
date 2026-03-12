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
        if (this.rankPanel) {
            this.rankPanel.active = false;
            this.subContextView = this.rankPanel.getComponentInChildren(SubContextView);
        }
    }

    /**
     * 打开并刷新排行榜
     */
    public showFriendRank() {
        if (!this.rankPanel) return;
        
        this.rankPanel.active = true;

        if (typeof wx !== 'undefined') {
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
