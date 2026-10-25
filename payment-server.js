'use strict';
/* =============================================================================
 * 饮料机小程序 · 真实支付后端（零依赖，仅用 Node 内置模块）
 * -----------------------------------------------------------------------------
 * 作用：小程序前端不能直连微信支付/支付宝（密钥不能放前端、且平台要求服务端
 *       下单签名）。本服务负责：
 *         1) 接收前端下单（金额、商品、支付方式、场景）
 *         2) 用【商户私钥】签名，调用微信支付 v3 / 支付宝开放平台真实接口下单
 *         3) 返回真实收银台链接（H5 跳转 / Native 二维码串 / JSAPI 支付参数）
 *         4) 接收并【验签】支付结果异步通知，落盘订单；提供订单状态查询
 *
 * 支持：
 *   微信支付：Native（扫码）/ H5（手机浏览器）/ JSAPI（微信内，含网页授权换 openid）
 *   支付宝：alipay.trade.wap.pay（手机直接拉起支付宝，电脑端出扫码收银台）
 *
 * 启动：
 *   方式A 环境变量：  WX_MCHID=... WX_SERIAL=... node 真实支付后端_server.js
 *   方式B 配置文件：  在同目录放「支付配置.json」（可用 支付配置.example.json 复制）
 *   测试支付宝：     不填正式支付宝密钥时默认走支付宝【沙箱】，沙箱密钥可用
 *                    支付宝开放平台「研发服务-沙箱」里的密钥/密钥工具生成。
 *
 * 所有私钥只在本进程读取，绝不下发前端。
 * ===========================================================================*/

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL, URLSearchParams } = require('url');

/* ----------------------------- 配置加载 ----------------------------- */
const CFG_FILE = path.join(__dirname, '支付配置.json');
let fileCfg = {};
try { fileCfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch (e) { /* 无配置文件则用环境变量 */ }
const CFG = Object.assign({}, fileCfg, process.env);

function cfg(k, d) { return (CFG[k] !== undefined && CFG[k] !== '') ? CFG[k] : d; }

const PORT = +cfg('PORT', 8790);
const PUBLIC_BASE = String(cfg('PUBLIC_BASE', '')).replace(/\/+$/, ''); // 对外 https 域名，例如 https://pay.xxx.com
const FRONTEND_PAGE = cfg('FRONTEND_PAGE', '饮料机_高保真原型.html');
const ALLOW_ORIGIN = cfg('ALLOW_ORIGIN', '*');
const OWNER_KEY = cfg('OWNER_KEY', '');                       // 商家账本拉取流水所需的口令（自己设一个）
const ORDER_FILE = path.join(__dirname, 'orders.json');

const WX = {
  appid: cfg('WX_APPID', ''),
  mchid: cfg('WX_MCHID', ''),
  serial: cfg('WX_SERIAL', ''),           // 商户 API 证书序列号
  privateKey: cfg('WX_PRIVATE_KEY', '') || readKeyFile(cfg('WX_PRIVATE_KEY_PATH', '')),
  apiv3Key: cfg('WX_APIV3_KEY', ''),      // 32 位 APIv3 密钥
  appSecret: cfg('WX_APPSECRET', '')      // 公众号 secret，仅 JSAPI 网页授权需要
};
const ALI = {
  appid: cfg('ALI_APPID', ''),
  privateKey: cfg('ALI_PRIVATE_KEY', '') || readKeyFile(cfg('ALI_PRIVATE_KEY_PATH', '')),
  publicKey: cfg('ALI_PUBLIC_KEY', '') || readKeyFile(cfg('ALI_PUBLIC_KEY_PATH', '')),
  // 不配正式密钥时默认沙箱网关，配了正式 appid 即自动走正式网关
  gateway: cfg('ALI_GATEWAY', cfg('ALI_APPID', '') ? 'https://openapi.alipay.com/gateway.do'
                                                   : 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'),
  sandbox: !cfg('ALI_APPID', '')
};
function readKeyFile(p) {
  if (!p) return '';
  try { return fs.readFileSync(p, 'utf8').trim(); } catch (e) { return ''; }
}
function normPem(k) {
  if (!k) return '';
  k = String(k).trim();
  if (k.includes('-----BEGIN')) return k; // 已是 PEM
  const head = k.includes('PRIVATE') ? 'PRIVATE KEY' : 'PUBLIC KEY';
  return `-----BEGIN ${head}-----\n` + k.replace(/\s+/g, '').match(/.{1,64}/g).join('\n') + `\n-----END ${head}-----\n`;
}

/* ----------------------------- 订单存储 ----------------------------- */
let orders = {};
try { orders = JSON.parse(fs.readFileSync(ORDER_FILE, 'utf8')); } catch (e) { orders = {}; }
let saveTimer = null;
function saveOrders() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(ORDER_FILE, JSON.stringify(orders, null, 2)); } catch (e) {} }, 200);
}
function genOrderId() {
  const d = new Date(), p = n => (n < 10 ? '0' : '') + n;
  return 'YL' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) +
    String(Math.floor(Math.random() * 900000) + 100000);
}

