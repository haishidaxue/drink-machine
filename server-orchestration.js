/* ============================================================
 * 饮料机 · AI 特调编排服务（一个后台程序，一条龙：理解 → 文案/配方 → 出图）
 * ------------------------------------------------------------
 * 这是"专门给这台饮料机小程序服务的后台"。小程序只跟它说一句话：
 *
 *   POST /api/drink   { "text": "来一杯适合女生、清爽点的" }
 *
 * 服务内部自动完成：
 *   1) 调【文本大脑】(默认 Kimi K3，也可配豆包/DeepSeek) 想名字、高级文案、配方、价格；
 *      没配 Key 时用服务内置合规规则兜底（机器不停）。
 *   2) 根据配方 + 顾客原话，组装"只画这一杯、只有4种原料"的强约束英文提示词；
 *   3) 调【豆包 Seedream】(火山方舟) 出高清图，返回国内可直接打开的图片 URL。
 *   一次返回：{ order, lead,name,meaning,why,layers,benefit,desc,apology,
 *               price,temp,ice,recipe,cost, image:{provider,url,prompt,seed} }
 *
 * 出图/文本都可独立只取：
 *   POST /api/text            只出文案/配方（旧前端兼容）
 *   POST /api/image/generate  只出图（独立出图应用兼容）
 *   POST /api/image/prompt    只看组装好的提示词
 *
 * ---- Key（只放服务端，绝不进小程序前端）----
 *   豆包出图  ：ARK_API_KEY  火山方舟 API Key（注册即送免费额度；Seedream 4.0 首张免费、之后约0.2元/张）
 *              申请：https://ark.volcengine.com/region:cn-beijing/apikey
 *   文本大脑  ：LLM_API_KEY  默认 Kimi K3（https://platform.moonshot.cn）；
 *              若把 PROVIDER 设成 doubao 且文本也走方舟，则直接复用 ARK_API_KEY。
 *   可用环境变量，也可把 *.example.json 复制成 饮料机AI配置.json 填好。
 *
 * 零第三方依赖，Node 18+ 直接运行：
 *   ARK_API_KEY=xxx  LLM_API_KEY=xxx  PORT=8790 node 饮料机AI编排服务_server.js
 * ============================================================ */
