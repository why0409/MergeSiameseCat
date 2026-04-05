const style = require('./render/style');
const template = require('./render/template');
const Layout = require('./engine').default;

let __env = GameGlobal.wx || GameGlobal.tt || GameGlobal.swan;
let sharedCanvas = __env.getSharedCanvas();
let sharedContext = sharedCanvas.getContext('2d');

/**
 * 绘图函数
 */
function draw(dataList) {
    Layout.clear();
    // 渲染获取到的数据
    const xml = template({ data: dataList });
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
            console.log('OpenDataContext: getFriendCloudStorage success', res.data.length);
            
            // 提取数据并格式化
            let data = res.data.map(user => {
                let score = 0;
                if (user.KVDataList && user.KVDataList.length > 0) {
                    // 查找 key 为 'score' 的项
                    const scoreItem = user.KVDataList.find(kv => kv.key === 'score');
                    score = parseInt(scoreItem ? scoreItem.value : '0');
                }
                return {
                    nickname: user.nickname,
                    avatarUrl: user.avatarUrl,
                    rankScore: score
                };
            });

            // 按分数从大到小排序
            data.sort((a, b) => b.rankScore - a.rankScore);

            // 执行渲染
            draw(data);
        },
        fail: (err) => {
            console.error('OpenDataContext: getFriendCloudStorage fail', err);
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
        // 收到视口更新后，如果已经有数据可以重绘，否则可以清空或绘制空列表
    } else if (data.command === 'showFriendRank') {
        // 收到主域显示的命令，开始拉取真实数据
        fetchFriendData();
    }
});
