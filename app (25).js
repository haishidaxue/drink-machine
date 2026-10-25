// app.js —— AI 现调茶饮机（微信小程序）
App({
  globalData: {
    // 部署后改成你的后端 https 地址（必须备案 https，且在小程序后台配置 request 合法域名）
    apiBase: 'https://你的域名',
    openidToken: ''
  },
  onLaunch() {
    // 用 wx.login 换 openidToken（后端调 jscode2session），支付 JSAPI 需要 openid
    const that = this;
    wx.login({
      success(res) {
        if (!res.code) return;
        wx.request({
          url: that.globalData.apiBase + '/api/wx/mp-login',
          method: 'POST',
          data: { code: res.code },
          success(r) {
            if (r.data && r.data.openidToken) that.globalData.openidToken = r.data.openidToken;
          }
        });
      }
    });
  }
});
