/**
 * AI 饮品出图后端（零依赖 Node.js）
 * ------------------------------------------------------------------
 * 与「文本 AI」同步：接收文本 AI / 用户对这杯饮品的描述 + 机器里仅有的 4 种原料
 * （东方树叶茶、水溶C、橙汁、纯牛奶 + 冰），翻译成"只画这杯饮料"的提示词，
 * 调火山方舟「豆包·Seedream」出图（国内出图最强之一，图走火山 TOS，国内/微信直接开），
 * 返回真实图片 URL。
 *
 * 启动：
 *   ARK_API_KEY=你的方舟Key node 图片生成后端_server.js
 *   可选 PORT=8788  ARK_IMAGE_MODEL=doubao-seedream-4-0-250828  ALLOW_ORIGIN=*
 *
 * 三条硬约束（服务端强制，不靠模型自觉）：
 *   1) 画面里永远只有这一杯饮料，不出现任何人、手、脸、身体；
 *   2) 只能用 4 种原料：茶汤 / 牛奶 / 水溶C / 橙汁 + 冰；不允许青柠、薄荷、香草、花朵、
 *      珍珠椰果等；唯一允许的装饰是一条橙皮卷（橙子是真实原料）。
 *   3) 机器没有气泡技术：绝不画气泡/苏打水；顾客说"气泡"也转成"清透冰凉的冰饮"。
 *
 * 没配 Key 时不崩：/api/image/generate 返回免密钥 pollinations 公网图地址兜底（仅联调，
 * 国内可能不稳）；配了方舟 Key 才是 Seedream 高清图。
 */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cfg = (k, d) => process.env[k] != null && process.env[k] !== '' ? process.env[k] : d;
const PORT = Number(cfg('PORT', '8788'));
const ARK_BASE = cfg('ARK_BASE', 'https://ark.cn-beijing.volces.com/api/v3');
const ARK_IMAGE_MODEL = cfg('ARK_IMAGE_MODEL', 'doubao-seedream-4-0-250828'); // 豆包·Seedream 4.0
const ALLOW_ORIGIN = cfg('ALLOW_ORIGIN', '*');

(function loadConfigFile() {
  try {
    const cf = path.join(__dirname, '图片配置.json');
    if (fs.existsSync(cf)) {
      const j = JSON.parse(fs.readFileSync(cf, 'utf8'));
      if (!process.env.ARK_API_KEY && j.ARK_API_KEY) process.env.ARK_API_KEY = j.ARK_API_KEY;
      if (j.ARK_IMAGE_MODEL && !process.env.ARK_IMAGE_MODEL) process.env.ARK_IMAGE_MODEL = j.ARK_IMAGE_MODEL;
      if (j.ARK_BASE && !process.env.ARK_BASE) process.env.ARK_BASE = j.ARK_BASE;
    }
  } catch (e) { console.error('[config]', e.message); }
})();
const ARK_API_KEY = cfg('ARK_API_KEY', '');

/* 机器里仅有的 4 种原料（+冰）——画面只允许出现这些 */
const INGREDIENT_VISUAL = {
  tea:    'Chinese bottled tea (Oriental Leaves / 东方树叶), clear amber tea',
  milk:   'fresh whole milk, silky creamy white',
  c:      'water-soluble vitamin C citrus drink (水溶C), pale yellow',
  orange: 'fresh 100% orange juice, bright orange',
  ice:    'clear ice cubes'
};

