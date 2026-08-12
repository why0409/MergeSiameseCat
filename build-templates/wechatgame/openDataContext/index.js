const style = require('./render/style');
const template = require('./render/template');
const Layout = require('./engine').default;

let __env = GameGlobal.wx || GameGlobal.tt || GameGlobal.swan;
let sharedCanvas = __env.getSharedCanvas();
let sharedContext = sharedCanvas.getContext('2d');

/** 最近一次排行数据，viewport 变化时可重绘 */
let lastDataList = [];

/**
 * 转义模板字符串，避免昵称中的引号/尖括号破坏子域 XML
 */
function escapeXml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function safeScore(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
}

/**
 * 绘图函数
 */
function draw(dataList) {
    lastDataList = dataList || [];
    Layout.clear();
    const xml = template({ data: lastDataList });
    Layout.init(xml, style);
    Layout.layout(sharedContext);
}

/**
 * 获取好友排行榜数据
 */
function fetchFriendData() {
    __env.getFriendCloudStorage({
        keyList: ['score'],
        success: (res) => {
            console.log('OpenDataContext: getFriendCloudStorage success', (res.data || []).length);

            let data = (res.data || []).map(user => {
                let score = 0;
                if (user.KVDataList && user.KVDataList.length > 0) {
                    const scoreItem = user.KVDataList.find(kv => kv.key === 'score');
                    score = safeScore(scoreItem ? scoreItem.value : '0');
                }
                return {
                    nickname: escapeXml(user.nickname || '好友'),
                    avatarUrl: user.avatarUrl || '',
                    rankScore: score
                };
            });

            data.sort((a, b) => b.rankScore - a.rankScore);
            draw(data);
        },
        fail: (err) => {
            console.error('OpenDataContext: getFriendCloudStorage fail', err);
            draw([]);
        }
    });
}

/**
 * 监听主域消息
 */
__env.onMessage(data => {
    if (data.type === 'engine' && data.event === 'viewport') {
        Layout.updateViewPort({
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
        });
        // 视口更新后用缓存数据重绘，避免白屏
        if (lastDataList && lastDataList.length > 0) {
            draw(lastDataList);
        }
    } else if (data.command === 'showFriendRank') {
        fetchFriendData();
    }
});
