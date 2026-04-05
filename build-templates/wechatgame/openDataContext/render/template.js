/**
 * 渲染模板函数
 * @param {Object} it 数据对象，包含 data 数组
 */
module.exports = function(it) {
    var out = '<view class="container" id="main"> <view class="header"> <text class="title" value="好友排行"></text> </view> <view class="rankList"> <scrollview class="list"> ';
    
    var data = it.data || [];
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        var isOdd = i % 2 === 1;
        var listItemClass = isOdd ? "listItem listItemOld" : "listItem";
        
        out += ' <view class="' + listItemClass + '"> ' +
               ' <view id="listItemUserData"> ' +
               ' <text class="listItemNum" value="' + (i + 1) + '"></text> ' +
               ' <image class="listHeadImg" src="' + (item.avatarUrl) + '"></image> ' +
               ' <text class="listItemName" value="' + (item.nickname) + '"></text> ' +
               ' </view> ' +
               ' <text class="listItemScore" value="' + (item.rankScore) + '"></text> ' +
               ' </view> ';
    }
    
    out += ' </scrollview> <text class="listTips" value="仅展示前 ' + data.length + ' 位好友排名"></text> </view></view>';
    return out;
};