/* ----------------------------- HTTP 工具 ----------------------------- */
function request(method, urlStr, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = { method, hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers: Object.assign({}, headers) };
    const req = https.request(opts, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, text });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
function jsonReq(method, urlStr, obj, headers) {
  const body = obj ? JSON.stringify(obj) : '';
  return request(method, urlStr, { body, headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, headers) });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ============================ 微信支付 v3 ============================ */
function wxNonce() { return crypto.randomBytes(16).toString('hex'); }
function wxSign(message) {
  return crypto.createSign('RSA-SHA256').update(Buffer.from(message, 'utf8')).sign(normPem(WX.privateKey), 'base64');
}
function wxAuthHeader(method, urlPath, bodyStr) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = wxNonce();
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${bodyStr || ''}\n`;
  const signature = wxSign(message);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${WX.mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial="${WX.serial}",signature="${signature}"`;
}
async function wxApi(method, apiPath, obj) {
  const bodyStr = obj ? JSON.stringify(obj) : '';
  const res = await jsonReq(method, 'https://api.mch.weixin.qq.com' + apiPath, bodyStr, {
    Authorization: wxAuthHeader(method, apiPath, bodyStr),
    Accept: 'application/json'
  });
  let data = {};
  try { data = res.text ? JSON.parse(res.text) : {}; } catch (e) {}
  if (res.status < 200 || res.status >= 300) {
    const err = new Error('微信支付下单失败 ' + res.status + ' ' + res.text);
    err.wx = data; throw err;
  }
  return data;
}
/* 微信支付平台证书缓存（用于回调验签） */
let wxCerts = {}; // serial -> pem
async function wxLoadCerts(force) {
  if (!force && Object.keys(wxCerts).length) return wxCerts;
  const data = await wxApi('GET', '/v3/certificates', null);
  (data.data || []).forEach(c => {
    const plain = wxAesGcmDecrypt(c.encrypt_certificate);
    wxCerts[c.serial_no] = plain;
  });
  return wxCerts;
}
function wxAesGcmDecrypt(enc) {
  const key = Buffer.from(WX.apiv3Key, 'utf8');
  const ciphertext = Buffer.from(enc.ciphertext, 'base64');
  const authTag = ciphertext.slice(ciphertext.length - 16);
  const data = ciphertext.slice(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(enc.nonce, 'utf8'));
  decipher.setAuthTag(authTag);
  if (enc.associated_data) decipher.setAAD(Buffer.from(enc.associated_data, 'utf8'));
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
async function wxCreateOrder({ amount, item, scene, openid, clientIp, cost = 0 }) {
  const outTradeNo = genOrderId();
  const base = {
    appid: WX.appid, mchid: WX.mchid, description: item.slice(0, 100),
    out_trade_no: outTradeNo,
    notify_url: PUBLIC_BASE + '/api/pay/notify/wechat',
    amount: { total: Math.round(amount * 100), currency: 'CNY' }
  };
  let resp = {}, apiPath = '';
  if (scene === 'native') {
    apiPath = '/v3/pay/transactions/native';
    resp = await wxApi('POST', apiPath, base);
  } else if (scene === 'h5') {
    apiPath = '/v3/pay/transactions/h5';
    resp = await wxApi('POST', apiPath, Object.assign(base, {
      scene_info: { payer_client_ip: clientIp, h5_info: { type: 'Wap' } }
    }));
  } else if (scene === 'jsapi' || scene === 'mp') {
    apiPath = '/v3/pay/transactions/jsapi';
    resp = await wxApi('POST', apiPath, Object.assign(base, { payer: { openid } }));
    // 组装小程序/公众号内唤起支付所需参数（再次用商户私钥签名）
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = wxNonce();
    const pkg = 'prepay_id=' + resp.prepay_id;
    const paySign = wxSign(`${WX.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`);
    resp = {
      jsapi: { appId: WX.appid, timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign }
    };
  } else throw new Error('未知微信支付场景: ' + scene);
  orders[outTradeNo] = { orderId: outTradeNo, channel: 'wechat', amount, item, scene, cost: Number(cost) || 0, status: 'created', ts: Date.now() };
  saveOrders();
  return { orderId: outTradeNo, scene, codeUrl: resp.code_url || '', h5Url: resp.h5_url || '', jsapi: resp.jsapi || null };
}
async function wxQuery(orderId) {
  const apiPath = '/v3/pay/transactions/out-trade-no/' + encodeURIComponent(orderId) + '?mchid=' + encodeURIComponent(WX.mchid);
  const data = await wxApi('GET', apiPath, null);
  return data.trade_state === 'SUCCESS';
}

/* ---- JSAPI 网页授权（公众号 H5 内拿 openid） ---- */
const wxOpenidTokens = new Map(); // token -> openid，10 分钟有效

/* ---- 微信小程序登录：wx.login 的 code 换 openid（支付必需） ---- */
async function wxMpCode2Session(code) {
  const res = await request('GET', 'https://api.weixin.qq.com/sns/jscode2session?appid=' +
    encodeURIComponent(WX.appid) + '&secret=' + encodeURIComponent(WX.appSecret) +
    '&js_code=' + encodeURIComponent(code) + '&grant_type=authorization_code');
  const data = JSON.parse(res.text);
  if (!data.openid) throw new Error('小程序登录失败: ' + res.text);
  return { openid: data.openid, sessionKey: data.session_key || '' };
}
function issueOpenidToken(openid) {
  const token = crypto.randomBytes(16).toString('hex');
  wxOpenidTokens.set(token, openid);
  setTimeout(() => wxOpenidTokens.delete(token), 30 * 60 * 1000);
  return token;
}
function wxOauthRedirect(redirectUri) {
  const state = crypto.randomBytes(8).toString('hex');
  const u = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + encodeURIComponent(WX.appid) +
    '&redirect_uri=' + encodeURIComponent(PUBLIC_BASE + '/api/wx/cb?redirect=' + encodeURIComponent(redirectUri)) +
    '&response_type=code&scope=snsapi_base&state=' + state + '#wechat_redirect';
  return u;
}
async function wxCode2Openid(code) {
  const res = await request('GET', 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' +
    encodeURIComponent(WX.appid) + '&secret=' + encodeURIComponent(WX.appSecret) +
    '&code=' + encodeURIComponent(code) + '&grant_type=authorization_code');
  const data = JSON.parse(res.text);
  if (!data.openid) throw new Error('网页授权失败: ' + res.text);
  return data.openid;
}

/* ============================== 支付宝 ============================== */
function aliRawParams(obj) {
  return Object.keys(obj).filter(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
    .sort().map(k => k + '=' + obj[k]).join('&');
}
function aliSign(params) {
  const signStr = aliRawParams(params);
  return crypto.createSign('RSA-SHA256').update(signStr, 'utf8').sign(normPem(ALI.privateKey), 'base64');
}
function aliSignedParams(bizMethod, bizContent, extra) {
  const params = Object.assign({
    app_id: ALI.appid,
    method: bizMethod,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAliTime(new Date()),
    version: '1.0',
    biz_content: JSON.stringify(bizContent)
  }, extra || {});
  params.sign = aliSign(params);
  return params;
}
function formatAliTime(d) {
  const p = n => (n < 10 ? '0' : '') + n;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function aliToQuery(params) {
  return Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
}
async function aliCreateOrder({ amount, item }) {
  const orderId = genOrderId();
  const params = aliSignedParams('alipay.trade.wap.pay', {
    out_trade_no: orderId,
    total_amount: amount.toFixed(2),
    subject: item,
    product_code: 'QUICK_WAP_WAY'
  }, {
    return_url: PUBLIC_BASE + '/api/pay/return/alipay?orderId=' + orderId,
    notify_url: PUBLIC_BASE + '/api/pay/notify/alipay'
  });
  orders[orderId] = { orderId, channel: 'alipay', amount, item, scene: 'wap', status: 'created', ts: Date.now() };
  saveOrders();
  return { orderId, channel: 'alipay', payUrl: ALI.gateway + '?' + aliToQuery(params) };
}
function aliVerifyNotify(form) {
  const sign = form.sign || '';
  const params = Object.assign({}, form);
  delete params.sign; delete params.sign_type;
  const signStr = aliRawParams(params);
  return crypto.createVerify('RSA-SHA256').update(signStr, 'utf8').verify(normPem(ALI.publicKey), Buffer.from(sign, 'base64'));
}
async function aliQuery(orderId) {
  const params = aliSignedParams('alipay.trade.query', { out_trade_no: orderId });
  const res = await request('GET', ALI.gateway + '?' + aliToQuery(params));
  const data = JSON.parse(res.text.replace(/^[^(]*\(|\)[^)]*$/g, ''));
  const r = data.alipay_trade_query_response || {};
  return r.trade_status === 'TRADE_SUCCESS' || r.trade_status === 'TRADE_FINISHED';
}

/* ============================ 配置自检 ============================ */
function missingWx(scene) {
  const need = [];
  ['appid', 'mchid', 'serial', 'privateKey', 'apiv3Key'].forEach(k => { if (!WX[k]) need.push('WX_' + k.toUpperCase()); });
  if ((scene === 'jsapi' || scene === 'mp') && !WX.appSecret) need.push('WX_APPSECRET');
  if (!PUBLIC_BASE) need.push('PUBLIC_BASE');
  return need;
}
function missingAli() {
  const need = [];
  ['appid', 'privateKey', 'publicKey'].forEach(k => { if (!ALI[k]) need.push('ALI_' + k.toUpperCase()); });
  if (!PUBLIC_BASE) need.push('PUBLIC_BASE');
  return need;
}

/* ============================== HTTP 服务 ============================== */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

  try {
    /* 健康检查 / 配置就绪情况（不泄露密钥） */
    if (p === '/health') {
      return send(200, {
        ok: true,
        wechat: { configured: !missingWx('native').length, jsapi: !missingWx('jsapi').length },
        alipay: { configured: !missingAli().length, sandbox: ALI.sandbox },
        publicBase: PUBLIC_BASE || null
      });
    }

    /* 统一下单 */
    if (p === '/api/pay/create' && req.method === 'POST') {
      const body = await readBody(req);
      const inp = JSON.parse(body || '{}');
      const amount = Math.round(Number(inp.amount) * 100) / 100;
      if (!(amount > 0)) return send(400, { error: '金额不合法' });
      const item = String(inp.item || 'AI现调茶饮').slice(0, 60);
      const method = inp.method === 'alipay' ? 'alipay' : 'wechat';
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

      if (method === 'alipay') {
        const need = missingAli();
        if (need.length) return send(503, { error: '支付宝未配置', need });
        const r = await aliCreateOrder({ amount, item });
        return send(200, { orderId: r.orderId, method: 'alipay', redirect: r.payUrl });
      }
      const scene = ['native', 'h5', 'jsapi', 'mp'].includes(inp.scene) ? inp.scene : 'native';
      const need = missingWx(scene === 'mp' ? 'mp' : scene);
      if (need.length) return send(503, { error: '微信支付未配置', need, scene });
      let openid = '';
      if (scene === 'mp' || scene === 'jsapi') {
        openid = wxOpenidTokens.get(String(inp.openidToken || '')) || '';
        if (!openid) return send(401, { error: '缺少 openid，小程序请先调 /api/wx/mp-login', login: '/api/wx/mp-login' });
      }
      const r = await wxCreateOrder({ amount, item, scene, openid, clientIp, cost: inp.cost || 0 });
      return send(200, {
        orderId: r.orderId, method: 'wechat', scene: r.scene,
        redirect: r.h5Url || '', codeUrl: r.codeUrl || '', jsapi: r.jsapi
      });
    }

    /* 商家账本：拉取本店已到账流水（需 OWNER_KEY）。这才是「同步」该走的官方途径。 */
    if (p === '/api/owner/orders' && req.method === 'GET') {
      if (!OWNER_KEY) return send(503, { error: '后端未设置 OWNER_KEY' });
      if (u.searchParams.get('key') !== OWNER_KEY) return send(401, { error: '商家口令不正确' });
      const since = Number(u.searchParams.get('since') || 0);
      const list = Object.values(orders)
        .filter(o => o.status === 'paid' && (o.paidAt || 0) >= since)
        .map(o => ({ orderId: o.orderId, amount: o.amount, cost: o.cost || 0, item: o.item, method: '微信支付', from: o.payer ? ('微信顾客·' + String(o.payer).slice(0, 6)) : '微信顾客', txn: o.wxTxnId || o.orderId, ts: o.paidAt }));
      return send(200, { orders: list });
    }

    /* 订单状态查询（前端轮询） */
    if (p === '/api/pay/status') {
      const orderId = u.searchParams.get('orderId');
      const o = orders[orderId];
      if (!o) return send(404, { error: '订单不存在' });
      if (o.status !== 'paid') {
        try {
          const paid = o.channel === 'alipay' ? await aliQuery(orderId) : await wxQuery(orderId);
          if (paid) { o.status = 'paid'; o.paidAt = Date.now(); saveOrders(); }
        } catch (e) { /* 平台查询失败时以异步通知为准 */ }
      }
      return send(200, { orderId, status: o.status, paid: o.status === 'paid', amount: o.amount, item: o.item, channel: o.channel });
    }

    /* 微信支付结果通知（v3，需验签 + 解密） */
    if (p === '/api/pay/notify/wechat' && req.method === 'POST') {
      const raw = await readBody(req);
      const certs = await wxLoadCerts(false).catch(() => wxLoadCerts(true));
      const serial = req.headers['wechatpay-serial'];
      const msg = `${req.headers['wechatpay-timestamp']}\n${req.headers['wechatpay-nonce']}\n${raw}\n`;
      const okVerify = crypto.createVerify('RSA-SHA256').update(msg).verify(normPem(certs[serial] || ''),
        Buffer.from(String(req.headers['wechatpay-signature']), 'base64'));
      if (!okVerify) { res.writeHead(401); return res.end('{"code":"FAIL","message":"verify fail"}'); }
      const data = JSON.parse(raw);
      const plain = JSON.parse(wxAesGcmDecrypt(data.resource));
      if (plain.trade_state === 'SUCCESS' || plain.event_type === 'TRANSACTION.SUCCESS') {
        const o = orders[plain.out_trade_no];
        if (o) { o.status = 'paid'; o.paidAt = Date.now(); o.wxTxnId = plain.transaction_id || ''; o.payer = (plain.payer && plain.payer.openid) || ''; saveOrders(); }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{"code":"SUCCESS","message":"成功"}');
    }

    /* 支付宝同步返回（跳回前端，最终以异步通知/查询为准） */
    if (p === '/api/pay/return/alipay') {
      const orderId = u.searchParams.get('orderId') || '';
      res.writeHead(302, { Location: '/' + FRONTEND_PAGE + '?orderId=' + encodeURIComponent(orderId) + '&paid=1' });
      return res.end();
    }
    /* 支付宝异步通知 */
    if (p === '/api/pay/notify/alipay' && req.method === 'POST') {
      const form = await readForm(req);
      if (aliVerifyNotify(form) && form.trade_status === 'TRADE_SUCCESS') {
        const o = orders[form.out_trade_no];
        if (o) { o.status = 'paid'; o.paidAt = Date.now(); o.txId = form.trade_no || ''; saveOrders(); }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('success');
      }
      res.writeHead(400); return res.end('fail');
    }

    /* 微信小程序登录：wx.login code → openidToken（下单时带上即可唤起支付） */
    if (p === '/api/wx/mp-login' && req.method === 'POST') {
      if (!WX.appid || !WX.appSecret) return send(503, { error: '未配置 WX_APPID / WX_APPSECRET' });
      const body = await readBody(req);
      const inp = JSON.parse(body || '{}');
      if (!inp.code) return send(400, { error: '缺少 code（小程序 wx.login 返回）' });
      const s = await wxMpCode2Session(String(inp.code));
      return send(200, { openidToken: issueOpenidToken(s.openid), ok: true });
    }

    /* 微信 JSAPI 网页授权入口与回调（公众号 H5 场景） */
    if (p === '/api/wx/oauth') {
      if (!WX.appid || !WX.appSecret || !PUBLIC_BASE) return send(503, { error: 'JSAPI 未配置 WX_APPID/WX_APPSECRET/PUBLIC_BASE' });
      const redirect = u.searchParams.get('redirect') || ('/' + FRONTEND_PAGE);
      res.writeHead(302, { Location: wxOauthRedirect(redirect) }); return res.end();
    }
    if (p === '/api/wx/cb') {
      const code = u.searchParams.get('code');
      const redirect = u.searchParams.get('redirect') || ('/' + FRONTEND_PAGE);
      const openid = await wxCode2Openid(code);
      const token = crypto.randomBytes(16).toString('hex');
      wxOpenidTokens.set(token, openid);
      setTimeout(() => wxOpenidTokens.delete(token), 10 * 60 * 1000);
      const sep = redirect.includes('?') ? '&' : '?';
      res.writeHead(302, { Location: redirect + sep + 'wxtoken=' + token }); return res.end();
    }

    /* 静态托管前端（同源部署，路径穿越防护） */
    if (p === '/' ) return serveFile(path.join(__dirname, FRONTEND_PAGE), res);
    const staticPath = path.normalize(decodeURIComponent(p)).replace(/^(\.\.[/\\])+/, '');
    const fp = path.join(__dirname, staticPath);
    if (fp.startsWith(__dirname) && fs.existsSync(fp) && fs.statSync(fp).isFile()) return serveFile(fp, res);

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (e) {
    console.error('[pay-server error]', e);
    send(500, { error: String(e.message || e), detail: e.wx || undefined });
  }
});

function serveFile(fp, res) {
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 2 * 1024 * 1024) req.destroy(); });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}
async function readForm(req) {
  const raw = await readBody(req);
  const out = {};
  new URLSearchParams(raw).forEach((v, k) => { out[k] = v; });
  return out;
}

server.listen(PORT, () => {
  console.log('==========================================================');
  console.log(' 饮料机真实支付后端已启动:  http://localhost:' + PORT);
  console.log(' 健康检查:                  http://localhost:' + PORT + '/health');
  console.log(' 微信支付配置:', missingWx('native').length ? '未就绪 → ' + missingWx('native').join(',') : '就绪');
  console.log(' 微信JSAPI :', missingWx('jsapi').length ? '未就绪 → ' + missingWx('jsapi').join(',') : '就绪');
  console.log(' 支付宝    :', missingAli().length ? '未配置(默认沙箱) → ' + missingAli().join(',') : (ALI.sandbox ? '沙箱就绪' : '正式环境就绪'));
  console.log(' 对外域名  :', PUBLIC_BASE || '未设置（本机联调可只测 /health 与下单签名，真实跳转需 https 域名）');
  console.log('==========================================================');
});
