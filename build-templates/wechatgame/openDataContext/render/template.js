/**
 * 渲染模板函数
 * @param {Object} it 数据对象，包含 data 数组
 */
module.exports = function(it) {
    var out = '<view class="container" id="main"> <view class="header"> <text class="title" value="好友排行"></text> </view> <view class="rankList"> <scrollview class="list"> ';

    var data = it.data || [];
    if (data.length === 0) {
        out += ' <view class="listItem"> ' +
               ' <text class="listItemName" value="暂无好友数据"></text> ' +
               ' </view> ';
    } else {
        for (var i = 0; i < data.length; i++) {
            var item = data[i];
            var isOdd = i % 2 === 1;
            var listItemClass = isOdd ? "listItem listItemOld" : "listItem";
            var avatar = item.avatarUrl || '';
            var name = item.nickname || '好友';
            var score = (typeof item.rankScore === 'number' && isFinite(item.rankScore))
                ? item.rankScore
                : 0;

            out += ' <view class="' + listItemClass + '"> ' +
                   ' <view id="listItemUserData"> ' +
                   ' <text class="listItemNum" value="' + (i + 1) + '"></text> ' +
                   ' <image class="listHeadImg" src="' + avatar + '"></image> ' +
                   ' <text class="listItemName" value="' + name + '"></text> ' +
                   ' </view> ' +
                   ' <text class="listItemScore" value="' + score + '"></text> ' +
                   ' </view> ';
        }
    }

    out += ' </scrollview> <text class="listTips" value="仅展示前 ' + data.length + ' 位好友排名"></text> </view></view>';
    return out;
};
