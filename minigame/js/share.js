/**
 * 微信分享：右上角「转发」默认是关的，必须 showShareMenu + onShareAppMessage。
 */
const isWx = typeof wx !== 'undefined';

const SHARE_IMAGE = 'images/share.jpg';

function payload(opts) {
  const score = Math.floor(Number(opts && opts.score) || 0);
  return {
    title: score > 0
      ? `我在《合成大暹罗》拿到 ${score} 分，来挑战！`
      : '《合成大暹罗》一起来合成猫猫',
    imageUrl: SHARE_IMAGE,
    query: score > 0 ? `from=share&score=${score}` : 'from=share',
  };
}

function bind(getScore) {
  if (!isWx) return;
  const pack = () => payload({ score: typeof getScore === 'function' ? getScore() : 0 });
  try {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }
    if (wx.onShareAppMessage) wx.onShareAppMessage(pack);
    if (wx.onShareTimeline) {
      wx.onShareTimeline(() => {
        const p = pack();
        return { title: p.title, imageUrl: p.imageUrl, query: p.query };
      });
    }
  } catch (err) {
    console.warn('[share] bind fail', err);
  }
}

function share(opts) {
  const p = payload(opts || {});
  if (isWx && typeof wx.shareAppMessage === 'function') {
    try {
      wx.shareAppMessage(p);
      return true;
    } catch (err) {
      console.warn('[share] fail', err);
      return false;
    }
  }
  return false;
}

module.exports = { bind, share, payload };