/* 统一商业饮品风格：对齐"橙茶分层 + 橙皮卷"例图；明确无人、无花、无香草、无青柠薄荷、无气泡 */
const STYLE_SUFFIX =
  'a premium custom freshly-made drink in a tall clear plastic takeaway cup, centered, ' +
  'layered gradient liquid inside the cup, clear ice cubes, a single curled orange peel twist on the rim as the ONLY garnish, ' +
  'soft diffused studio light, airy misty warm-beige to soft-peach gradient seamless background, subtle blurred green leaves far behind, ' +
  'fine condensation droplets on the cup, high-end commercial beverage photography, photorealistic, appetizing, delicate, clean, ' +
  'minimal, elegant, sharp focus. ' +
  'STRICTLY: drink only, no people, no face, no hands, no body, no woman, no girl, no character, ' +
  'no lime, no lemon slice, no mint, no herb sprig, no rosemary, no thyme, no flower, no blossom, no petals, ' +
  'no tapioca pearls, no coconut jelly, no sugar cane, no coffee, no straw prop clutter, ' +
  'no bubbles, no sparkling water, no soda fizz, still flat beverage, no text, no logo, no watermark';

/* 描述里这些词要么会诱导"画人/画违规装饰/画气泡"，统一净化：
   - 人物词：转成"气质色调"，并从中文描述里删掉，避免模型照着画人；
   - 违规原料/装饰/气泡：直接剔除；
   - 只保留对【风味、颜色、温度、质感】有用的信息。 */
const STRIP_WORDS = [
  '青柠', '柠檬片', '柠檬', '薄荷', '香草', '迷迭香', '百里香', '罗勒',
  '气泡', '苏打', '汽水', '雪碧', '可乐', '气泡水', '带气', '加气', '充气',
  '珍珠', '椰果', '燕麦', '椰奶', '蜂蜜', '奶油', '奶盖', '咖啡', '美式', '拿铁',
  '玫瑰', '樱花', '花朵', '花瓣', '鲜花', '小花', '花',
  '女生', '女孩', '少女', '女人', '美女', '女神', '男生', '男孩', '男人', '帅哥', '人物', '人像', '一个人', '一位', '模特'
];
/* 把"适合女生/治愈/温柔/精致"这类对【人或情绪】的形容，转成对【饮料气质】的英文视觉词 */
const MOOD_HINTS = [
  { re: /女生|女孩|少女|温柔|治愈|精致|优雅|女神/, en: 'soft elegant feminine color tone, gentle warm pastel palette' },
  { re: /高级|豪华|顶级|贵|奢华|premium|luxury/i, en: 'luxurious premium presentation, refined golden accents' },
  { re: /清爽|清新|解腻|夏天|凉快|bright|fresh/i, en: 'bright clean refreshing look, crisp clarity' },
  { re: /浓郁|丝滑|醇厚|奶香|creamy|rich/i, en: 'creamy layered swirl, soft white and caramel tones' },
  { re: /橙|橘|桔|orange/i, en: 'vibrant orange hue' },
  { re: /热|烫|暖|hot|warm/i, en: 'warm steam rising, cozy' }
];

function sanitizeText(s) {
  let t = String(s || '');
  STRIP_WORDS.forEach(w => { t = t.split(w).join(''); });
  return t.replace(/[，。、,.]{2,}/g, '，').replace(/\s+/g, ' ').trim();
}

/* 只从原始描述里【抽取合法信号】，重新组一句干净的中文风味说明，
   绝不把剔除违禁词后的残句喂给模型（避免"会爱的水、加和一朵"这种碎片）。 */