'use strict';
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* ---------------- 配置 ---------------- */
(function loadConfigFile() {
  try {
    const cf = path.join(__dirname, '饮料机AI配置.json');
    if (fs.existsSync(cf)) {
      const j = JSON.parse(fs.readFileSync(cf, 'utf8'));
      for (const k of ['PORT', 'ALLOW_ORIGIN',
        'ARK_API_KEY', 'ARK_BASE', 'ARK_IMAGE_MODEL',
        'LLM_PROVIDER', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_BASE_URL']) {
        if (j[k] != null && j[k] !== '' && process.env[k] == null) process.env[k] = String(j[k]);
      }
    }
  } catch (e) { console.error('[config]', e.message); }
})();
const envOr = (k, d) => (process.env[k] != null && process.env[k] !== '' ? process.env[k] : d);

const PORT = Number(envOr('PORT', '8790'));
const ALLOW_ORIGIN = envOr('ALLOW_ORIGIN', '*');

/* 出图：火山方舟 豆包 Seedream */
const ARK_BASE = envOr('ARK_BASE', 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '');
const ARK_IMAGE_MODEL = envOr('ARK_IMAGE_MODEL', 'doubao-seedream-4-5-251128');
const ARK_API_KEY = envOr('ARK_API_KEY', '');

/* 文本大脑：默认 Kimi K3；provider=doubao 时默认复用方舟 Key */
const TEXT_PROVIDERS = {
  kimi:     { base: 'https://api.moonshot.ai/v1',                 model: 'kimi-k3' },
  doubao:   { base: 'https://ark.cn-beijing.volces.com/api/v3',  model: 'doubao-seed-1-6-250615' },
  deepseek: { base: 'https://api.deepseek.com',                  model: 'deepseek-chat' }
};
const PROVIDER = (envOr('LLM_PROVIDER', 'kimi') || 'kimi').toLowerCase();
const pv = TEXT_PROVIDERS[PROVIDER] || TEXT_PROVIDERS.kimi;
const TEXT_BASE = (process.env.LLM_BASE_URL || pv.base).replace(/\/+$/, '');
const TEXT_MODEL = process.env.LLM_MODEL || pv.model;
const TEXT_KEY = process.env.LLM_API_KEY || (PROVIDER === 'doubao' ? ARK_API_KEY : '');

/* ---------------- 业务常量：机器里真实存在的只有 4 种原料 ---------------- */
const INGREDIENTS = [
  { key: 'tea',    name: '东方树叶', kinds: ['乌龙茶', '茉莉花茶', '红茶', '绿茶'] },
  { key: 'vitC',   name: '水溶C',    kinds: ['水溶C100 柠檬味'] },
  { key: 'orange', name: '橙汁',     kinds: ['100%橙汁'] },
  { key: 'milk',   name: '牛奶',     kinds: ['纯牛奶'] }
];
const ALLOWED_NAMES = ['东方树叶', '乌龙茶', '茉莉花茶', '茉莉', '红茶', '绿茶',
  '水溶c', '水溶c100', '水溶c100柠檬味', '橙汁', '100%橙汁', '橙子汁', '牛奶', '纯牛奶',
  '冰', '冰块', '水', '矿泉水'];
const FORBIDDEN = ['青柠', '柠檬片', '薄荷', '气泡', '苏打', '汽水', '雪碧', '可乐', '珍珠', '椰果',
  '燕麦', '椰奶', '蜂蜜', '奶油', '奶盖', '咖啡', '美式', '拿铁', '仙草', '布丁', '芋圆', '果肉',
  '玫瑰', '花朵', '花瓣', '樱花', '薰衣草', '迷迭香', '香草', '百里香',
  '女生', '女孩', '少女', '女人', '美女', '男生', '男孩', '男人', '人物', '人像', '一个人', '一位'];

const COST = { tea: 1.6, vitC: 2.2, orange: 2.6, milk: 2.0, ice: 0.3 };
const CUP_OVERHEAD = 1.2;
const PRICE_FLOOR = 18, PRICE_CEIL = 24;

/* ================= 文本大脑：系统提示词（业务铁律写死，不靠模型自觉） ================= */
const SYSTEM_PROMPT =
'你是顶级东方茶饮品牌的首席文案，也是这台【现调饮料机】的后台大脑，只围绕"这一杯饮料"创作。\n\n' +
'【铁律一：只有4种原料】机器里只有：① 东方树叶（可换乌龙茶/茉莉花茶/红茶/绿茶做茶底）② 水溶C100柠檬味 ③ 100%橙汁 ④ 纯牛奶；另可加冰/水。' +
'严禁出现青柠、柠檬片、薄荷、气泡水、苏打、汽水、珍珠、椰果、燕麦奶、椰奶、糖、蜂蜜、奶油、奶盖、咖啡、花朵、香草等4种之外的一切东西，名字、文案、配方里都不能出现。\n\n' +
'【铁律二：机器没有气泡技术】顾客若想要气泡/苏打/汽水/雪碧/可乐等任何带气的饮品，你不能假装能做，也不能编造一杯带气泡的饮料。' +
'此时把 apology 写成一句诚恳简短的致歉（如"抱歉，这台机器暂时做不了带气泡的饮品"），并用4种原料里【不带气泡、同样清爽冰凉】的一杯来替代（如乌龙茶+水溶C/橙汁+冰），在 why 里说明"虽然没有气泡，但茶香+果酸一样清爽解腻"。\n\n' +
'【铁律三：所有形容词都只修饰饮料本身】像"适合女生/很高级/治愈/温柔/精致"这类词，是在形容这杯饮料的气质（色调柔和、口感轻盈、名字雅致等），' +
'绝对不是要你描写或生成任何人物。你的全部文字里不得出现女生、女孩、少女、男人、人物等任何指代人的词，画面里也只有这杯饮料。\n\n' +
'【理解用户】先把口语补全成完整句子并判断形容词归属，如"最贵的"补成"我要一杯最贵的饮料"，"适合女生的"补成"我要一杯气质柔和精致的饮料"。' +
'只要话里有任何形容/限定这杯喝的词（口味、温度、价格档位、浓度、原料偏好、心情、场景、份量、风格气质），哪怕一两个字，都算 order=true，照此生成，不反问。' +
'仅纯打招呼/纯道谢/纯辱骂且与饮料无关/明确问机器用法·故障·纯价格表，才 order=false。\n\n' +
'【配方与定价】recipe 每项 {name,ml}，不含冰合计 300~420ml，全部来自4种原料，冰单列 ice。' +
'"最贵/顶级/豪华"用饱满高成本组合、茶或奶给足，价格靠上限；"便宜/划算"用低成本清爽组合靠下限；"不要奶"绝不含牛奶；' +
'"清爽/解腻"多茶+水溶C、少奶或无奶；"浓郁/丝滑/香醇"加大牛奶；"提神/犯困/熬夜"用红茶或乌龙浓茶底；"维C/酸/橙香"用水溶C或橙汁；"热"temp=hot、热饮无冰。' +
'成本参考/杯用量：东方树叶≈1.6、水溶C≈2.2、橙汁≈2.6、牛奶≈2.0、冰0.3，杯材水电1.2；按成本+合理毛利定整数价，区间 ' + PRICE_FLOOR + '~' + PRICE_CEIL + ' 元且必须高于成本。\n\n' +
'【文字要求（高级、赏心悦目，这是要展示给顾客的真实文案）】\n' +
'- lead：一句≤15字、有诗意且每次不同的引言，自然引出"为你调这杯"。\n' +
'- name：4~6字、有出处与诗意的名字（不要"特调"二字），由画面/意象/风味构成。\n' +
'- meaning：30~55字，讲清名字的引申义与寓意，把风味化成一个意象/一句祝福。\n' +
'- why：45~70字，只讲这杯为什么合他心意、风味如何层层呼应他说的话（口感、香气、温度、心情），让顾客读到"这杯好在哪"；气泡替代场景在此致歉并说明原因与替代思路。\n' +
'- layers：恰好3句、每句≤22字，写清风味递进：第一口 / 中段 / 回甘余韵，具体可感。\n' +
'- benefit：30~50字，这杯的好处与最适合的场景/心情，体贴有分寸。\n' +
'- 全程只写这杯饮料，绝不出现人物；避免"奢华尊贵"等廉价词，文白相杂但要自然克制。\n' +
'- 【顾客视角铁律】你就是饮品本身，只讲产品的好。所有给顾客看的文案（lead/name/meaning/why/layers/benefit/desc/reply/apology）一律不得出现原料商品名与配料清单——禁止"东方树叶、水溶C、橙汁、牛奶、用…调、由…调配、现萃现调、加冰摇匀"等说法；可以写风味与感官（乌龙香、红茶醇、橙香明亮、果酸、奶香丝滑、茶汤、回甘、冰爽）。\n' +
'- 【不暴露生成过程】禁止出现"AI、模型、提示词、出图、生成、一条龙、流水线、配方、配比、节点、调用"等任何后台/生成方案字眼，也不描述你是怎么被做出来的。\n' +
'- 【短引每杯不同】即使顾客重复点同一杯，lead 和 meaning 也必须换成全新的一句，绝不与上一杯重复。\n\n' +
'只输出一个JSON对象，禁止解释、markdown、思考过程：\n' +
'点单：{"order":true,"apology":"","lead":"","name":"","meaning":"","why":"","layers":["","",""],"benefit":"","price":0,"temp":"cold|normal|hot","ice":"正常冰|少冰|去冰|热饮无冰","recipe":[{"name":"东方树叶(乌龙茶)","ml":200},{"name":"水溶C","ml":120}]}\n' +
'非点单：{"order":false,"apology":"","reply":"一句亲切高情商、不顶撞的话","lead":"","name":"","meaning":"","why":"","layers":[],"benefit":"","price":0,"recipe":[]}';

/* ================= 通用 HTTP ================= */
function httpsJson(url, options, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = payload != null ? Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)) : null;
    const headers = Object.assign({ 'Content-Type': 'application/json' },
      data ? { 'Content-Length': data.length } : {}, options.headers || {});
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: options.method || 'GET', headers
    }, res => {
      let buf = ''; res.on('data', c => (buf += c));
      res.on('end', () => {
        let json = null; try { json = JSON.parse(buf); } catch (e) {}
        resolve({ status: res.statusCode, json, raw: buf });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs || 60000, () => req.destroy(new Error('upstream timeout')));
    if (data) req.write(data);
    req.end();
  });
}
function normName(s) { return String(s || '').toLowerCase().replace(/\s+/g, '').replace(/[（）()]/g, ''); }
function isAllowed(name) {
  const n = normName(name);
  if (!n) return false;
  if (n === '冰' || n === '冰块' || n === '水' || n === '矿泉水') return true;
  if (ALLOWED_NAMES.some(a => { const aa = normName(a); return aa.length >= 2 && n.indexOf(aa) >= 0; })) return true;
  if (/^(乌龙|茉莉|红茶|绿茶)$/.test(n)) return true;
  return false;
}
function findForbidden(data) {
  const text = ['lead', 'name', 'meaning', 'why', 'benefit', 'apology', 'reply']
    .map(k => String(data[k] || '')).join(' ') + ' ' +
    (Array.isArray(data.layers) ? data.layers.join(' ') : '') + ' ' +
    (Array.isArray(data.recipe) ? data.recipe.map(r => r.name || '').join(' ') : '');
  return FORBIDDEN.filter(w => text.indexOf(w) >= 0 && !(w === '气泡' && /做不了|没有气泡|不带气泡|无气泡/.test(text)));
}
function recipeCost(recipe, iceLabel) {
  let c = CUP_OVERHEAD;
  (recipe || []).forEach(r => {
    const n = normName(r.name); const ml = Math.max(0, Number(r.ml) || 0);
    let per = 0;
    if (n.indexOf('东方树叶') >= 0 || /乌龙|茉莉|红茶|绿茶/.test(n)) per = COST.tea / 250;
    else if (n.indexOf('水溶') >= 0) per = COST.vitC / 250;
    else if (n.indexOf('橙') >= 0) per = COST.orange / 250;
    else if (n.indexOf('奶') >= 0) per = COST.milk / 250;
    c += per * ml;
  });
  if (iceLabel && iceLabel.indexOf('去冰') < 0 && iceLabel.indexOf('无冰') < 0) c += COST.ice;
  return Math.round(c * 100) / 100;
}
const wantsFizzy = t => /气泡|苏打|汽水|雪碧|可乐|带气|加气|充气|fizz|sparkling|soda/i.test(t);

