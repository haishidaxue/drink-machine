/* ============================================================
 * 饮料机 · 文本生成后台引擎（默认 Kimi K3，OpenAI 兼容，可切豆包/DeepSeek）
 * ------------------------------------------------------------
 * 这是"后台那个想文案、做理解的文本大脑"（不是出图模型，也不是小程序界面）。
 *
 * 默认模型：Kimi K3（月之暗面，OpenAI 兼容接口）
 *   base_url : https://api.moonshot.ai/v1
 *   model    : kimi-k3
 *   获取 Key : https://platform.moonshot.cn （API 按量计费；Kimi 网页版免费不等于 API 免费）
 * 也可一键切到火山方舟「豆包」或 DeepSeek，只需换环境变量（见下）。
 *
 * 启动（Key 只放服务端，绝不进前端）：
 *   LLM_API_KEY=sk-你的key  PORT=8787  node 文本AI后端中转_server.js
 * 切模型（三选一，不配则默认 Kimi K3）：
 *   # 豆包(火山方舟)：LLM_PROVIDER=doubao  LLM_MODEL=doubao-seed-1-6-250615
 *   # DeepSeek    ：LLM_PROVIDER=deepseek LLM_MODEL=deepseek-chat
 *
 * 业务铁律（写死在服务端，模型不听话就拦截/重试/兜底，不靠模型自觉）：
 *   1) 机器只有 4 种原料：东方树叶(乌龙/茉莉/红/绿茶底)、水溶C100柠檬味、100%橙汁、纯牛奶；外加冰/水。
 *      青柠/柠檬片/薄荷/气泡/苏打/珍珠/椰果/燕麦奶/椰奶/糖/蜂蜜/咖啡/花朵 等一律禁止出现。
 *   2) 机器没有气泡技术：顾客要气泡/苏打/汽水 → 明确致歉，改推一杯"不加气泡、同样清爽"的冰饮。
 *   3) "适合女生/高级/治愈"等词只用来修饰【这杯饮料】的气质，绝不生成/描述任何人。
 *
 * 零第三方依赖，Node 18+ 直接运行。
 * ============================================================ */
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* ---------- 配置：环境变量优先，其次 文本配置.json ---------- */
(function loadConfigFile() {
  try {
    const cf = path.join(__dirname, '文本配置.json');
    if (fs.existsSync(cf)) {
      const j = JSON.parse(fs.readFileSync(cf, 'utf8'));
      for (const k of ['LLM_PROVIDER', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_BASE_URL', 'PORT', 'ALLOW_ORIGIN']) {
        if (j[k] != null && j[k] !== '' && process.env[k] == null) process.env[k] = String(j[k]);
      }
    }
  } catch (e) { console.error('[config]', e.message); }
})();

const PROVIDERS = {
  kimi:     { base: 'https://api.moonshot.ai/v1',           model: 'kimi-k3' },
  doubao:   { base: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-250615' },
  deepseek: { base: 'https://api.deepseek.com',            model: 'deepseek-chat' }
};
const PROVIDER = (process.env.LLM_PROVIDER || 'kimi').toLowerCase();
const pv = PROVIDERS[PROVIDER] || PROVIDERS.kimi;
const PORT = process.env.PORT || 8787;
const API_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const MODEL = process.env.LLM_MODEL || pv.model;
const UPSTREAM = (process.env.LLM_BASE_URL || pv.base).replace(/\/+$/, '');
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

/* ---------- 机器里"真实存在"的原料：只有这 4 种（外加冰/水，不算配料） ---------- */
const INGREDIENTS = [
  { key: 'tea',    name: '东方树叶', kinds: ['乌龙茶', '茉莉花茶', '红茶', '绿茶'] },
  { key: 'vitC',   name: '水溶C',    kinds: ['水溶C100 柠檬味'] },
  { key: 'orange', name: '橙汁',     kinds: ['100%橙汁'] },
  { key: 'milk',   name: '牛奶',     kinds: ['纯牛奶'] }
];
const ALLOWED_NAMES = ['东方树叶', '乌龙茶', '茉莉花茶', '茉莉', '红茶', '绿茶',
  '水溶c', '水溶c100', '水溶c100柠檬味',
  '橙汁', '100%橙汁', '橙子汁', '牛奶', '纯牛奶', '冰', '冰块', '水', '矿泉水'];

/* 任何文案/配方里都绝不允许出现的东西（机器没有、或会诱导出图画人） */
const FORBIDDEN = ['青柠', '柠檬片', '薄荷', '气泡', '苏打', '汽水', '雪碧', '可乐', '珍珠', '椰果',
  '燕麦', '椰奶', '蜂蜜', '奶油', '奶盖', '咖啡', '美式', '拿铁', '仙草', '布丁', '芋圆', '果肉',
  '玫瑰', '花朵', '花瓣', '樱花', '薰衣草', '迷迭香', '香草', '百里香',
  '女生', '女孩', '少女', '女人', '美女', '男生', '男孩', '男人', '人物', '人像', '一个人', '一位'];

/* 单杯原料市场采购成本（元/杯用量），用于定价下限 */
const COST = { tea: 1.6, vitC: 2.2, orange: 2.6, milk: 2.0, ice: 0.3 };
const CUP_OVERHEAD = 1.2;
const PRICE_FLOOR = 18, PRICE_CEIL = 24;

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
'- meaning：30~55字，讲清名字的引申义与寓意，把原料或风味化成一个意象/一句祝福。\n' +
'- why：45~70字，讲清"为什么这样调配"：如何呼应顾客需求、每种原料承担什么角色；若是气泡替代，要在此说明致歉与替代思路。\n' +
'- layers：恰好3句、每句≤22字，写清风味递进：第一口 / 中段 / 回甘余韵，具体可感。\n' +
'- benefit：30~50字，这杯的好处与最适合的场景/心情，体贴有分寸。\n' +
'- 全程只写这杯饮料，绝不出现人物；避免"奢华尊贵"等廉价词，文白相杂但要自然克制。\n\n' +
'只输出一个JSON对象，禁止解释、markdown、思考过程：\n' +
'点单：{"order":true,"apology":"","lead":"","name":"","meaning":"","why":"","layers":["","",""],"benefit":"","price":0,"temp":"cold|normal|hot","ice":"正常冰|少冰|去冰|热饮无冰","recipe":[{"name":"东方树叶(乌龙茶)","ml":200},{"name":"水溶C","ml":120}]}\n' +
'非点单：{"order":false,"apology":"","reply":"一句亲切高情商、不顶撞的话","lead":"","name":"","meaning":"","why":"","layers":[],"benefit":"","price":0,"recipe":[]}';

const DAILY_ANGLES = ['唤醒与开工的早晨', '午后低谷的解乏续能', '傍晚收工的犒赏与松弛',
  '独处时的安静陪伴', '久别重逢的小庆祝', '雨天/降温里的温暖托住', '周末慢下来的自我关照'];
const DAILY_PROMPT =
'你是顶级东方茶饮品牌首席文案。为这一杯"每日推荐"写今日推荐语。今天角度：%ANGLE%，日期：%DATE%。' +
'要求：只写这一角度，45~80字，第二人称，有画面有情绪有文学性，像小品开头，能勾人下单；' +
'不要价格、不分点、不要标题、不要引号，只输出正文一句话。机器只有东方树叶/水溶C/橙汁/牛奶四种原料，' +
'不得出现青柠、薄荷、气泡、花朵或任何4种之外的东西，也不得出现人物。饮品：%NAME%（%EN%），风味：%HINT%。';


/* ---------- 调上游 OpenAI 兼容 chat 接口 ---------- */
function callChat(messages, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ model: MODEL, messages, temperature: 1.0, max_tokens: 1200 });
    const u = new URL(UPSTREAM + '/chat/completions');
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY, 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('upstream ' + res.statusCode + ': ' + body.slice(0, 160)));
        try { const j = JSON.parse(body); resolve(j.choices[0].message.content); }
        catch (e) { reject(new Error('bad upstream json')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs || 30000, () => req.destroy(new Error('timeout')));
    req.write(payload); req.end();
  });
}