const CN_SIGNALS = [
  { re: /清爽|清新|清冽|解腻|通透|解渴|清凉|凉/, zh: '清爽通透' },
  { re: /浓郁|醇厚|丝滑|绵密|奶香|厚乳|顺滑/, zh: '奶香浓郁、口感丝滑' },
  { re: /橙|橘|桔|鲜橙|香橙/, zh: '橙香明亮' },
  { re: /茶|乌龙|茉莉|红(?:茶)?|绿(?:茶)?|东方树叶|回甘|茶香/, zh: '茶香清冽回甘' },
  { re: /酸|酸甜|维C|维c|c100|C100|水溶|柠檬味/, zh: '果酸清新' },
  { re: /甜|甘|蜜|微甜/, zh: '清甜不腻' },
  { re: /温柔|治愈|暖|安慰|放松|舒缓/, zh: '温润治愈' },
  { re: /高级|豪华|顶级|精致|优雅|贵|奢|品质/, zh: '高级精致' },
  { re: /元气|开心|活力|醒神|提神|醒/, zh: '明亮提神' },
  { re: /热|烫|温/, zh: '温热' },
  { re: /冰|冷|凉|冰镇/, zh: '冰爽' }
];
function buildCNNote(input, ing) {
  const raw = [input.name, input.desc, input.mood || input.keywords].filter(Boolean).join('，');
  const sig = [];
  CN_SIGNALS.forEach(x => { if (x.re.test(raw) && sig.indexOf(x.zh) < 0) sig.push(x.zh); });
  const ingNames = [];
  if (ing.tea !== false) ingNames.push('清茶');
  if (ing.milk) ingNames.push('牛奶');
  if (ing.c) ingNames.push('水溶C');
  if (ing.orange !== false) ingNames.push('橙汁');
  let note = '一杯以' + ingNames.slice(0, -1).join('、') + (ingNames.length > 1 ? '与' : '') +
    ingNames.slice(-1) + '现调的饮品';
  if (sig.length) note += '，' + sig.slice(0, 4).join('、');
  note += (input.temp === 'hot') ? '，温热饮用。' : '，冰凉分层、清透好看。';
  return note;
}

/**
 * 输入 { name, desc, mood/keywords, ingredients:{tea,milk,c,orange,ice}, temp }
 * 输出强约束英文提示词（前置一句中文风味说明，明确"只用于理解风味、画面不要文字、不要人"）。
 */
function buildPrompt(input) {
  input = input || {};
  const ing = input.ingredients || {};
  const parts = [];
  if (ing.tea !== false) parts.push(INGREDIENT_VISUAL.tea);
  if (ing.milk) parts.push(INGREDIENT_VISUAL.milk);
  if (ing.c) parts.push(INGREDIENT_VISUAL.c);
  if (ing.orange !== false) parts.push(INGREDIENT_VISUAL.orange);
  if (ing.ice !== false && (!input.temp || input.temp !== 'hot')) parts.push(INGREDIENT_VISUAL.ice);
  const base = parts.join(', ');

  /* 干净的中文风味说明（只含合法信号，绝不喂剔除后的残句） */
  const rawCN = [input.name, input.desc, input.mood || input.keywords].filter(Boolean).join('，');
  const descCN = buildCNNote(input, ing);

  /* 情绪/风格 → 饮料视觉气质；热饮给蒸汽，其余一律清透冰凉、但绝无气泡 */
  const probe = rawCN + ' ' + (input.temp || '');
  const look = [];
  MOOD_HINTS.forEach(h => { if (h.re.test(probe) && look.indexOf(h.en) < 0) look.push(h.en); });
  if (/热|烫|暖|hot|warm/i.test(probe)) look.push('hot drink, gentle steam');
  else look.push('iced refreshing still drink, crystal clear');

  const zhLine = '这杯饮品的中文风味描述（仅用于理解味道与颜色，画面里不要出现任何文字，也不要出现人）：' + descCN + ' ';
  return zhLine +
    'Show ONLY the beverage itself. Ingredients shown: ' + base + '. Visual mood: ' + look.join(', ') + '. ' +
    STYLE_SUFFIX;
}

function pollinationsURL(prompt, seed, size) {
  const wh = size === '1024x1024' ? [768, 768] : [576, 768];
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
    '?width=' + wh[0] + '&height=' + wh[1] + '&seed=' + (seed != null ? seed : Math.floor(Math.random() * 1e6)) +
    '&nologo=true&model=turbo&enhance=true';
}