/* 纯社交 / 纯故障 / 纯辱骂（且全句无任何对饮品的需求）→ 不出单。只要沾一点喝的就照做。 */
function nonOrderReply(t) {
  const q = String(t || '').trim();
  const tail = '[呀啊哦哟哇啦呢嘛吧呗~～\\s!！.。]*$';
  if (new RegExp('^(你好|您好|嗨|哈喽|hello|hi|在吗|在不在|喂)' + tail, 'i').test(q)) return '你好呀～想喝点什么？告诉我口味、心情或预算，我马上为你现调一杯。';
  if (new RegExp('^(谢谢|谢啦|感谢|多谢|thanks|thank you)' + tail, 'i').test(q)) return '不客气～想喝的时候随时叫我。';
  if (/^(哈哈+|呵呵+|233+|666+)[\s!！.。~呀啊哦]*$/.test(q)) return '嘻嘻～要不要我给你调一杯好喝的？';
  if (/坏了|故障|不能用|不出饮料|不出杯|卡住了|怎么维修/.test(q) && !/喝|奶茶|茶|奶|杯|来|要|给/.test(q)) return '抱歉给你添麻烦了，我这就通知工作人员来看看；你也可以稍等片刻再试。';
  /* 问菜单/问能力：介绍能做什么，不直接出单 */
  if (/(有什么|都有什么|有啥)(好喝)?(的)?(喝的|饮料|饮品|菜单|口味|推荐)?\s*[呀啊哦呢嘛吧?？~～]*$|^菜单|怎么点|如何点|你是谁|你(家|这)?是(什么)?(机器人|智能体|AI|人工智能|人|机器)?(吗|嘛|么)?[?？~～]*$|你会什么|你能(做|调|干)什么|介绍(一)?下(你)?(自己)?|^帮助|^help/i.test(q)
      && !/来一?(杯|个)|给我|整一|安排|想要一杯|点一杯|来杯/.test(q))
    return '我是这台饮品机的现调大脑，能按你一句话现配饮品——奶香醇厚的奶茶、鲜橙明亮的果茶、清透回甘的清茶都有，冰的热的、浓的淡的、贵的平价的都能调。直接告诉我你想喝什么口味或心情就行，比如“来杯清爽不加糖的”。';
  /* 只问价格/预算：报价不出单（带明确点单动作时仍出单，走定价逻辑） */
  if ((/多少(钱|价位|价格)|怎么卖|什么价位|\d+\s*(块|元)(钱)?(的)?(有吗|有没有|价位)?[?？~～]*$|有(十|10|15|18|20)(块|元)?(钱)?(的)?(吗|嘛|么)/.test(q))
      && !/来一?(杯|个)|给我|整一|安排|想要一杯|点一杯|来杯/.test(q))
    return '现调饮品每杯 18～24 元，按用料和做法定价；想喝好一点的可以直接说“来杯最好的”。告诉我口味，我这就给你配。';
  const insult = /傻|蠢|笨|有病|神经病|智障|白痴|垃圾|废物|滚|脑残|脑子|难喝|会不会做|会不会调|什么玩意|差评|投诉/.test(q);
  /* 抱怨/吐槽（含"难喝、会不会做"）即使带"喝/茶"字也算负面反馈，先安抚不出单；
     只有带明确点单动作或原料/口味词才照做。 */
  const orderCue = /来(一|杯|个|点)?|给我|整(一|杯|个)?|搞(一|杯|个)?|安排|推荐|想要|想点|点一杯|来杯|要不|加|不要(奶|糖|冰|橙|果汁)|多奶|少奶|去冰|加热|奶茶|牛奶|橙汁|水溶|东方树叶|气泡|清爽|浓郁|解渴|提神|口味|口感|渴了|困了|最贵|便宜/.test(q);
  if (insult && !orderCue) return '抱歉这次没合你口味，是我没调好。你直接告诉我想喝浓一点还是清爽点、要不要奶、冰的还是热的，我重新给你做一杯。';
  return null;
}
function nonOrderResult(reply) {
  return { order: false, apology: '', reply, lead: '', name: '', meaning: '', why: '', layers: [], benefit: '', desc: '',
    price: 0, temp: 'cold', ice: '', recipe: [], cost: 0,
    textEngine: TEXT_MODEL, textProvider: PROVIDER, textFallback: !TEXT_KEY };
}