function extractJSON(txt) {
  if (!txt) return null;
  const m = String(txt).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
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
/* 文案里是否混入禁用词（青柠/薄荷/气泡/人物等） */
function findForbidden(data) {
  const text = ['lead', 'name', 'meaning', 'why', 'benefit', 'apology', 'reply']
    .map(k => String(data[k] || '')).join(' ') + ' ' +
    (Array.isArray(data.layers) ? data.layers.join(' ') : '') + ' ' +
    (Array.isArray(data.recipe) ? data.recipe.map(r => r.name || '').join(' ') : '');
  return FORBIDDEN.filter(w => text.indexOf(w) >= 0);
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

/* 用户是否在要"带气"的饮品（机器做不了） */
function wantsFizzy(t) { return /气泡|苏打|汽水|雪碧|可乐|带气|加气|充气|fizz|sparkling|soda/i.test(t); }

async function generate(userText) {
  let data = null;
  for (let attempt = 0; attempt < 2 && !data; attempt++) {
    if (!API_KEY) break;
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

  if (!data) return safeFallback(userText, !API_KEY);
  if (data.order === false) {
    return { order: false, apology: '', reply: String(data.reply || '好的，你想喝什么随时告诉我～'),
      lead: '', name: '', meaning: '', why: '', layers: [], benefit: '', desc: '',
      price: 0, recipe: [], engine: MODEL, provider: PROVIDER };
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
  const layers = Array.isArray(data.layers) ? data.layers.slice(0, 3).map(clean).filter(Boolean) : [];

  /* 顾客要气泡：无论模型写没写，都由服务端补上诚恳致歉（铁律二，不靠模型） */
  let apology = clean(data.apology);
  if (wantsFizzy(userText) && !apology) {
    apology = '抱歉，这台机器暂时做不了带气泡的饮品，我给你换一杯不加气泡、但一样清爽冰凉的，可以吗？';
  }

  return {
    order: true, apology, reply: '',
    lead: clean(data.lead).slice(0, 30),
    name: clean(data.name).replace(/特调/g, '').slice(0, 10),
    meaning: clean(data.meaning).slice(0, 90),
    why: clean(data.why).slice(0, 120),
    layers,
    benefit: clean(data.benefit).slice(0, 90),
    desc: clean(data.meaning || data.desc).slice(0, 120),
    price, temp: ['cold', 'normal', 'hot'].includes(data.temp) ? data.temp : 'cold',
    ice: clean(data.ice).slice(0, 10) || '正常冰',
    recipe: recipe2, cost,
    engine: MODEL, provider: PROVIDER
  };
}

async function daily(name, en, hint, dateStr, angleIdx) {
  const angle = DAILY_ANGLES[((Number(angleIdx) % DAILY_ANGLES.length) + DAILY_ANGLES.length) % DAILY_ANGLES.length];
  const sys = DAILY_PROMPT.replace('%ANGLE%', angle).replace('%DATE%', dateStr)
    .replace('%NAME%', name).replace('%EN%', en || '').replace('%HINT%', hint || '招牌现调');
  if (!API_KEY) return { text: '', angle, engine: MODEL, error: 'no key' };
  try {
    const raw = await callChat([{ role: 'user', content: sys }], 20000);
    let text = String(raw || '').replace(/^["“]|["”]$/g, '').replace(/\s+/g, ' ').trim();
    const m = text.match(/[一-龥][^]*$/);
    if (m) text = m[0].trim();
    if (FORBIDDEN.some(w => text.indexOf(w) >= 0)) text = ''; // 文案越界则交给前端兜底
    return { text: text.slice(0, 130), angle, engine: MODEL, provider: PROVIDER };
  } catch (e) {
    return { text: '', angle, engine: MODEL, error: String(e.message || e) };
  }
}

/* 模型不可用 / 结果越界时的安全兜底：仍只用4种原料、无气泡、不出现任何禁用词与人物，文案保持质感 */
function safeFallback(t, failed) {
  const noMilk = /不要奶|不加奶|去奶|无奶|别放奶|不放奶/.test(t);
  const hot = /热|烫|暖/.test(t);
  const luxury = /贵|顶级|豪华|最好/.test(t);
  const fizzy = wantsFizzy(t);
  const wantOrange = /橙|橘|桔|维C|vc|酸/.test(t);
  const wantMilk = /奶|丝滑|醇厚|浓郁|香醇|拿铁|温柔|治愈|女生|女孩|少女|精致|高级|甜|蜜/.test(t);
  const clear = fizzy || /清爽|清新|解腻|解渴|通透|不.*腻|提神|醒|困|熬夜|清淡|不.*甜|无糖/.test(t);
  const useMilk = !noMilk && (hot || (!clear && wantMilk) || (!clear && !wantOrange && !fizzy));
  let recipe;
  if (useMilk) {
    recipe = wantOrange
      ? [{ name: '东方树叶(红茶)', ml: 180 }, { name: '牛奶', ml: 140 }, { name: '橙汁', ml: 60 }]
      : [{ name: '东方树叶(红茶)', ml: 200 }, { name: '牛奶', ml: 160 }];
  } else if (clear || noMilk) {
    recipe = wantOrange
      ? [{ name: '东方树叶(乌龙茶)', ml: 200 }, { name: '橙汁', ml: 70 }, { name: '水溶C', ml: 90 }]
      : [{ name: '东方树叶(乌龙茶)', ml: 210 }, { name: '水溶C', ml: 130 }];
  } else {
    recipe = [{ name: '东方树叶(红茶)', ml: 200 }, { name: '牛奶', ml: 160 }];
  }
  const name = fizzy ? '清风一盏'
    : luxury ? (useMilk ? '金阙乌龙' : '金阙清茶')
    : (useMilk ? '一盏清欢' : '澄光清茶');
  return {
    order: true,
    apology: fizzy ? '抱歉，这台机器暂时做不了带气泡的饮品，我给你换一杯不加气泡、但一样清爽冰凉的，可以吗？' : '',
    reply: '',
    lead: fizzy ? '没有气泡，也能凉得透亮。' : luxury ? '把暮色里最后一缕暖光，封进这杯。' : '风过叶尖，这一杯正好。',
    name,
    meaning: '以茶汤为骨、果味为韵，名字里藏着此刻的心情——愿这一杯，恰好接住你。',
    why: fizzy
      ? '这台机器没有气泡技术，我用清爽乌龙茶底托住水溶C与一点橙汁的明亮果酸，再加满冰：少了气泡的冲，多了茶香的干净，一样透心解腻。'
      : '依据你说的口味与心情，用干净的茶底托住层次，再以果酸或牛奶调节轻重，让每一口都有呼应。',
    layers: ['初口茶香清冽，像被轻轻叫醒', '中段果酸或奶香缓缓铺开', '收口干净，留一缕回甘'],
    benefit: '现调现做、负担清爽，适合忙里偷闲或需要被好好对待的这一刻。',
    desc: fizzy
      ? '虽然做不了气泡，但乌龙的清、水溶C与橙汁的亮、满杯的冰，一样把清爽拉到极致，透心解腻。'
      : (useMilk
        ? (hot
            ? '红茶汤温润醇厚，兑入丝滑纯牛奶，热气裹着茶香缓缓升起，一口暖到胃里、也松了肩。'
            : '红茶与纯牛奶温柔交融，奶香顺滑、茶味回甘，冰爽不腻，是很有满足感的一杯。')
        : '乌龙清茶托住水溶C的明亮果酸，加一点鲜橙把层次点亮，满杯冰爽通透，一口解腻回神。'),
    price: luxury ? 22 : 18,
    temp: hot ? 'hot' : 'cold', ice: hot ? '热饮无冰' : '正常冰',
    recipe, cost: recipeCost(recipe, hot ? '热饮无冰' : '正常冰'),
    engine: MODEL, provider: PROVIDER, fallback: !!failed
  };
}

/* ---------- HTTP ---------- */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, provider: PROVIDER, model: MODEL, base: UPSTREAM,
      keyConfigured: !!API_KEY, ingredients: INGREDIENTS.map(i => i.name), fizzy: 'unsupported' }));
  }
  if (req.method !== 'POST' || (req.url !== '/api/generate' && req.url !== '/api/text' && req.url !== '/api/daily')) {
    res.writeHead(404); return res.end('not found');
  }

  let body = '';
  req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
  req.on('end', async () => {
    try {
      const j = JSON.parse(body || '{}');
      if (req.url === '/api/daily') {
        const name = String(j.name || '今日特选');
        const out = await daily(name, String(j.en || ''), String(j.hint || ''),
          String(j.date || new Date().toISOString().slice(0, 10)),
          j.angleIdx != null ? j.angleIdx : Math.floor(Date.now() / 86400000));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ id: crypto.randomUUID(), name, ...out }));
      }
      const userText = String(j.text || (j.messages && j.messages[j.messages.length - 1] && j.messages[j.messages.length - 1].content) || '').slice(0, 500);
      if (!userText.trim()) { res.writeHead(400); return res.end(JSON.stringify({ error: 'empty text' })); }
      /* 纯打招呼/道谢/欢笑，且没有任何点单线索 → 友好闲聊，不开单 */
      const smallTalk = /^[\s,，。.!！?？~～呀啊哦哈呵嘿]*((你?好|您好|哈喽|嗨|hi|hello|hey|在吗|在不在|喂|谢谢|谢啦|感谢|多谢|thanks?|thank\s*you|哈哈+|呵呵+|233+|666+)[\s,，。.!！?？~～呀啊哦哈呵嘿]*)+$/i.test(userText.trim());
      if (smallTalk) {
        const out = { order: false, apology: '', reply: '在的～你想喝点什么？口味、心情、预算都可以直接告诉我。',
          lead: '', name: '', meaning: '', why: '', layers: [], benefit: '', desc: '',
          price: 0, temp: 'cold', ice: '', recipe: [], engine: MODEL, provider: PROVIDER, fallback: !API_KEY };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ id: crypto.randomUUID(), ...out }));
      }
      /* 没配 Key 也能用：直接返回合规的本地兜底，机器不停、且绝不越界 */
      const out = API_KEY ? await generate(userText) : safeFallback(userText, true);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ id: crypto.randomUUID(), ...out }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(safeFallback('', true)));
    }
  });
});

server.listen(PORT, () => {
  console.log('饮料机文本引擎已启动  http://localhost:' + PORT);
  console.log('供应商:', PROVIDER, '| 模型:', MODEL, '| base:', UPSTREAM);
  console.log('Key已配置:', !!API_KEY, '| 原料:', INGREDIENTS.map(i => i.name).join('、'), '| 气泡: 不支持(致歉+替代)');
});