function httpsJson(url, options, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = payload ? Buffer.from(JSON.stringify(payload)) : null;
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: options.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, data ? { 'Content-Length': data.length } : {}, options.headers || {})
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(buf), raw: buf }); }
        catch (e) { resolve({ status: res.statusCode, json: null, raw: buf }); }
      });
    });
    req.on('error', reject);
    if (req.setTimeout) req.setTimeout(60000, () => req.destroy(new Error('ark timeout')));
    if (data) req.write(data);
    req.end();
  });
}

/* 调火山方舟 Seedream，返回 {url, model} */
async function callSeedream(prompt, size, seed) {
  const isV4 = /seedream-4/.test(ARK_IMAGE_MODEL);
  const body = { model: ARK_IMAGE_MODEL, prompt, response_format: 'url', watermark: false };
  if (isV4) body.size = '2K';
  else { body.size = size === '1024x1024' ? '1024x1024' : (size || '768x1024'); }
  if (seed != null) body.seed = seed;
  const r = await httpsJson(ARK_BASE + '/images/generations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + ARK_API_KEY }
  }, body);
  if (r.status !== 200 || !r.json || !r.json.data || !r.json.data[0] || !r.json.data[0].url) {
    const msg = r.json && r.json.error ? r.json.error.message : ('HTTP ' + r.status);
    throw new Error('Seedream 出图失败：' + msg);
  }
  return { url: r.json.data[0].url, model: ARK_IMAGE_MODEL, raw: r.json };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8' };
function serveStatic(req, res, urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/+/, ''));
  const fp = path.join(__dirname, rel);
  if (!fp.startsWith(__dirname)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}
function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = ''; req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => resolve(b));
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': ALLOW_ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }); return res.end(); }
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;

  if (p === '/health') {
    return send(res, 200, { ok: true, seedream: !!ARK_API_KEY, model: ARK_IMAGE_MODEL, fallback: 'pollinations' });
  }

  /* POST /api/image/generate {name,desc,mood,ingredients,temp,size,seed} */
  if (p === '/api/image/generate' && req.method === 'POST') {
    let inp = {};
    try { inp = JSON.parse((await readBody(req)) || '{}'); } catch (e) { return send(res, 400, { error: '请求体不是合法 JSON' }); }
    const seed = inp.seed != null ? Number(inp.seed) : crypto.randomInt(1, 1e9);
    const size = inp.size || '768x1024';
    const prompt = buildPrompt(inp);
    if (ARK_API_KEY) {
      try {
        const r = await callSeedream(prompt, size, seed);
        return send(res, 200, { ok: true, provider: 'seedream', model: r.model, url: r.url, prompt, seed });
      } catch (e) {
        return send(res, 200, { ok: true, provider: 'pollinations', degraded: true, error: String(e.message || e), url: pollinationsURL(prompt, seed, size), prompt, seed });
      }
    }
    return send(res, 200, { ok: true, provider: 'pollinations', degraded: true, need: ['ARK_API_KEY'], url: pollinationsURL(prompt, seed, size), prompt, seed });
  }

  if (p === '/api/image/prompt' && req.method === 'POST') {
    let inp = {};
    try { inp = JSON.parse((await readBody(req)) || '{}'); } catch (e) {}
    return send(res, 200, { prompt: buildPrompt(inp) });
  }

  if (p === '/' || p === '/app') return serveStatic(req, res, 'AI饮品出图应用.html');
  return serveStatic(req, res, p);
});

server.listen(PORT, () => {
  console.log('AI 饮品出图后端已启动: http://localhost:' + PORT);
  console.log('  出图应用:    http://localhost:' + PORT + '/AI饮品出图应用.html');
  console.log('  Seedream:   ' + (ARK_API_KEY ? '已配置 (' + ARK_IMAGE_MODEL + ')' : '未配置 ARK_API_KEY，先用 pollinations 兜底'));
  console.log('  画面约束:    只有这杯饮料 / 4种原料 / 无人无花无青柠薄荷 / 无气泡');
});
