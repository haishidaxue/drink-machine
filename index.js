// pages/index/index.js
const app = getApp();

const DRINKS = [
  { id: 'd1', name: '橙香醒力饮', desc: '橙汁乌龙 · 清爽提神', price: 18 },
  { id: 'd2', name: '云栖松烟', desc: '牛奶红茶 · 醇厚松烟香', price: 19 },
  { id: 'd3', name: '金橙轻享特调', desc: 'AI 配比 · 当日特调', price: 17 }
];
const MILK = { cow: 0, oat: 2, coco: 2, soy: 1 };

Page({
  data: {
    drinks: DRINKS,
    milkTypes: [
      { v: 'cow', label: '牛奶' },
      { v: 'oat', label: '燕麦奶 +2' },
      { v: 'coco', label: '椰奶 +2' },
      { v: 'soy', label: '豆奶 +1' }
    ],
    currentId: 'd1',
    mtype: 'cow',
    total: DRINKS[0].price,
    paying: false,
    paid: false,
    paidOrder: { code: '' }
  },

  pickDrink(e) {
    this.setData({ currentId: e.currentTarget.dataset.id }, this.calc);
  },
  setMtype(e) {
    this.setData({ mtype: e.currentTarget.dataset.v }, this.calc);
  },
  calc() {
    const d = DRINKS.find(x => x.id === this.data.currentId) || DRINKS[0];
    const total = d.price + (MILK[this.data.mtype] || 0);
    this.setData({ total });
  },

  onPay() {
    if (this.data.paying) return;
    this.setData({ paying: true });
    const apiBase = app.globalData.apiBase;
    const item = (DRINKS.find(x => x.id === this.data.currentId) || DRINKS[0]);

    // 1) 后端统一下单，返回 JSAPI 参数（由商户私钥签名，密钥不在小程序里）
    wx.request({
      url: apiBase + '/api/pay/create',
      method: 'POST',
      data: {
        method: 'wechat',
        scene: 'mp',
        amount: this.data.total,
        item: item.name,
        openidToken: app.globalData.openidToken
      },
      success: (r) => {
        const j = r.data || {};
        if (!j.jsapi) {
          this.setData({ paying: false });
          wx.showModal({ title: '暂时无法支付', showCancel: false,
            content: j.need ? ('后端缺少：' + j.need.join('、')) : (j.error || '下单失败') });
          return;
        }
        const p = j.jsapi;
        // 2) 在当前页面直接唤起微信支付（就是美团/京东小程序那种弹窗）
        wx.requestPayment({
          timeStamp: p.timeStamp,
          nonceStr: p.nonceStr,
          package: p.package,
          signType: p.signType,
          paySign: p.paySign,
          success: () => this.confirmPaid(j.orderId),
          fail: () => { this.setData({ paying: false }); wx.showToast({ title: '已取消支付', icon: 'none' }); }
        });
      },
      fail: () => {
        this.setData({ paying: false });
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  // 3) 支付完成后以后端回调确认为准（防前端伪造），轮询到 paid 才出餐
  confirmPaid(orderId) {
    const apiBase = app.globalData.apiBase;
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      wx.request({
        url: apiBase + '/api/pay/status?orderId=' + orderId,
        success: (r) => {
          if (r.data && r.data.status === 'paid') {
            clearInterval(timer);
            this.setData({
              paying: false,
              paid: true,
              paidOrder: { code: String(orderId).replace(/\D/g, '').slice(-6) || '------' }
            });
          } else if (tries > 10) {
            clearInterval(timer);
            this.setData({ paying: false });
            wx.showToast({ title: '到账确认中，请稍候', icon: 'none' });
          }
        },
        fail: () => { if (tries > 10) { clearInterval(timer); this.setData({ paying: false }); } }
      });
    }, 1000);
  },

  closeDone() {
    this.setData({ paid: false });
  }
});