/* ================= 文本：调上游 + 合规校验 + 本地兜底 ================= */
function callChat(messages, timeoutMs) {
  return httpsJson(TEXT_BASE + '/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TEXT_KEY }
  }, { model: TEXT_MODEL, messages, temperature: 1.0, max_tokens: 1200 }, timeoutMs || 30000)
    .then(r => {
      if (r.status !== 200) throw new Error('text upstream ' + r.status + ': ' + r.raw.slice(0, 120));
      if (!r.json || !r.json.choices || !r.json.choices[0]) throw new Error('bad text json');
      return r.json.choices[0].message.content;
    });
}
function extractJSON(txt) {
  const m = String(txt || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}
async function genText(userText) {
  const non = nonOrderReply(userText);
  if (non) return nonOrderResult(non);
  let data = null;
  for (let attempt = 0; attempt < 2 && !data; attempt++) {
    if (!TEXT_KEY) break;
    const sys = SYSTEM_PROMPT + (attempt === 1
      ? '\n\n【上一次结果含有4种原料之外的东西、人物或禁用词，或JSON不合法。请严格只使用4种原料、不出现人物与禁用词，重新输出合法JSON】' : '');
    let raw;
    try { raw = await callChat([{ role: 'system', content: sys }, { role: 'user', content: userText }]); }
    catch (e) { break; }
    data = extractJSON(raw);
    if (data && data.order === true) {
      const badName = (data.recipe || []).filter(r => !isAllowed(r.name));
      const badWord = findForbidden(data);
      if (badName.length || badWord.length || !Array.isArray(data.recipe) || data.recipe.length === 0) data = null;
    }
  }
  if (!data) return safeFallback(userText, !TEXT_KEY);
  if (data.order === false) {
    return { order: false, apology: '', reply: String(data.reply || '好的，你想喝什么随时告诉我～'),
      lead: '', name: '', meaning: '', why: '', layers: [], benefit: '', desc: '',
      price: 0, temp: 'cold', ice: '', recipe: [], cost: 0,
      textEngine: TEXT_MODEL, textProvider: PROVIDER, textFallback: !TEXT_KEY };
  }
  const recipe = (data.recipe || []).map(r => ({ name: String(r.name), ml: Math.max(0, Math.round(Number(r.ml) || 0)) }));
  const wantsNoMilk = /不要奶|不加奶|去奶|无奶|别放奶|不放奶/.test(userText);
  const recipe2 = wantsNoMilk ? recipe.filter(r => normName(r.name).indexOf('奶') < 0) : recipe;
  const cost = recipeCost(recipe2, data.ice);
  let price = Math.round(Number(data.price) || 0);
  if (!(price >= PRICE_FLOOR && price <= PRICE_CEIL) || price <= cost) {
    price = Math.max(PRICE_FLOOR, Math.min(PRICE_CEIL, Math.round(cost * 2.0)));
  }
  const clean = s => String(s == null ? '' : s).replace(/[「」『』"]/g, '').replace(/\s+/g, ' ').trim();
  /* 顾客可见文案：抹掉原料商品名与生成过程词，只留风味感官 */
  const copySafe = s => clean(s)
    .replace(/东方树叶(乌龙茶|茉莉花茶|红茶|绿茶)?/g, (m, k) => k || '清茶')
    .replace(/水溶\s*[CcＣｃ]/g, '清亮果酸')
    .replace(/鲜橙|橙肉/g, '橙香').replace(/橙汁/g, '橙香')
    .replace(/纯?牛奶/g, '奶香').replace(/牛乳/g, '奶香')
    .replace(/出图一条龙|一条龙服务|AI生成|由AI|大模型|提示词|工作流|流水线/g, '现调')
    .replace(/加冰摇匀|摇匀/g, '调和');
  const layers = Array.isArray(data.layers) ? data.layers.slice(0, 3).map(copySafe).filter(Boolean) : [];
  let apology = copySafe(data.apology);
  if (wantsFizzy(userText) && !apology) {
    apology = '抱歉，这台机器暂时做不了带气泡的饮品，我给你换一杯不加气泡、但一样清爽冰凉的，可以吗？';
  }
  return {
    order: true, apology, reply: copySafe(data.reply),
    lead: copySafe(data.lead).slice(0, 30),
    name: clean(data.name).replace(/特调/g, '').slice(0, 10),
    meaning: copySafe(data.meaning).slice(0, 90),
    why: copySafe(data.why).slice(0, 130),
    layers, benefit: copySafe(data.benefit).slice(0, 90),
    desc: copySafe(data.meaning || data.desc).slice(0, 120),
    price,
    temp: ['cold', 'normal', 'hot'].includes(data.temp) ? data.temp : 'cold',
    ice: clean(data.ice).slice(0, 10) || '正常冰',
    recipe: recipe2, cost,
    textEngine: TEXT_MODEL, textProvider: PROVIDER, textFallback: !TEXT_KEY
  };
}
/* ==================================================================
   本地现调引擎：没有模型 Key 时也【每次现场随机】生成，茶底/配比/名字/
   文案/价格次次不同，绝不是写死的同一杯。原料仍严格限定 4 种。
   ================================================================== */
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const jitter = (base, span, step) => {
  const n = base + (Math.random() * 2 - 1) * span;
  return Math.max(0, Math.round(n / step) * step);
};
const TEA_KINDS = ['乌龙茶', '茉莉花茶', '红茶', '绿茶'];
/* 名字由“风味/意象字 + 收尾”随机组合，4~6 字，全部只指向饮料气质，不含人物 */
const NAME_HEAD = {
  milk:  ['云乳', '雪乳', '月乳', '暖乳', '醇白', '酥云', '绵云', '白月'],
  clear: ['清风', '澄光', '清欢', '叶露', '松风', '竹影', '溪光', '初霁', '晴川', '听雨'],
  orange:['金橙', '橙光', '橘颂', '斜阳', '金橘', '晓橙', '暖橙'],
  tea:   ['乌龙', '茉上', '红窗', '绿萼', '岩韵', '茶色', '一盏', '半山'],
  lux:   ['金阙', '玉盏', '琼崖', '瑶席', '金樽', '云锦']
};
const NAME_TAIL = ['一盏', '清茶', '慢饮', '微醺', '有期', '入怀', '初见', '半盏', '闲时', '叙', '令', '引'];
/* 高情商短引语，每次随机；全局近期记忆保证任何类型的连续点单都不重样 */
const LEADS = [
  '今天这杯，想替你说句话。', '风过叶尖，恰好是这一杯。', '把此刻的心情，调成一杯。',
  '不慌，先喝一口我调的。', '为你单做这一杯，不重复。', '愿这一口，接住今天的你。',
  '茶汤会记得你此刻的偏好。', '我把清爽和温柔，都量给你。', '这一杯，专属于你刚说的那句话。',
  '不必将就，你的口味值得现调。', '日子慢慢过，这杯刚刚好。', '顺手为你，起了个新名字。',
  '好味道，值得为你重新起笔。', '这一杯的开头，是你刚那句话。', '山风与茶香，都为这一刻让路。',
  '愿你喝下的每一口，都正合心意。', '杯里没有将就，只有刚刚好。', '今天的风味，为你另起一行。',
  '先敬此刻——这杯为你现调。', '忙里偷的这口闲，我给你调好。', '愿回甘替我说句：辛苦了。',
  '一杯入喉，万事皆可慢慢来。', '茶烟轻扬，正好配此刻的你。', '这一盏的分寸，是按你的话量的。',
  '不问来路，先敬这一口清爽。', '愿这杯陪你，把匆忙过成从容。', '舌尖先松口气，其余慢慢来。',
  '今天也有一杯，懂你没说出口的那句。'
];
const FIZZ_LEADS = ['没有气泡，也能凉得透亮。', '气泡做不了，清爽我照样给你。', '少了气泡，不少分毫痛快。'];
const LUX_LEADS = ['这一杯，我按今天最好的状态来调。', '贵一点，是因为每一项都往好了做。', '给你调一杯不将就的。', '把顶配的心思，全放进这一杯。'];
/* 近因去重：所有类型的 lead 共用一个近期列表，任何连续点单都尽量不重样 */
const RECENT = { lead: [], name: [], meaning: [] };
function freshLead(pool) {
  const all = LEADS.concat(FIZZ_LEADS, LUX_LEADS);
  const avail = pool.filter(x => RECENT.lead.indexOf(x) < 0);
  const chosen = pick(avail.length ? avail : all.filter(x => RECENT.lead.indexOf(x) < 0).length ? all.filter(x => RECENT.lead.indexOf(x) < 0) : pool);
  RECENT.lead.push(chosen);
  while (RECENT.lead.length > all.length - 1) RECENT.lead.shift();
  return chosen;
}
/* 通用近因去重（meaning 等）：本轮池优先，用完才允许旧句 */
function freshPick(pool, bucketKey) {
  const recent = RECENT[bucketKey] || (RECENT[bucketKey] = []);
  const avail = pool.filter(x => recent.indexOf(x) < 0);
  const chosen = pick(avail.length ? avail : pool);
  recent.push(chosen);
  while (recent.length >= pool.length) recent.shift();
  return chosen;
}
const OPEN_META = [
  '茶香先立住分寸', '让清亮的茶汤打底', '先把茶味沏得干净', '以清透茶感为骨', '茶底先沏出分寸'
];
const WHY_MILK = ['丝滑奶香负责把棱角磨圆', '柔滑口感把茶香裹得柔软', '奶香让入口醇厚顺滑', '奶香慢慢铺开、收住茶的微涩'];
const WHY_C = ['一丝明亮果酸递来清新', '清亮果酸点亮尾调', '微酸把清爽提起来', '一点果酸让酸甜刚刚好'];
const WHY_O = ['橙香负责把层次照亮', '橙香添一抹明亮', '饱满果香让风味更讨喜', '橙香把回甘染成暖色'];
const WHY_TEA = ['茶底清冽不抢戏', '茶香在最后干净回甘', '茶味把整杯托得很稳', '清茶负责解腻与通透'];
const BENEFIT = {
  clear: ['一口下去清透解腻，犯困或吃撑时最救场。', '零负担的清爽，午后回神、饭后解腻都合适。', '凉得透亮，适合想让脑子清醒一下的时刻。', '清淡不甜腻，久坐、加班来一杯正舒服。'],
  milk:  ['奶香温柔、茶味回甘，累的时候很治愈。', '顺滑暖胃又有满足感，适合犒劳一下自己。', '一杯下去很踏实，冷天或心烦时格外贴心。', '口感绵密不齁，当下午茶刚刚好。'],
  orange:['维C果香明亮，早晨或没精神时来一杯很元气。', '酸甜清新、果香讨喜，想喝点有滋味又不腻的选它。', '橙香让人心情亮起来，配早餐或午后都好。', '清爽又带果香，解腻开胃两不误。'],
  hot:   ['热气裹着茶香升起，捧在手里、暖到胃里。', '天冷或受凉时来一杯，整个人都松下来。', '温润不烫口，适合慢慢喝、慢慢缓口气。', '热饮暖胃，加班的深夜尤其贴心。']
};
function buildRecipe(prof, hot){
  const total = jitter(prof.lux ? 400 : (prof.doubleMilk?380:350), prof.lux?20:20, 10); // 300~420
  let ml = {};
  const teaMin = prof.milk ? 150 : (prof.orange&&!prof.c ? 110 : 190);
  let rest = total;
  if(prof.milk){
    let milkBase = prof.lux?170:150;
    if(prof.doubleMilk) milkBase += 60;
    if(prof.lessMilk) milkBase -= 50;
    const milk = jitter(milkBase, 22, 10);
    ml.milk = Math.min(milk, total - teaMin);
    rest -= ml.milk;
  }
  if(prof.orange){
    // 纯橙汁是主角（不掺C时给到 180~220）；橙+C 共存时橙汁做辅
    const o = prof.c ? jitter(70, 14, 5) : jitter(200, 24, 10);
    ml.orange = Math.max(0,o); rest -= ml.orange;
  }
  if(prof.c){ const cc = jitter(prof.orange?85:125, 20, 5); ml.c = Math.max(0,cc); rest -= ml.c; }
  if(rest < teaMin){ // 超出预算，按比例削果料保茶底
    let excess = teaMin - rest;
    ['orange','c','milk'].forEach(k=>{ const cut=Math.min(ml[k]||0, excess); ml[k]=(ml[k]||0)-cut; excess-=cut; });
    rest = total - (ml.milk||0) - (ml.orange||0) - (ml.c||0);
  }
  ml.tea = Math.max(teaMin, rest);
  // 茶底：用户指定优先；否则奶茶/热饮偏红茶，清爽款乌龙/茉莉/绿
  let teaKind = prof.teaKind;
  if(!teaKind){
    if(prof.milk || hot) teaKind = Math.random()<0.72 ? '红茶' : pick(['乌龙茶','茉莉花茶']);
    else teaKind = pick(['乌龙茶','茉莉花茶','绿茶','红茶']);
  }
  const recipe = [{ name: '东方树叶('+teaKind+')', ml: ml.tea }];
  if(ml.milk>0) recipe.push({ name: '牛奶', ml: ml.milk });
  if(ml.orange>0) recipe.push({ name: '橙汁', ml: jitter(ml.orange,6,5)||40 });
  if(ml.c>0) recipe.push({ name: '水溶C', ml: jitter(ml.c,6,5)||40 });
  return recipe;
}
function buildLayers(prof){
  const first = prof.milk
    ? pick(['初口奶香温软，轻轻盖住舌尖','第一口是顺滑奶香，茶味随后浮起','入口绵柔，奶香先打了个招呼'])
    : prof.orange
      ? pick(['初口橙香明亮，像被晨光叫醒','第一口酸甜清亮，精神一振','入口先是鲜果香，很讨喜'])
      : pick(['初口茶香清冽，像被轻轻叫醒','第一口干净透亮，舌尖一醒','入口清茶先至，清爽利落']);
  const mid = prof.milk
    ? (prof.orange? '中段奶香里透出一点橙香，层次很妙' : '中段茶味从奶香里慢慢浮上来')
    : prof.c
      ? '中段清亮果酸缓缓铺开，酸甜刚好'
      : '中段茶汤在嘴里转开，清而不淡';
  const tail = (prof.hot? '余温顺着喉咙下去，很踏实' : '收口干净，留一缕回甘') + pick(['，想再喝一口','','，不挂甜腻','，很清爽']);
  return [first, mid, tail];
}
function craftCopy(recipe, prof){
  const has = { tea:true, milk:!!prof.milk, c:!!prof.c, orange:!!prof.orange, hot:prof.hot };
  // why：把每种在场原料的角色串起来，顺序 茶→奶→(橙/C)
  const whyBits = [];
  if(has.milk) whyBits.push(pick(WHY_MILK));
  if(has.orange) whyBits.push(pick(WHY_O));
  if(has.c) whyBits.push(pick(WHY_C));
  whyBits.push(pick(WHY_TEA));
  let why = pick(OPEN_META) + '，' + whyBits.slice(0,-1).join('，') + '；' +
    whyBits[whyBits.length-1] + '。';
  // 风味短描述（屏幕用）：只写入口感受与香气，不出现原料商品名、不描述怎么调配
  let desc;
  const teaWord = recipe[0].name.includes('茉莉')?'茉莉':recipe[0].name.includes('乌龙')?'乌龙':recipe[0].name.includes('绿')?'绿茶':'红茶';
  if(prof.fizzy) desc = teaWord+'茶香清透'+(has.orange||has.c?'、果酸明亮':'')+'，满杯冰把凉意压得很足，一口下去透心解腻、通体舒畅。';
  else if(has.milk && has.orange) desc = teaWord+'茶香与奶香温柔交融，尾上调一缕明亮橙香，顺滑里藏着清新，冰爽不腻。';
  else if(has.milk) desc = has.hot
    ? teaWord+'茶香温润醇厚，奶香丝滑铺开，热气裹着香气升起，一口暖到胃里、肩也松了。'
    : teaWord+'茶香与奶香交融得刚好，入口顺滑、回甘干净，冰爽不腻，是很有满足感的一杯。';
  else if(has.orange) desc = teaWord+'茶汤清亮，托住明亮橙香'+(has.c?'，酸甜比例恰到好处':'')+(has.hot?'，温热入口果香更柔和，暖胃又回神。':'，满杯冰爽通透，一口解腻回神。');
  else if(has.c) desc = has.hot
    ? teaWord+'茶香干净，果酸清亮温润，酸甜刚好不张扬，暖胃又提神。'
    : teaWord+'茶香干净、果酸清亮，酸甜清爽不抢戏，冰镇后一口通透，提神不腻。';
  else desc = teaWord+'茶汤清冽纯粹，'+(has.hot?'热气悠悠、回甘温润':'冰着喝清透解腻')+'，是回归本味的一杯。';
  return { why, desc };
}
function makeName(prof){
  const bag = [];
  if(prof.lux) bag.push(...NAME_HEAD.lux);
  if(prof.milk) bag.push(...NAME_HEAD.milk);
  if(prof.orange) bag.push(...NAME_HEAD.orange);
  if(prof.clear || prof.c || (!prof.milk && !prof.orange)) bag.push(...NAME_HEAD.clear);
  bag.push(...NAME_HEAD.tea);
  /* 名字必须只描述这杯里真有的东西：不含奶/不含果汁时，把越界的字头剔掉 */
  let heads = bag.filter((x,i)=>bag.indexOf(x)===i);
  if(!prof.milk) heads = heads.filter(w=>!/乳|酥云|绵云|醇白|白月/.test(w));
  if(prof.noFruit || (!prof.orange && !prof.c)) heads = heads.filter(w=>!/橙|橘|果/.test(w));
  if(!heads.length) heads = NAME_HEAD.tea;
  /* 同名也尽量不连出：重抽几轮避开最近用过的全名 */
  let candidate;
  for(let i=0;i<12;i++){
    candidate = pick(heads) + pick(NAME_TAIL);
    if(RECENT.name.indexOf(candidate) < 0) break;
  }
  RECENT.name.push(candidate);
  while(RECENT.name.length > 14) RECENT.name.shift();
  return candidate;
}
function localCreate(t){
  const noMilk = /不要奶|不加奶|去奶|无奶|别放奶|不放奶|没奶/.test(t);
  /* 温度三态：常温必须先于"热"判断（"常温"不含热字，但要显式识别） */
  const roomTemp = /常温|室温|不冰|不要冰的|温的(?!.*热)/.test(t) && !/热|烫/.test(t);
  const hot = /热|烫|暖/.test(t) && !roomTemp;
  /* 冰量四档 */
  const noIce = /去冰|不要冰|不加冰|无冰|别放冰|不放冰/.test(t);
  const lessIce = /少冰|少点冰|冰少/.test(t);
  const extraIce = /多冰|多放点冰|满冰|冰多/.test(t);
  let iceLabel;
  if(hot) iceLabel='热饮无冰';
  else if(roomTemp) iceLabel='常温无冰';
  else if(noIce) iceLabel='去冰';
  else if(lessIce) iceLabel='少冰';
  else if(extraIce) iceLabel='多冰';
  else iceLabel='正常冰';
  /* 甜度：少糖/半糖/无糖/多糖 */
  const noSugar = /无糖|不要糖|不加糖|别放糖|不甜|不要甜|不加甜|少甜/.test(t);
  const lowSugar = /少糖|半糖|低糖|微糖|三分糖|糖少|少点糖|不要太甜|别太甜|不太甜|少点甜/.test(t);
  const moreSugar = /多糖|全糖|甜一点|多加糖|糖多|更甜/.test(t);
  const sugar = noSugar?'无糖':lowSugar?'少糖':moreSugar?'多糖':'正常糖';
  const luxury = /最贵|顶级|豪华|最好|高端|顶配|不差钱|贵一点|贵的|来杯好的|最好的/.test(t);
  const cheap = /便宜|10块|十块|15|最便宜|实惠|划算/.test(t);
  const fizzy = wantsFizzy(t);
  const tl = t.toLowerCase();
  /* 明确否定果汁/酸味时，橙汁与水溶C一律不放，名字里也绝不允许出现橙/橘/果字 */
  const noFruit = /不要果汁|不带果汁|不加果|无果汁|别放果|不要水果|不含果|去果|不要橙|不加橙|别放橙|不要酸|不酸|别酸|不要果味|不带果味/.test(tl);
  /* 真橙汁/橘汁才走"满橙"；水溶C/补维C只算明亮果酸（浅色果茶场景），清爽等口感词不再强塞果酸 */
  const wantOrange = !noFruit && /橙|橘|桔|果汁/.test(tl);
  const wantC = !noFruit && !wantOrange && /维\s*c|补\s*c|vc|c100|水溶|柠檬|果味/.test(tl);
  /* 指定茶底：乌龙/茉莉/红茶/绿茶 */
  let teaKind = null;
  if(/绿茶/.test(t)) teaKind='绿茶';          // 绿茶先判，避免被"茉莉绿茶"的茉莉抢占
  else if(/乌龙|岩茶|大红袍|铁观音/.test(t)) teaKind='乌龙茶';
  else if(/茉莉|茉香/.test(t)) teaKind='茉莉花茶';
  else if(/红茶/.test(t)) teaKind='红茶';
  /* 奶量：双倍/多加 vs 少奶；纯橙汁场景不默认加奶 */
  const doubleMilk = /双倍奶|双份奶|奶多|多奶|多加奶|奶味重|奶味浓/.test(t);
  const lessMilk = /少奶|奶少|少点奶/.test(t);
  const rich = /浓郁|醇厚|香醇|丝滑|厚/.test(t);
  /* "不甜/少糖"里的甜不算想要奶：先抹掉所有甜度表达再判断 */
  const sweetWanted = /甜|蜜/.test(t.replace(/不甜|少糖|半糖|无糖|低糖|微糖|三分糖|不要甜|不加糖|不要太甜|少甜|不.*甜/g,''));
  const milkWord = /奶|拿铁|牛乳|丝滑|醇厚|浓郁|香醇|温柔|治愈|女生|女孩|少女|精致|高级/.test(t) || sweetWanted;
  const clear = fizzy || /清爽|清新|解腻|解渴|通透|不.*腻|提神|醒|困|熬夜|清淡|不.*甜|无糖/.test(t);
  const explicitMilk = /奶|拿铁|牛乳/.test(t);
  const explicitTea = /清茶|纯茶|原叶|绿茶$/.test(t) || /茉莉清茶|乌龙清茶/.test(t);
  let useMilk;
  if(noMilk || explicitTea) useMilk=false;            // 点名清茶/纯茶绝不加奶
  else if(wantOrange && !explicitMilk) useMilk=false;
  else if(rich && !explicitMilk) useMilk=false;
  else if(explicitMilk) useMilk=true;
  else if(hot || milkWord) useMilk = Math.random()<0.75;
  else if(clear || wantC || fizzy) useMilk=false;
  else useMilk = Math.random()<0.45;
  /* 橙汁必须是主角：只点橙汁/果汁时不掺水溶C；橙+C（如"橙味维C"）才共存 */
  const bothFruit = wantOrange && /维\s*c|水溶|柠檬|c100/.test(tl);
  /* "最贵/最好"且没有任何成分倾向时，顶配默认给厚奶茶，不能给寡淡清茶 */
  if(luxury && !wantOrange && !wantC && !explicitMilk && !clear && !fizzy) useMilk = true;
  const prof = {
    milk: !!useMilk, doubleMilk, lessMilk,
    orange: !!wantOrange,
    c: !noFruit && (bothFruit ? true : (wantOrange ? false : !!(wantC || fizzy))),
    noFruit: !!noFruit,
    clear: clear||fizzy, hot, roomTemp, lux: luxury, cheap, fizzy,
    teaKind, sugar, iceLabel
  };
  // 热饮且无奶无水果时也合理；保证至少有茶+一种特征
  const recipe = buildRecipe(prof, hot);
  const name = makeName(prof);
  const cp = craftCopy(recipe, prof);
  const layers = buildLayers(prof);
  const benefitPool = hot ? BENEFIT.hot : prof.milk ? BENEFIT.milk : prof.orange ? BENEFIT.orange : BENEFIT.clear;
  const meaning = freshPick([
    '名字里藏着这一杯的性情，愿茶是清的、果是亮的，喝的人是松快的。',
    '以茶汤为骨、风味为韵，把你此刻的心情，封进这一口刚刚好里。',
    '不必名贵，合你心意就是好名字——愿这杯接住今天的你。',
    '取的是味道也是祝愿：清清爽爽，或温温柔柔，都随你。',
    '杯名如人，不必喧哗；愿这一口的清润，恰好说中你的心事。',
    '把山野的清气和此刻的松弛，都收进这盏名字里。',
    '好名字是一句轻祝福：愿你忙里有闲，苦后有回甘。',
    '这名字只写心情——愿你喝到的每一口，都恰逢其时。',
    '一盏一名，一名一心意；愿这杯的余韵，陪你把今天过得慢一点。'
  ], 'meaning');
  const cost = recipeCost(recipe, hot?'热饮无冰':'正常冰');
  let price;
  if(luxury) price = Math.min(PRICE_CEIL, Math.max(21, Math.round(cost*2.4)));
  else price = Math.max(PRICE_FLOOR, Math.min(PRICE_CEIL, Math.round(cost*2.0)+(Math.random()<0.4?1:0)));
  /* 气泡：先说明情况与原因，再讲静止冰饮的好，最后致歉——思考放在产品文案里，不在对话里废话 */
  const fizzApology = '抱歉呀，这台机子暂时做不了带气泡的饮品——气泡是高压打入的二氧化碳，硬加气会冲散茶香、也会损伤机器的现调阀。其实想要"爽"，未必非得靠气泡：我用一杯清透'+
    (prof.c?'带明亮果酸':'茶香干净')+(prof.orange?'、橙香清新':'')+'的冰饮，把温度压得很低，靠低温和通透把清爽做足——入口更顺、茶香更完整，也不胀肚子。这就给你调一杯无气泡但一样透心凉的，好吗？';
  const fizzWhy = pick([
    '没有二氧化碳抢戏，茶香与果酸才品得完整；满杯冰把温度压得很低，清爽是靠"透"出来的，不是靠气泡"扎"出来的。',
    '静止冰饮的好处是顺口、不胀气，茶的回甘和果香的清甜能一层一层喝出来；冰得够透，凉意也更持久。',
    '舍弃气泡是为了保住茶底的干净——气冲会把香气带走，而这杯的亮点恰恰是清透鲜爽的茶感，冰镇后一样解腻痛快。'
  ]);
  /* 贵价：专属高质感文案，价值感要配得上价格 */
  const luxLead = freshLead(LUX_LEADS);
  const luxWhy = pick([
    '茶底给得足、萃取时间特意拉长，茶香更厚；'+(useMilk?'奶香比例上调，入口更丝滑圆润':''+(prof.orange?'果香更饱满明亮':'果酸和回甘都更立体'))+'，冰量也压得讲究，从头喝到尾浓度不塌。',
    '这杯的价值花在你喝得出的地方：茶味更足、香气给得饱满'+(useMilk?'、奶香更浓更顺':'')+'，层次融得更高级，不是简单加重口味，而是把平衡做得更稳。',
    '顶配的意思是茶底加量、萃取更久，浓淡、酸甜、冰感全部往"浓郁饱满"那一档调，茶香先到、厚度跟上、回甘收尾，适合想认真犒劳自己的时刻。'
  ]);
  const luxBenefit = pick(['用料更足、茶味更厚，一杯的满足感顶得上两杯，适合犒赏认真生活的你。','香气、厚度、回甘都更完整，喝得出"贵一点好在哪里"。']);
  return {
    order: true,
    apology: fizzy ? fizzApology : '',
    reply: '',
    lead: fizzy ? freshLead(FIZZ_LEADS) : (luxury ? luxLead : freshLead(LEADS)),
    name, meaning,
    why: fizzy ? fizzWhy : (luxury ? luxWhy : cp.why),
    benefit: luxury ? luxBenefit : pick(benefitPool),
    layers,
    desc: cp.desc,
    price,
    temp: hot?'hot':(prof.roomTemp?'normal':'cold'), ice: prof.iceLabel, sugar,
    recipe, cost,
    textEngine: TEXT_MODEL, textProvider: PROVIDER, textFallback: true
  };
}
function safeFallback(t, failed) {
  const non = nonOrderReply(t);
  if (non) return nonOrderResult(non);
  return localCreate(t);
}

/* ================= 出图：只画这一杯，原料只能来自配方 ================= */
/* 四套参考图风格（用户提供的豆包样张），按饮品类型自动选景；只迁移光影/构图/色调，
   不复制样张上的蝴蝶、花朵等机器里没有的装饰。原图留存于 参考图/ 目录。
   提示词刻意精简（实测 900 字符内对"零文字/杯型/场景"的遵循度最高）。 */
const SCENE_STYLES = {
  /* 参考图1：奶茶——暖米绿调、枫叶枝、茶叶飞溅、浅绿杯套 */
  milk: 'creamy milk tea in a tall clear plastic takeaway cup with matte pale-sage-green silicone cup sleeve, creamy ivory milk at the bottom swirling into caramel-amber tea on top, ice cubes, condensation droplets; warm sage-green and cream background, a slender branch of fresh green maple leaves upper left, dry tea leaves flying above the cup, soft golden morning light',
  /* 参考图4：满橙——暖金光影、鲜橙环绕、云雾缭绕 */
  orange: 'fresh orange tea in a tall clear plastic takeaway cup filled with vivid bright-orange gradient juice and clear ice, condensation droplets; glowing warm golden-yellow backdrop with soft bokeh, one whole orange and one sliced orange half suspended in the air around the cup, juice droplets sparkling, soft white mist curling around the cup base, rich warm sunlight',
  /* 参考图2：浅色果茶——白底百叶窗影、绿叶枝、橙皮与干茶点缀 */
  fruitLight: 'light pale fruit tea in a tall clear plastic cup, translucent pale peach-amber tea with large diamond clear ice cubes, condensation droplets; bright airy pure-white background with crisp diagonal window-blind shadows from morning sun, a thin branch of green leaves upper right, a few dry tea leaves drifting, on the table one curled strip of orange peel as the only prop',
  /* 参考图3：清茶——高调白底、细透明吸管、绿叶、金琥珀茶汤 */
  tea: 'pure clear tea in a tall straight clear plastic cup with a single thin transparent straw, crystal-clear golden-amber tea; clean minimal high-key white background, one slim branch of light-green leaves softly blurred behind the cup, a soft leaf shadow on the white tabletop, airy and serene'
};
/* 热饮覆盖句：去冰+蒸汽 */
const HOT_NOTE = ', HOT version: no ice cubes, gentle soft white steam rising from the cup opening, cozy warm light';
/* 结尾硬约束：好喝/正经杯子/零文字/纯饮料（精简但关键词全覆盖） */
const STYLE_TAIL = ' Ultra realistic premium beverage photography, vertical 3:4, the drink looks irresistibly delicious. ' +
  'Vessel is ONLY a normal clear plastic takeaway cup or plain glass cup, no bottle, no jar, no can, no bowl, no teapot. ' +
  'REALISTIC LIQUID COLOR: the beverage itself must only be amber tea-brown, creamy ivory milk-white, vivid orange, or pale yellow-citrus; the drink is NEVER green, blue, purple, pink, red or any unnatural color (green cup sleeve, leaves and background are fine, but the liquid must not be green). ' +
  'ABSOLUTELY NO TEXT: no characters, letters, numbers, logo, watermark or print, blank cup only. ' +
  'No people, no flower, no butterfly, no mint, no lemon, no bubbles. ZERO written characters.';
function sceneStyle(ing, temp){
  let key;
  if(ing.milk) key='milk';
  else if(ing.orange) key='orange';
  else if(ing.c) key='fruitLight';
  else key='tea';
  return SCENE_STYLES[key] + (temp==='hot' ? HOT_NOTE : '');
}
/* 风味信号只输出英文：避免中文进提示词诱发模型在画面上题字 */
const CN_SIGNALS = [
  { re: /清爽|清新|清冽|解腻|通透|解渴|清凉|凉/, en: 'clean, crisp and refreshing taste' },
  { re: /浓郁|醇厚|丝滑|绵密|奶香|厚乳|顺滑/, en: 'rich silky creamy mouthfeel' },
  { re: /橙|橘|桔|鲜橙|香橙/, en: 'bright vivid orange aroma' },
  { re: /茶|乌龙|茉莉|红(?:茶)?|绿(?:茶)?|东方树叶|回甘|茶香/, en: 'clear tea fragrance with a sweet lingering aftertaste' },
  { re: /酸|酸甜|维C|维c|c100|C100|水溶|柠檬味/, en: 'fresh light fruity acidity' },
  { re: /甜|甘|蜜|微甜/, en: 'gentle natural sweetness, not cloying' },
  { re: /温柔|治愈|暖|安慰|放松|舒缓/, en: 'gentle soothing and comforting' },
  { re: /高级|豪华|顶级|精致|优雅|贵|奢|品质/, en: 'refined premium and elegant' },
  { re: /元气|开心|活力|醒神|提神|醒/, en: 'bright and energizing' },
  { re: /热|烫|温/, en: 'warm serving temperature' },
  { re: /冰|冷|凉|冰镇/, en: 'icy cold serving temperature' }
];

/* 据配方名推导 4 原料开关——画面原料严格等于配方，而不是顾客随口说的 */
function ingredientsFromRecipe(recipe, temp) {
  const names = (recipe || []).map(r => normName(r.name)).join(' ');
  const has = re => re.test(names);
  const hot = temp === 'hot';
  return {
    tea: has(/东方树叶|乌龙|茉莉|红茶|绿茶/),
    milk: has(/奶/),
    c: has(/水溶|维c|c100/),
    orange: has(/橙/),
    ice: !hot
  };
}
function buildFlavorNote(name, desc, mood, temp) {
  const raw = [name, desc, mood].filter(Boolean).join(' ');
  const sig = [];
  CN_SIGNALS.forEach(x => { if (x.re.test(raw) && sig.indexOf(x.en) < 0) sig.push(x.en); });
  const pick_sig = sig.slice(0, 2);
  if (!pick_sig.length) pick_sig.push(temp === 'hot' ? 'warm comforting flavor' : 'fresh balanced flavor');
  return 'Express this flavor through color and texture only: ' + pick_sig.join(', ') + '.';
}
function buildImagePrompt(opts) {
  const ing = opts.ingredients || {};
  /* 风味只通过颜色质感表达（1~2 个信号足够，多了稀释关键约束） */
  const flavor = buildFlavorNote(opts.name, opts.desc, opts.mood, opts.temp);
  return flavor + ' ' + sceneStyle(ing, opts.temp) + STYLE_TAIL;
}
function pollinationsURL(prompt, seed) {
  /* 匿名免费通道：不加 enhance（它会改写提示词）；该通道固定 turbo、自带水印，
     由小程序前端用 CSS 裁掉右下角水印区域，仅作无 Key 时的应急兜底。 */
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
    '?width=768&height=1100&seed=' + (seed != null ? seed : Math.floor(Math.random() * 1e9)) +
    '&nologo=true&model=turbo';
}
async function callSeedream(prompt, seed) {
  const body = { model: ARK_IMAGE_MODEL, prompt, response_format: 'url', watermark: false, size: '2K' };
  if (seed != null) body.seed = seed;
  const r = await httpsJson(ARK_BASE + '/images/generations',
    { method: 'POST', headers: { Authorization: 'Bearer ' + ARK_API_KEY } }, body);
  if (r.status !== 200 || !r.json || !r.json.data || !r.json.data[0] || !r.json.data[0].url) {
    throw new Error('Seedream 出图失败：' + ((r.json && r.json.error && r.json.error.message) || ('HTTP ' + r.status)));
  }
  return { url: r.json.data[0].url, model: ARK_IMAGE_MODEL };
}
/* 出图：有方舟 Key 走 Seedream；失败/无 Key 降级 pollinations（标记 degraded，小程序可提示） */
async function genImage(opts) {
  const seed = opts.seed != null ? Number(opts.seed) : crypto.randomInt(1, 1e9);
  const prompt = buildImagePrompt(opts);
  if (ARK_API_KEY) {
    try {
      const r = await callSeedream(prompt, seed);
      return { ok: true, provider: 'seedream', model: r.model, url: r.url, prompt, seed, degraded: false };
    } catch (e) {
      return { ok: true, provider: 'pollinations', degraded: true, error: String(e.message || e),
        url: pollinationsURL(prompt, seed), prompt, seed };
    }
  }
  return { ok: true, provider: 'pollinations', degraded: true, need: ['ARK_API_KEY'],
    url: pollinationsURL(prompt, seed), prompt, seed };
}

/* ================= 编排：一句话 → 文案配方 + 图片 ================= */
async function makeDrink(userText) {
  const d = await genText(userText);
  if (!d.order) return { ...d, image: null };
  const ingredients = ingredientsFromRecipe(d.recipe, d.temp);
  const image = await genImage({
    name: d.name,
    desc: [d.meaning, d.desc, d.why].filter(Boolean).join(' '),
    mood: userText,
    ingredients, temp: d.temp
  });
  return { ...d, ingredients, image };
}

/* ================= HTTP 服务 ================= */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
}
function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise(resolve => {
    let b = ''; req.on('data', c => { b += c; if (b.length > 20000) req.destroy(); }); req.on('end', () => resolve(b));
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8' };
function serveStatic(res, urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/+/, ''));
  const fp = path.join(__dirname, rel);
  if (!fp.startsWith(__dirname)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}
const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;

  if (p === '/health') {
    return sendJSON(res, 200, {
      ok: true,
      text: { provider: PROVIDER, model: TEXT_MODEL, keyConfigured: !!TEXT_KEY },
      image: { model: ARK_IMAGE_MODEL, seedream: !!ARK_API_KEY, fallback: 'pollinations' },
      ingredients: INGREDIENTS.map(i => i.name), fizzy: 'unsupported'
    });
  }

  if (req.method === 'POST') {
    let j = {};
    try { j = JSON.parse((await readBody(req)) || '{}'); } catch (e) { return sendJSON(res, 400, { error: '请求体不是合法 JSON' }); }

    /* 主接口：一句话一条龙 */
    if (p === '/api/drink') {
      const userText = String(j.text || '').slice(0, 500);
      if (!userText.trim()) return sendJSON(res, 400, { error: 'empty text' });
      const out = await makeDrink(userText);
      return sendJSON(res, 200, { id: crypto.randomUUID(), ...out });
    }

    /* 只出文案/配方（兼容旧前端） */
    if (p === '/api/text' || p === '/api/generate') {
      const userText = String(j.text || '').slice(0, 500);
      if (!userText.trim()) return sendJSON(res, 400, { error: 'empty text' });
      const out = TEXT_KEY ? await genText(userText) : safeFallback(userText, true);
      return sendJSON(res, 200, { id: crypto.randomUUID(), ...out });
    }

    /* 只出图（兼容独立出图应用） */
    if (p === '/api/image/generate') {
      const ing = j.ingredients || ingredientsFromRecipe([], j.temp);
      const out = await genImage({
        name: j.name, desc: j.desc, mood: j.mood || j.keywords,
        ingredients: ing, temp: j.temp, seed: j.seed
      });
      return sendJSON(res, 200, out);
    }
    if (p === '/api/image/prompt') {
      const ing = j.ingredients || ingredientsFromRecipe([], j.temp);
      return sendJSON(res, 200, { prompt: buildImagePrompt({ name: j.name, desc: j.desc, mood: j.mood, ingredients: ing, temp: j.temp }) });
    }
  }

  if (p === '/' || p === '/app') return serveStatic(res, '/AI饮品出图应用.html');
  return serveStatic(res, p);
});
server.listen(PORT, () => {
  console.log('饮料机 AI 编排服务已启动  http://localhost:' + PORT);
  console.log('  主接口  POST /api/drink   一句话 → 文案/配方 + 豆包出图');
  console.log('  文本大脑 ', PROVIDER, '/', TEXT_MODEL, '| Key:', TEXT_KEY ? '已配置' : '未配置(本地规则兜底)');
  console.log('  出图    豆包', ARK_IMAGE_MODEL, '| ARK Key:', ARK_API_KEY ? '已配置(Seedream)' : '未配置(pollinations 兜底)');
  console.log('  铁律    只有4种原料 / 无气泡致歉替代 / 只画饮料不画人');
});
