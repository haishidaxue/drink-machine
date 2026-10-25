
/* ===== (全屏 IIFE 已移除，改用纯 CSS 响应式) ===== */
/* ===== 用户提供的原图（已按你的纠正重新对应名称） ===== */
var IMG={
  d1:"https://www.coze.cn/s/TxXg7XVRxxY/",  /* 橙香醒力饮：纯橙橙子 */
  d2:"https://www.coze.cn/s/Dt9Op9hhlJ4/",  /* 茶云舒润饮：蝴蝶奶茶 */
  feng:"https://www.coze.cn/s/m3Hd3OotAv8/",/* 橙风疏沁饮：浅淡竹叶橙 */
  rou:"https://www.coze.cn/s/ZzD8jY9vjy0/", /* 橙柔云萃饮：更橙的竹叶橙 */
  aiHot:"https://www.coze.cn/s/4e3fDJa-37Q/",  /* 热的提神 */
  aiFizz:"https://www.coze.cn/s/rFp19tzqgQw/", /* 清爽带气泡 */
  aiLight:"https://www.coze.cn/s/ok7xYY_vy3M/",/* 不要太甜·清淡 */
  aiMilk:"https://www.coze.cn/s/suWeVhlLQss/", /* 奶香浓郁 */
  ai:"https://www.coze.cn/s/0WgIi1S0kQU/",     /* AI特调默认 */
  wxPay:"images/wxpay.webp"             /* 店主真实微信收款码（截图，可直接扫码付款） */
};
/* 数组下标用于“每日轮换”；ord 用于饮品选择页的规范顺序 */
var DRINKS=[
  {id:"d1",name:"橙香醒力饮",en:"ORANGE ENERGY",price:16,ord:0,
   reason:"清晨或午后犯困时，明亮橙香与清茶迅速唤醒状态，酸甜提神、冰凉通透，是今天最适合给身体“开机”的一杯。"},
  {id:"d2",name:"茶云舒润饮",en:"TEA CLOUD",price:15,ord:1,
   reason:"干燥或需要放松时，温润红茶香遇上丝滑奶香，柔和不刺激，像给喉咙和心情盖上一层柔软的云。"},
  {id:"feng",name:"橙风疏沁饮",en:"FRESH BREEZE",price:14,ord:3,
   reason:"餐后或闷热时，清透乌龙茶香托着明亮橙香与一丝果酸，满杯冰爽、一扫油腻，像迎面吹来一阵干净的风。"},
  {id:"rou",name:"橙柔云萃饮",en:"CLOUD ORANGE",price:17,ord:2,
   reason:"想被温柔款待时，橙香与茶香交融、口感丝滑，酸甜恰到好处，治愈又有小小的满足感。"}
];
function imgOf(d){return IMG[d.id];}
function drinkById(id){for(var i=0;i<DRINKS.length;i++)if(DRINKS[i].id===id)return DRINKS[i];return DRINKS[0];}
function dailyIndex(){var n=new Date(),s=new Date(n.getFullYear(),0,0);return Math.floor((n-s)/86400000)%4;}
function todayStr(){var n=new Date();return n.getFullYear()+"年"+(n.getMonth()+1)+"月"+n.getDate()+"日";}
var ctx={drinkId:"d1",aiName:"",aiImg:"",aiType:"",aiDesc:"",aiLead:"",aiWhy:"",aiLayers:[],aiBenefit:"",aiMeaning:"",aiPrice:18,lastPrice:0,isAI:false,targetBudget:0,aiTier:0};
/* 扫码即用，无需注册登录；支付直接拉起微信支付，密码/指纹由微信与手机系统验证，本小程序不自造密码 */

/* ==================================================================
   LEDGER —— 饮料机记账（收入 / 退款支出 + 时间），localStorage 持久化
   ================================================================== */
var LEDGER={
  KEY:"drink_machine_ledger_v1",
  mem:null,
  load:function(){
    if(this.mem)return this.mem;
    this.mem=[];
    try{
      var raw=window.localStorage.getItem(this.KEY);
      if(raw)this.mem=JSON.parse(raw)||[];
    }catch(e){this.mem=[];}
    return this.mem;
  },
  save:function(){
    try{window.localStorage.setItem(this.KEY,JSON.stringify(this.mem));}catch(e){}
  },
  add:function(kind,amount,item,method,extra){
    var list=this.load();
    var now=new Date();
    var rec={
      id:"L"+now.getTime()+String(Math.floor(Math.random()*900)+100),
      kind:kind,                 // income | refund
      amount:Math.round(Number(amount)*100)/100,
      item:item||(kind==="income"?"饮品销售":"退款"),
      method:method||"",
      from:(extra&&extra.from)||"",        // 来自谁（手机号掩码）
      cost:extra&&extra.cost!=null?Math.round(extra.cost*100)/100:0,
      refOf:(extra&&extra.refOf)||"",      // 退款对应的收入记录 id
      ts:now.getTime()
    };
    list.unshift(rec);
    this.save();
    return rec;
  },
  addIncome:function(amount,item,method,extra){return this.add("income",amount,item,method,extra);},
  addRefund:function(amount,item,method,extra){return this.add("refund",amount,item,method,extra);},
  totals:function(){
    var income=0,refund=0,cost=0,incN=0,refN=0;
    this.load().forEach(function(r){
      if(r.kind==="refund"){refund+=r.amount;refN++;}
      else{income+=r.amount;cost+=(r.cost||0);incN++;}
    });
    function r2(x){return Math.round(x*100)/100;}
    return {income:r2(income),refund:r2(refund),cost:r2(cost),
      net:r2(income-refund),
      profit:r2(income-refund-cost),
      incN:incN,refN:refN};
  },
  markRefunded:function(id){
    this.load().forEach(function(r){if(r.id===id)r.refunded=true;});
    this.save();
  },
  reset:function(){this.mem=[];this.save();}
};
function maskPhone(s){if(!s)return"";if(s.length<7)return s;
  return s.slice(0,3)+"****"+s.slice(7);}
function ledgerTime(ts){
  var d=new Date(ts),p2=function(n){return (n<10?"0":"")+n;};
  return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+" "+
    p2(d.getHours())+":"+p2(d.getMinutes())+":"+p2(d.getSeconds());
}
function ledgerHM(ts){
  var d=new Date(ts),p2=function(n){return (n<10?"0":"")+n;};
  return p2(d.getHours())+":"+p2(d.getMinutes());
}




/* ===== 线条图标 ===== */
var ICON={
  sun:'<svg width="23" height="23" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#5f7a66"/><g stroke="#5f7a66" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="4.8"/><line x1="12" y1="19.2" x2="12" y2="21"/><line x1="3" y1="12" x2="4.8" y2="12"/><line x1="19.2" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="6.9" y2="6.9"/><line x1="17.1" y1="17.1" x2="18.4" y2="18.4"/><line x1="18.4" y1="5.6" x2="17.1" y2="6.9"/><line x1="6.9" y1="17.1" x2="5.6" y2="18.4"/></g></svg>',
  spark:'<svg width="23" height="23" viewBox="0 0 24 24"><path d="M12 3.5l1.7 4.9 4.9 1.7-4.9 1.7L12 16.7l-1.7-4.9L5.4 10.1l4.9-1.7z" fill="#43584a"/><path d="M18 14.8l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#8a9a87"/></svg>',
  cup:'<svg width="23" height="23" viewBox="0 0 24 24"><path d="M7.4 4.4h9.2l-.9 13.3a2 2 0 0 1-2 1.8h-3.4a2 2 0 0 1-2-1.8z" fill="#5f7a66"/><path d="M16.6 6.4h1.9a1.7 1.7 0 0 1 0 3.4h-2.2" stroke="#5f7a66" stroke-width="1.7"/><rect x="8.4" y="2.4" width="7.2" height="1.6" rx=".8" fill="#8a9a87"/></svg>',
  book:'<svg width="23" height="23" viewBox="0 0 24 24"><path d="M5 4.8a1.4 1.4 0 0 1 1.4-1.4h10.4A1.6 1.6 0 0 1 18.4 5v14.2H6.4A1.4 1.4 0 0 1 5 17.8z" fill="#5f7a66"/><path d="M18.4 5v14.2" stroke="#f4f2ea" stroke-width="1.2"/><g stroke="#f4f2ea" stroke-width="1.3" stroke-linecap="round"><line x1="8.3" y1="8.2" x2="14.2" y2="8.2"/><line x1="8.3" y1="11" x2="14.2" y2="11"/><line x1="8.3" y1="13.8" x2="11.8" y2="13.8"/></g></svg>'
};

/* 奶量水滴：高度由空到满，差异明显 */
function dropSVG(fill){
  var heights=[0,6,11,16],h=heights[fill],y=21-h;
  return '<svg width="17" height="17" viewBox="0 0 24 24">'+
    '<path d="M12 2.5C12 2.5 5 11 5 16a7 7 0 0 0 14 0C19 11 12 2.5 12 2.5z" fill="#e9ece6" stroke="#a9b4ab" stroke-width="1.6"/>'+
    '<clipPath id="mz'+fill+'"><path d="M12 2.5C12 2.5 5 11 5 16a7 7 0 0 0 14 0C19 11 12 2.5 12 2.5z"/></clipPath>'+
    (h>0?'<rect x="5" y="'+y+'" width="14" height="'+h+'" fill="#5f7a66" clip-path="url(#mz'+fill+')"/>':'')+'</svg>';
}
var MILKICON=[dropSVG(0),dropSVG(1),dropSVG(2),dropSVG(3)];
/* 糖量方糖 */
function sugarSVG(n){
  var cubes="",pos=[[3.5,9],[10.5,5],[7.5,12.5],[14.5,10.5]];
  for(var i=0;i<n;i++){var p=pos[i];
    cubes+='<rect x="'+p[0]+'" y="'+p[1]+'" width="5.4" height="5.4" rx="1.2" fill="#d0ba8b" stroke="#b29a68" stroke-width=".8"/>';}
  return '<svg width="18" height="17" viewBox="0 0 24 20">'+cubes+'</svg>';
}
var SUGARICON=[sugarSVG(0),sugarSVG(1),sugarSVG(2),sugarSVG(4)];

/* 上升气泡 */
function bubblesHTML(n){
  var s="",seed=3;
  function rnd(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}
  for(var i=0;i<n;i++){
    var size=(3+rnd()*9).toFixed(1),left=(rnd()*94).toFixed(1),
        dur=(3.2+rnd()*3.6).toFixed(2),delay=(-rnd()*6).toFixed(2);
    s+='<i style="left:'+left+'%;width:'+size+'px;height:'+size+'px;animation-duration:'+dur+'s;animation-delay:'+delay+'s"></i>';
  }
  return '<div class="bubbles">'+s+'</div>';
}

function stageHTML(d,extraClass){
  return '<div class="stage '+(extraClass||'')+'"><div class="topglow"></div>'+
    '<img src="'+imgOf(d)+'"><div class="haze"></div></div>';
}

var T={};
T.home=function(){
  return (BUILD_MODE==="combined"?'<div class="ver-float" id="homeVer">版本</div>':"")+
  '<div class="home-hero">'+
    '<div class="kicker">A I · T E A</div>'+
    '<h1>渴了吗，<br>购买 <span class="em">AI 饮料机</span></h1>'+
    '<div class="sub">一 杯 懂 你 的 好 茶</div><div class="rule"></div></div>'+
    '<div class="home-menu">'+
      '<div class="hopt" data-go="daily"><div class="badge">'+ICON.sun+'</div>'+
        '<div class="txt"><b>每日推荐</b><span>今日限定灵感特调</span></div><div class="go">›</div></div>'+
      '<div class="hopt" data-go="ai"><div class="badge">'+ICON.spark+'</div>'+
        '<div class="txt"><b>AI 配比</b><span>说出喜好，为你定制</span></div><div class="go">›</div></div>'+
      '<div class="hopt" data-go="select"><div class="badge">'+ICON.cup+'</div>'+
        '<div class="txt"><b>饮品选择</b><span>四款招牌，任你挑选</span></div><div class="go">›</div></div>'+
    '</div><div class="home-foot">S I P · T H E · F U T U R E</div>';
};

T.daily=function(){
  var d=DRINKS[dailyIndex()];ctx.drinkId=d.id;ctx.isAI=false;ctx.targetBudget=0;ctx.aiTier=0;
  return stageHTML(d)+
    '<div class="titleblock"><div class="en">'+d.en+'</div><div class="n">'+d.name+'</div>'+
      '<div class="hairline"></div></div>'+
    '<div class="dateline">'+todayStr()+' · 每日 00:00 刷新</div>'+
    '<div class="prose"><div class="lab">今日推荐</div><p id="dailyPitch">'+d.reason+'</p></div>'+
    '<div class="priceplain"><b>¥'+d.price+'</b><span>/ 杯</span></div>'+
    '<button class="cta" data-go="config">选 择 这 款</button>';
};

T.ai=function(){
  return '<div class="chatwrap"><div class="chatlist" id="chatlist"></div>'+
    '<div class="chatinput"><input id="chatinput" placeholder="用你自己的话告诉我想喝什么…"><button id="chatsend">➤</button></div></div>';
};

/* ===== AI 风味占比高脚杯（个人版：酸/甜/苦/辣/咸） ===== */
var FLA={sour:{n:"酸",fill:"#F5C53A",ring:"#D99E00"},sweet:{n:"甜",fill:"#F7A3C2",ring:"#DF5F97"},bitter:{n:"苦",fill:"#5CB36A",ring:"#378A45"},spicy:{n:"辣",fill:"#E4514A",ring:"#C52E27"},salty:{n:"咸",fill:"#4B92E4",ring:"#2A6DC2"}};
var FLAVOR_EMPTY={seg:[],keys:["sour","sweet","bitter","spicy","salty"]};
/* ===== 对话口味意图解析：否定清零 / 多少调档 / 只要X铺满；辣咸默认绝不放 ===== */
var TASTE_WORDS={
  sour:["酸","橙汁","橙子","鲜橙","橙","橘","果汁","果味","柠檬","水溶c","维c","水果味"],
  sweet:["甜","糖","蜂蜜"],
  bitter:["苦","茶","回甘","涩","咖啡"],
  spicy:["辣","辣椒","辛辣","胡椒"],
  salty:["咸","盐","海盐"],
  milk:["奶香","牛奶","鲜奶","拿铁","牛乳","燕麦奶","椰奶","豆奶","奶"]
};
function _tasteNeg(raw,ws){
  return new RegExp("(?:不要|不想喝|不喝|不加|不放|不要有|别加|别放|别|没有|无|去掉|去|戒|不)\\s*(?:"+ws.join("|")+")").test(raw);
}
function _tasteLevel(raw,ws){
  var a=ws.join("|");
  var P3="(?:多加点|多加|多放|多点|加倍|加重|浓|重口|多)(?:一点|一些|一点?儿|点|些)?";
  var P1="(?:少放点|少加|少放|少点|清淡|一丢丢|一丁丁|微|淡|少)(?:一点|一些|一点?儿|点|些)?";
  var P2="(?:想要|要|喝点?|来点?|加点?|放些|带点?|来份)";
  var A3="多一点|多点|多些|浓一点|浓点|再浓|重点";
  var A1="少一点|少点|少些|淡一点|淡点|轻点|微点";
  var A2="一点|一些|一点儿|点儿|些|点";
  if(new RegExp("(?:"+P3+")\\s*(?:"+a+")|(?:"+a+")\\s*(?:"+A3+")").test(raw))return 3;
  if(new RegExp("(?:"+P1+")\\s*(?:"+a+")|(?:"+a+")\\s*(?:"+A1+")").test(raw))return 1;
  if(new RegExp("(?:"+P2+")\\s*(?:"+a+")|(?:"+a+")\\s*(?:"+A2+")").test(raw))return 2;
  return 0;
}
function parseTasteIntent(raw,base,keys){
  raw=String(raw||"");
  var w={sour:0,sweet:0,bitter:0,spicy:0,salty:0,milk:0};
  var present={};
  keys.forEach(function(k){
    var ws=TASTE_WORDS[k],neg=_tasteNeg(raw,ws),lv=_tasteLevel(raw,ws);
    if(base[k])w[k]=base[k];
    if(neg){w[k]=0;}
    else if(lv>0){
      if(k==="spicy"||k==="salty"){w[k]=lv;}                 /* 辣/咸：特制口味，只有明确要才出现 */
      else if(lv===3){w[k]=3;}                              /* 多/浓 */
      else if(lv===1){w[k]=1;}                             /* 少/微/淡 */
      else{w[k]=w[k]||2;}                                  /* 明确要：基底没放也补上正常档 */
    }
    if(!neg&&new RegExp(ws.join("|")).test(raw))present[k]=lv||2;
  });
  /* 独占句式：只要X / 全是X / 满杯X —— 只留被点名的味，其余(含默认基础味)全清，归一化后即铺满 */
  if(/只要|只想喝|只想|唯独|就想喝|就要|整杯都|满杯都|全是|全都要/.test(raw)){
    var any=keys.some(function(k){return present[k];});
    if(any)keys.forEach(function(k){w[k]=present[k]||0;});
  }
  return w;
}

/* ===== 库存诚实闸门 v1：AI 的一切口味/原料承诺都必须以四格库现货为准；没有的原料如实告知做不到 ===== */
function _pTag(name){
  var t=String(name||"");
  if(/水溶|维\s*c|c100|气泡|苏打|汽水|可乐|雪碧|柠檬/.test(t))return "c";
  if(/椰奶|燕麦奶|豆奶|酸奶|奶|拿铁|牛乳|厚乳|奶盖|奶油|芝士/.test(t))return "milk";
  if(/咖啡|美式|espresso/.test(t))return "coffee";
  if(/橙|橘|柑|桔/.test(t))return "orange";
  if(/茶|树叶|乌龙|茉莉|红茶|绿茶|普洱/.test(t))return "tea";
  if(/莓|葡萄|桃|梨|苹果|芒|百香|西瓜|荔枝|香蕉|椰子|柠檬|果|汁/.test(t))return "fruit";
  if(/水|矿泉/.test(t))return "water";
  return "other";
}
/* 这句话想要哪些原料类别。strong=true=明确点名该原料；false=只是口感倾向(如丝滑/清爽) */
function _pWants(t){
  t=String(t||"");var out=[],seen={};
  function add(tag,label,strong,re){if(seen[tag])return;if(re.test(t)){seen[tag]=1;out.push({tag:tag,label:label,strong:strong});}}
  add("milk","奶",true,/椰奶|燕麦奶|豆奶|酸奶|奶|拿铁|牛乳|厚乳|奶盖|奶油|芝士/);
  add("milk","奶",false,/奶香|丝滑|顺滑|醇厚|浓郁|绵密|厚一点|浓一点/);
  add("tea","茶",true,/茶|乌龙|茉莉|红茶|绿茶|普洱|树叶|回甘/);
  add("coffee","咖啡",true,/咖啡|美式|espresso/);
  add("orange","橙",true,/橙|橘|柑|桔/);
  add("c","维C/气泡饮",true,/水溶|维\s*c|c100|补\s*c|气泡|苏打|汽水|可乐|雪碧|柠檬/);
  add("fruit","水果",true,/莓|葡萄|桃|梨|苹果|芒|百香|西瓜|荔枝|香蕉|椰子|果汁|果味|水果|果茶/);
  add("fruit","水果",false,/酸|清爽|清新|解腻|醒神|解渴|果味/);
  add("water","水",true,/矿泉水|纯净水|白开水|温水|来杯水|喝点水/);
  return out;
}
function _pStock(){
  var items=INGDB.list(),tags={},names=[];
  items.forEach(function(x){names.push(x.name);var tg=_pTag(x.name);if(!tags[tg])tags[tg]=x.name;});
  return {items:items,names:names,tags:tags,count:items.length};
}
function _pMilkPhrase(t){
  if(/奶香/.test(t))return "奶香";
  if(/浓郁|浓一点/.test(t))return "浓郁";
  if(/丝滑|顺滑/.test(t))return "丝滑";
  if(/醇厚/.test(t))return "醇厚";
  if(/绵密/.test(t))return "绵密";
  return "奶味";
}
/* 现货满足不了这句话点名的原料 → 返回拒绝话术(多行)；满足得了 → 返回 "" */
function _pGate(raw){
  var t=String(raw||""),st=_pStock();
  if(!st.count){
    return "现在原料库四个格子都是空的，我手头什么原料都没有，这杯真没法给你变出来。\n你先到「原料库」里放至少 2 种原料，我马上照着现货给你调。";
  }
  var haveList="现在库里只有："+st.names.join("、")+"。";
  var wants=_pWants(t),hard=[],soft=[];
  wants.forEach(function(w){if(!st.tags[w.tag]){(w.strong?hard:soft).push(w);}});
  if(hard.length){
    var labels=[];hard.forEach(function(h){if(labels.indexOf(h.label)<0)labels.push(h.label);});
    var miss=labels.join("、"),line;
    if(labels.indexOf("奶")>=0){
      if(/奶香|丝滑|顺滑|醇厚|浓郁|绵密/.test(t)){
        line="你要的「"+_pMilkPhrase(t)+"」得用奶才行，可现在原料库里没有任何奶制品，我没办法给你做出"+_pMilkPhrase(t)+"，也不能凭空给你变出奶来。";
      }else{
        line="你点的奶制品（牛奶、椰奶、燕麦奶等）现在原料库里没有，我没办法照你说的给你加奶。";
      }
    }else{
      line="你点的「"+miss+"」现在原料库里没有，我没办法照你说的做这一杯。";
    }
    return line+"\n"+haveList+"\n你可以换一种库里有的原料，或者先到「原料库」把"+miss+"补上，我再给你调。";
  }
  if(soft.some(function(s){return s.tag==="milk";})&&!st.tags.milk){
    return "你想要的那种丝滑醇厚的奶香口感得加奶才行，可现在库里没有奶，我做不出这个口感，也不想拿别的东西假装给你。\n"+haveList+"\n要不我就用这些现货给你调一杯？你说一声就行。";
  }
  return "";
}
/* 现货钳制：cst 中库内没有的类别一律清零（默认值/记住的偏好都不许凭空出现） */
function _pClampCst(){
  var tags=_pStock().tags;
  if(!tags.milk)cst.milk=0;
  if(!(tags.orange||tags.c||tags.fruit))cst.extra.orange=0;
  return tags;
}
/* 配料开关钳制：配图/风味只反映现货；主料全无但有果类现货时，用果味呈现而不是画成茶/奶 */
function _pClampIng(ingredients){
  var tags=_pStock().tags,anyFruit=!!(tags.orange||tags.c||tags.fruit);
  ingredients.milk=!!ingredients.milk&&!!tags.milk;
  ingredients.orange=!!ingredients.orange&&!!tags.orange;
  ingredients.c=!!ingredients.c&&(!!tags.c||!!tags.fruit);
  ingredients.tea=!!ingredients.tea&&!!tags.tea;
  if(!ingredients.milk&&!ingredients.orange&&!ingredients.c&&!ingredients.tea&&anyFruit)ingredients.c=true;
  return ingredients;
}


/* ===== 语音 v2：单击麦克风录入/再单击发送/双击取消；AI 回复自动朗读 ===== */
/* —— 语音合成（朗读 AI 回复） —— */
var _tts={supported:("speechSynthesis" in window),voice:null};
function _pickZhVoice(){
  if(!("speechSynthesis" in window))return null;
  var vs=window.speechSynthesis.getVoices()||[];
  var pref=vs.filter(function(v){return /zh|cmn|Chinese|Mandarin/i.test(v.lang+v.name)&&/female|女|xiaoxiao|ting|mei|yaoyao|hui/i.test(v.name);});
  if(!pref.length)pref=vs.filter(function(v){return /zh|cmn|Chinese|Mandarin/i.test(v.lang+v.name);});
  return pref[0]||null;
}
if("speechSynthesis" in window){
  _tts.voice=_pickZhVoice();
  try{window.speechSynthesis.onvoiceschanged=function(){_tts.voice=_pickZhVoice();};}catch(e){}
}
function _ttsStop(){if("speechSynthesis" in window){try{window.speechSynthesis.cancel();}catch(e){}}}
function _speak(text){
  text=String(text||"").trim();
  if(!text)return;
  if(!("speechSynthesis" in window))return;
  try{
    window.speechSynthesis.cancel();
    var u=new SpeechSynthesisUtterance(text);
    u.lang="zh-CN";u.rate=1.02;u.pitch=1.06;u.volume=1;
    var v=_pickZhVoice();if(v)u.voice=v;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
/* 把 AI 气泡内容转成顺耳的朗读语：去按钮/图例/表情，只留这杯的介绍 */
function _speakable(el){
  var node=el.cloneNode(true);
  /* 移除：按钮、图例、风味可视化（SVG/百分比）、emoji头像 */
  node.querySelectorAll("button,.abtns,.legend,.flavor-legend,.flavviz,#gobletWrap,svg,i,.cai-av,.alead").forEach(function(x){x.remove&&x.remove();});
  var t=node.textContent||"";
  t=t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu,"");
  t=t.replace(/&[a-z]+;/gi,"");
  t=t.replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n").replace(/[。！？]\s*/g,function(m){return m;});
  t=t.replace(/\s*·\s*/g,"，");
  t=t.replace(/拒\s*绝|记住我的偏好|开\s*始|选\s*择\s*这\s*款/g,"");
  t=t.replace(/\n/g,"，").replace(/，{2,}/g,"，").replace(/^[\s，。、]+|[\s，。、]+$/g,"");
  return t;
}
/* 监听聊天容器：任意 .cmsg.ai 文本稳定后自动朗读；新 AI 消息会打断旧朗读 */
var _watchTimers={};
function _watchChat(scope){
  var list=(scope&&scope.querySelector)?scope.querySelector("#chatlist"):null;
  if(!list||list.__watched)return;list.__watched=1;
  function consider(ai){
    var key=ai;
    if(_watchTimers[key])clearTimeout(_watchTimers[key]);
    _watchTimers[key]=setTimeout(function(){
      var txt=_speakable(ai);
      if(txt&&txt.length>1&&ai.__lastSay!==txt){
        ai.__lastSay=txt;_speak(txt);
      }
    },520);
  }
  var mo=new MutationObserver(function(muts){
    var hit=false;
    muts.forEach(function(m){
      m.addedNodes&&m.addedNodes.forEach(function(nd){
        if(nd.nodeType===1&&nd.classList&&nd.classList.contains("ai")){consider(nd);hit=true;}
      });
      if(m.type==="characterData"&&m.target&&m.target.nodeType===3){
        var ai=m.target.parentElement&&m.target.parentElement.closest?m.target.parentElement.closest(".cmsg.ai"):null;
        if(ai){consider(ai);hit=true;}
      }
      if(m.type==="childList"&&m.target&&m.target.closest){
        var a2=m.target.closest(".cmsg.ai");if(a2){consider(a2);hit=true;}
      }
    });
    if(hit){/* 由 consider 统一延时，避免打字机动画抖动 */}
  });
  mo.observe(list,{childList:true,characterData:true,subtree:true});
}
/* —— 语音输入：单击麦克风开始/再单击发送，双击取消 —— */
(function(){
  var css="#vMic{position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:18px;line-height:1;cursor:pointer;opacity:.85;z-index:3;padding:5px;border-radius:50%;-webkit-user-select:none;user-select:none;touch-action:manipulation;transition:transform .12s}"+
  "#vMic:active{transform:translateY(-50%) scale(1.15)}"+
  "#vMic.rec{background:#e4514a;color:#fff;opacity:1;animation:vp 1s infinite ease-in-out}"+
  ".chatinput{position:relative!important}.chatinput #chatinput{padding-left:38px!important}"+
  "#vRec{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:99999;background:rgba(28,30,28,.93);color:#fff;padding:20px 24px;border-radius:18px;font-size:16px;text-align:center;max-width:82vw;box-shadow:0 12px 40px rgba(0,0,0,.4)}"+
  "#vRec .vd{font-size:34px;margin-bottom:10px;animation:vp 1s infinite ease-in-out}#vRec .vt{max-width:64vw;word-break:break-all;min-height:22px}#vRec .vc{margin-top:10px;font-size:13px;opacity:.82}@keyframes vp{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}"+
  "#vToast{position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:99999;background:rgba(28,30,28,.93);color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;max-width:82vw;text-align:center;opacity:0;transition:opacity .2s}#vToast.show{opacity:1}";
  var st=document.createElement("style");st.id="_vcss2";st.textContent=css;(document.head||document.getElementsByTagName("head")[0]).appendChild(st);
})();
function _vtoast(msg){
  var t=document.getElementById("vToast");
  if(!t){t=document.createElement("div");t.id="vToast";document.body.appendChild(t);}
  t.textContent=msg;t.classList.add("show");
  clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove("show");},2200);
}
var _SR=window.SpeechRecognition||window.webkitSpeechRecognition||null;
function _bindVoice(p){
  var input=p.querySelector("#chatinput"),sendBtn=p.querySelector("#chatsend");
  if(!input||input.__vbound)return;input.__vbound=1;
  var bar=input.parentNode;
  var mic=document.createElement("span");mic.id="vMic";mic.textContent="🎤";mic.title="单击说话，再单击发送，双击取消";
  if(bar&&(" "+bar.className+" ").indexOf("chatinput")>=0)bar.insertBefore(mic,input);else input.parentNode.appendChild(mic);
  var rec=null,ov=null,recording=false,text="",clickTimer=null,dblArmed=false;
  function overlay(){
    var d=document.createElement("div");d.id="vRec";
    d.innerHTML='<div class="vd">🎙️</div><div class="vt">正在聆听…</div><div class="vc">再点一下麦克风发送 · 双击取消</div>';
    document.body.appendChild(d);return d;
  }
  function startRec(){
    if(!_SR){_vtoast("这个浏览器不支持语音输入，请用 Chrome / Safari / 微信打开，或先用键盘输入～");return;}
    recording=true;text="";mic.classList.add("rec");ov=overlay();
    rec=new _SR();rec.lang="zh-CN";rec.interimResults=true;rec.continuous=false;
    rec.onresult=function(e){
      var arr=[];for(var i=0;i<e.results.length;i++)arr.push(e.results[i][0].transcript);
      text=arr.join("").replace(/\s+/g,"");
      if(ov){var vt=ov.querySelector(".vt");if(vt)vt.textContent=text||"正在聆听…";}
    };
    rec.onerror=function(){cancelRec(true);};
    rec.onend=function(){};
    try{rec.start();}catch(e){cancelRec(true);}
  }
  function clearOverlay(){if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);ov=null;mic.classList.remove("rec");}
  function sendRec(){
    var q=(text||"").trim();
    if(rec){try{rec.onresult=null;rec.onerror=null;rec.onend=null;rec.abort();}catch(e){}}
    clearOverlay();recording=false;
    if(q){input.value=q;_ttsStop();if(sendBtn)sendBtn.click();}
    else{_vtoast("没听清，再点一下说一遍～");}
  }
  function cancelRec(silent){
    if(rec){try{rec.onresult=null;rec.onerror=null;rec.onend=null;rec.abort();}catch(e){}}
    clearOverlay();recording=false;text="";
    if(!silent)_vtoast("已取消，未发送");
  }
  /* 单击：未录音→开始；录音中→延迟280ms发送（若期间发生双击则取消发送） */
  function onClick(e){
    e.preventDefault();
    if(!recording){startRec();return;}
    if(dblArmed)return;
    dblArmed=true;
    clickTimer=setTimeout(function(){dblArmed=false;clickTimer=null;sendRec();},280);
  }
  function onDbl(e){
    e.preventDefault();
    if(clickTimer){clearTimeout(clickTimer);clickTimer=null;}
    dblArmed=false;
    if(recording)cancelRec(false);
  }
  mic.addEventListener("click",onClick);
  mic.addEventListener("dblclick",onDbl);
}

function buildFlavor(rawText){
  var milk=cst.milk||0,sugar=cst.sugar||0,acid=(cst.extra&&cst.extra.orange)||0;
  var hasTea=!noTeaRequested(rawText)&&!!_pStock().tags.tea,teaLv=teaStrengthFrom(rawText);
  /* 个人版五味，奶的甘润并入甜；辣/咸在 base 里恒为 0（绝不默认放）*/
  var base={sour:acid>0?acid*1.0:0,sweet:sugar*1.0+milk*0.5,bitter:hasTea?teaLv*0.85:0};
  var keys=["sour","sweet","bitter","spicy","salty"];
  var w=parseTasteIntent(rawText,base,keys);
  return flavorPct(w,keys,["bitter","sour","sweet","spicy","salty"]);
}

var __flavSeq=0;
function flavorPct(w,keys,stack){
  var total=0,present=stack.filter(function(k){return (w[k]||0)>0;});
  present.forEach(function(k){total+=w[k];});
  var seg=[],acc=0;
  if(!total)return {seg:[],keys:keys};
  present.forEach(function(k,i){var p=i===present.length-1?100-acc:Math.round(w[k]/total*100);acc+=p;seg.push({k:k,pct:p});});
  return {seg:seg,keys:keys};
}
function gobletSVG(f){
  var id="gl"+(__flavSeq++);
  var top=30,bottom=112,H=bottom-top;
  var bowl="M36,30 L144,30 C146,66 132,104 112,112 Q90,121 68,112 C48,104 34,66 36,30 Z";
  var bands="",cursor=bottom;
  if(!f.seg.length){
    bands='<rect x="30" y="'+top+'" width="120" height="'+H+'" fill="url(#'+id+'empty)"/>';
  }else{
    f.seg.forEach(function(s,i){
      var col=FLA[s.k].g||FLA[s.k].fill;
      var h=i===f.seg.length-1?cursor-top:s.pct/100*H;
      var yy=cursor-h;
      bands+='<rect x="30" y="'+yy.toFixed(2)+'" width="120" height="'+(h+0.6).toFixed(2)+'" fill="'+col+'"/>';
      if(i>0)bands+='<line x1="30" y1="'+yy.toFixed(2)+'" x2="150" y2="'+yy.toFixed(2)+'" stroke="rgba(0,0,0,.15)" stroke-width="1"/>';
      if(i===f.seg.length-1){
        bands+='<ellipse cx="90" cy="'+yy.toFixed(2)+'" rx="52" ry="6" fill="'+col+'"/><ellipse cx="90" cy="'+(yy-1.2).toFixed(2)+'" rx="42" ry="3.2" fill="#ffffff" opacity=".3"/>';
      }
      cursor=yy;
    });
  }
  return ''+
  '<svg viewBox="0 0 180 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="风味占比高脚杯">'+
    '<defs>'+
      '<linearGradient id="'+id+'empty" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#dfe6ea" stop-opacity=".32"/></linearGradient>'+
      '<linearGradient id="'+id+'glass" x1="0" y1="0" x2="1" y2="0">'+
        '<stop offset="0" stop-color="#8fa6b3" stop-opacity=".55"/><stop offset=".16" stop-color="#ffffff" stop-opacity=".12"/>'+
        '<stop offset=".5" stop-color="#ffffff" stop-opacity=".03"/><stop offset=".84" stop-color="#ffffff" stop-opacity=".13"/>'+
        '<stop offset="1" stop-color="#849caa" stop-opacity=".5"/></linearGradient>'+
      '<radialGradient id="'+id+'base" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset=".7" stop-color="#cdd9df" stop-opacity=".3"/><stop offset="1" stop-color="#9fb2bd" stop-opacity=".45"/></radialGradient>'+
      '<clipPath id="'+id+'clip"><path d="'+bowl+'"/></clipPath>'+
    '</defs>'+
    '<ellipse cx="90" cy="193" rx="44" ry="5.5" fill="#000000" opacity=".10"/>'+
    '<g clip-path="url(#'+id+'clip)">'+bands+'</g>'+
    '<g clip-path="url(#'+id+'clip)"><rect x="30" y="24" width="120" height="92" fill="url(#'+id+'glass)"/>'+
      '<path d="M50,36 C45,64 52,92 68,106" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity=".5"/>'+
      '<path d="M132,40 C136,66 128,94 114,108" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" opacity=".28"/>'+
    '</g>'+
    '<path d="'+bowl+'" fill="none" stroke="rgba(82,100,113,.72)" stroke-width="2.2" stroke-linejoin="round"/>'+
    '<ellipse cx="90" cy="30" rx="54" ry="7.2" fill="none" stroke="rgba(82,100,113,.6)" stroke-width="2.2"/>'+
    '<ellipse cx="90" cy="30" rx="54" ry="7.2" fill="#ffffff" opacity=".08"/>'+
    '<path d="M90,120 L90,172" stroke="url(#'+id+'glass)" stroke-width="6" stroke-linecap="round"/>'+
    '<path d="M87.8,124 L87.8,170" stroke="#ffffff" stroke-width="1.4" opacity=".55"/>'+
    '<ellipse cx="90" cy="121" rx="7.5" ry="3" fill="rgba(150,168,178,.35)"/>'+
    '<ellipse cx="90" cy="180" rx="33" ry="6.2" fill="url(#'+id+'base)" stroke="rgba(82,100,113,.55)" stroke-width="1.6"/>'+
    '<ellipse cx="90" cy="178.5" rx="23" ry="2.5" fill="#ffffff" opacity=".45"/>'+
  '</svg>';
}
function flavorVizHTML(){
  var f=ctx.aiFlavor||FLAVOR_EMPTY;
  var map={};f.seg.forEach(function(s){map[s.k]=s.pct;});
  var lg=f.keys.map(function(k){var on=(map[k]||0)>0;return '<div class="fl-item'+(on?'':' off')+'"><i class="fl-ring" style="border-color:'+FLA[k].ring+';background:'+(on?FLA[k].fill:'#ffffff')+'"></i><span class="fl-name">'+FLA[k].n+'</span><em>'+(map[k]||0)+'%</em></div>';}).join("");
  var flip=BUILD_MODE==="commercial"?" flip":"";
  return '<div class="flavorviz'+flip+'"><div class="fv-head">风 味 占 比</div><div class="fv-body"><div class="fv-glass">'+gobletSVG(f)+'</div><div class="fv-legend">'+lg+'</div></div></div>';
}

function aiPrevHTML(){
  return '为你想好啦，这杯就叫「<b>'+ctx.aiName+'</b>」。<div class="aiprev">'+
    flavorVizHTML()+
    '<div class="ab"><b>'+ctx.aiName+'</b>'+
    (ctx.aiLead?'<span class="alead">'+ctx.aiLead+'</span>':"")+
    '<span class="desc">'+ctx.aiDesc+'</span>'+
    (ctx.aiWhy?'<div class="ablk"><span class="atag">推荐理由</span><p class="atxt">'+ctx.aiWhy+'</p></div>':"")+
    (ctx.aiLayers&&ctx.aiLayers.length?'<div class="ablk"><span class="atag">风味层次</span><ul class="alayers">'+
      ctx.aiLayers.map(function(l){return '<li><i>·</i><span>'+l+'</span></li>';}).join("")+'</ul></div>':"")+
    (ctx.aiBenefit?'<div class="ablk"><span class="atag">产品特点</span><p class="atxt">'+ctx.aiBenefit+'</p></div>':"")+
    '<div class="abtns abtns-3"><button class="breject" id="aiReject">拒 绝</button>'+
    '<button class="bpref" id="aiSavePref">记住我的偏好</button>'+
    '<button class="bstart" id="aiStart">开 始</button></div></div></div>';
}

/* ===== 运行时出图：在 AI 配比页面里，按用户这句话当场生成一张全新的图 =====
   每次提示词不同 → 生成的图不同；统一加风格后缀保证整体调性一致。 */
/* ===== 静态真图库：公开演示不依赖后端/Key，按成分+温度从预置豆包高清图中选 ===== */
var STATIC_IMG={
  milk:["images/milk1.png","images/milk2.png","images/milk3.png","images/milk4.png"],
  milkHot:["images/hotmilk1.png","images/milk3.png"],
  orange:["images/orange1.png","images/orange2.png","images/orange3.png"],
  fruit:["images/fruit1.png","images/fruit2.png","images/fruit3.png"],
  tea:["images/tea1.png","images/tea2.png","images/tea3.png"],
  teaHot:["images/hottea1.png","images/hottea2.png"]
};
/* 每现调一杯就在该类别内公平轮换到下一张：奶/橙/茶配色严格对应，且同类绝不总用同一张，杜绝千篇一律 */
var __pickSeq={};
function staticPick(ing,temp,seed){
  var key=ing.milk?(temp==="hot"?"milkHot":"milk"):ing.orange?"orange":ing.c?"fruit":(temp==="hot"?"teaHot":"tea");
  var arr=STATIC_IMG[key]||STATIC_IMG.tea;
  /* 该类别的轮换计数：每出一杯 +1，逐张轮流；首次用种子定一个随机起点 */
  if(typeof __pickSeq[key]!=="number")__pickSeq[key]=(seed||0)%arr.length;
  var idx=__pickSeq[key]%arr.length;
  __pickSeq[key]=(__pickSeq[key]+1)%arr.length;
  return arr[idx];
}
/* 四套参考图风格（与后端编排服务保持一致），按成分自动选景；提示词刻意精简（900字符内遵循度最高） */
var SCENE_STYLES={
  milk:"creamy milk tea in a tall clear plastic takeaway cup with matte pale-sage-green silicone cup sleeve, creamy ivory milk at the bottom swirling into caramel-amber tea on top, ice cubes, condensation droplets; warm sage-green and cream background, a slender branch of fresh green maple leaves upper left, dry tea leaves flying above the cup, soft golden morning light",
  orange:"fresh orange tea in a tall clear plastic takeaway cup filled with vivid bright-orange gradient juice and clear ice, condensation droplets; glowing warm golden-yellow backdrop with soft bokeh, one whole orange and one sliced orange half suspended in the air around the cup, juice droplets sparkling, soft white mist curling around the cup base, rich warm sunlight",
  fruitLight:"light pale fruit tea in a tall clear plastic cup, translucent pale peach-amber tea with large diamond clear ice cubes, condensation droplets; bright airy pure-white background with crisp diagonal window-blind shadows from morning sun, a thin branch of green leaves upper right, a few dry tea leaves drifting, on the table one curled strip of orange peel as the only prop",
  tea:"pure clear tea in a tall straight clear plastic cup with a single thin transparent straw, crystal-clear golden-amber tea; clean minimal high-key white background, one slim branch of light-green leaves softly blurred behind the cup, a soft leaf shadow on the white tabletop, airy and serene"
};
var HOT_NOTE=", HOT version: no ice cubes, gentle soft white steam rising from the cup opening, cozy warm light";
var STYLE_TAIL=" Ultra realistic premium beverage photography, vertical 3:4, the drink looks irresistibly delicious. Vessel is ONLY a normal clear plastic takeaway cup or plain glass cup, no bottle, no jar, no can, no bowl, no teapot. REALISTIC LIQUID COLOR: the beverage itself must only be amber tea-brown, creamy ivory milk-white, vivid orange, or pale yellow-citrus; the drink is NEVER green, blue, purple, pink, red or any unnatural color (green cup sleeve, leaves and background are fine, but the liquid must not be green). ABSOLUTELY NO TEXT: no characters, letters, numbers, logo, watermark or print, blank cup only. No people, no flower, no butterfly, no mint, no lemon, no bubbles. ZERO written characters.";
function sceneStyleOf(ing,temp){
  var key=ing.milk?"milk":(ing.orange?"orange":(ing.c?"fruitLight":"tea"));
  return SCENE_STYLES[key]+(temp==="hot"?HOT_NOTE:"");
}
/* 中文风味信号 → 英文，只取前2个，避免冲淡关键约束 */
var FLAVOR_EN=[
  [/清爽|清新|清冽|解腻|通透|解渴|清凉|凉/,"clean crisp refreshing taste"],
  [/浓郁|醇厚|丝滑|绵密|奶香|厚乳|顺滑/,"rich silky creamy mouthfeel"],
  [/橙|橘|桔|鲜橙|香橙/,"bright vivid orange aroma"],
  [/茶|乌龙|茉莉|红茶|绿茶|回甘|茶香/,"clear tea fragrance with sweet aftertaste"],
  [/酸|酸甜|维\s*c|vc|c100|水溶|柠檬/,"fresh light fruity acidity"],
  [/甜|甘|蜜|微甜/,"gentle natural sweetness"],
  [/温柔|治愈|放松|舒缓/,"gentle soothing flavor"],
  [/高级|豪华|顶级|精致|优雅|贵|奢/,"refined premium flavor"],
  [/元气|开心|活力|醒神|提神|醒/,"bright energizing flavor"],
  [/热|烫|温/,"warm comforting flavor"]
];
function flavorEnNote(){
  var raw=Array.prototype.slice.call(arguments).filter(Boolean).join(" "),out=[];
  for(var i=0;i<FLAVOR_EN.length;i++){if(FLAVOR_EN[i][0].test(raw)&&out.indexOf(FLAVOR_EN[i][1])<0)out.push(FLAVOR_EN[i][1]);}
  if(!out.length)out.push("fresh balanced flavor");
  return "Express this flavor through color and texture only: "+out.slice(0,2).join(", ")+".";
}

function genImageURL(scenePrompt,seed){
  var p=scenePrompt.replace(/[，。、]/g," ");
  return "https://image.pollinations.ai/prompt/"+encodeURIComponent(p)+
    "?width=768&height=1100&seed="+seed+"&nologo=true&model=turbo";
}
function seedOf(t){var h=0;for(var i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))>>>0;return h%100000;}

/* ===== IMGAI：饮品出图，与文本 AI 同步，走统一编排服务(豆包 Seedream) =====
   未配置后端时用免密钥公共模型兜底（画质有限）；正式部署在 DM_SERVER 指向 Node 编排服务。 */
var IMGAI={
  backend:(localStorage.getItem("dm_img_srv")||"").replace(/\/+$/,""),
  useBackend:function(url){this.backend=(url||"").replace(/\/+$/,"");
    if(this.backend)localStorage.setItem("dm_img_srv",this.backend);
    return "出图后端："+(this.backend||"未配置（公共模型兜底）");},
  configured:function(){return !!this.backend;},
  generate:function(input){
    var self=this, pl=Object.assign({size:"768x1024"},input);
    if(this.backend){
      return fetch(this.backend+"/api/image/generate",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(pl)
      }).then(function(r){return r.json();}).then(function(j){
        if(j&&j.url)return j;throw new Error("bad image resp");
      }).catch(function(){return self._fallback(pl);});
    }
    return Promise.resolve(this._fallback(pl));
  },
  _fallback:function(pl){
    var ing=pl.ingredients||{};
    var p=flavorEnNote(pl.name,pl.desc,pl.mood,pl.temp==="hot"?"热":"冰")+" "+sceneStyleOf(ing,pl.temp)+STYLE_TAIL;
    return {url:genImageURL(p,pl.seed!=null?pl.seed:Math.floor(Math.random()*1e6)),provider:"pollinations",prompt:p};
  }
};

/* ==================================================================
   TEXTAI —— 饮料机的“高情商文本大脑”（真模型，开箱即用）
   覆盖所有需要说话的地方：意图/需求判断、饮品起名、高情商产品介绍、
   闲聊应答、每日推荐文案。
   · 默认直连 Pollinations 文本接口（免密钥、浏览器可跨域，与文生图同源）
   · 生产环境可一键换成你自己的后端中转（密钥不出后端，见 server 示例）
   · 断网 / 超时 / 返回异常 → 自动回退本地规则，原型永远能点
   ================================================================== */
var TEXTAI={
  /* 默认指向自建「文本AI后端」(Kimi K3)。地址优先级：localStorage(dm_text_srv) > 与页面同主机的:8787。
     后端不可达时 understand() 自动回退本地规则，保证原型离线也能点（理解质量以后端为准）。 */
  backend:(function(){
    var saved=(localStorage.getItem("dm_text_srv")||"").replace(/\/+$/,"");
    if(saved)return saved;
    try{
      if(/page\.coze\.site|coze\.site|coze\.cn|pages\./.test(location.hostname))return "";
      if(location.protocol==="http:"||location.protocol==="https:"){
        if(location.port==="8787")return location.origin;
        return location.protocol+"//"+location.hostname+":8787";
      }
    }catch(e){}
    return "http://localhost:8787";
  })(),
  get endpoint(){return this.backend+"/api/text";},
  model:"kimi-k3",
  timeout:15000,
  useSrv:function(url){this.backend=(url||"").replace(/\/+$/,"");
    if(this.backend)localStorage.setItem("dm_text_srv",this.backend);
    return "文本后端："+(this.backend||"未配置");},
  /* 业务背景，注入到每次对话，让 AI 的判断和文案贴合这台机器 */
  MENU_CTX:"这是一台高端AI现调茶饮机。机器里只有4种原料：①东方树叶(可换乌龙/茉莉/红/绿茶底) ②水溶C100柠檬味 ③100%橙汁 ④纯牛奶，外加冰/水。"+
    "没有青柠、柠檬片、薄荷、气泡/苏打/汽水、珍珠、椰果、燕麦奶、椰奶、糖、蜂蜜、咖啡、花朵等任何其它东西；也没有气泡技术，顾客要气泡要致歉并改推一杯不带气泡同样清爽的冰饮。"+
    "可调奶量(无/少/正常/多)、温度(冰/常温/热)。所有形容词都只修饰这杯饮料本身，绝不描写或生成任何人物。招牌约¥14-17，AI定制¥18起。"+
    "支付为顾客扫店主本人微信收款码转账、备注6位订单码，店主在账本导入微信账单核对后出餐；密码指纹都在微信内完成，本机不接触。",
  FORBID:["青柠","柠檬片","薄荷","香草","迷迭香","百里香","气泡","苏打","汽水","珍珠","椰果","燕麦","椰奶",
    "蜂蜜","奶油","奶盖","咖啡","美式","拿铁","玫瑰","樱花","花朵","花瓣","鲜花",
    "女生","女孩","少女","女人","美女","男生","男孩","男人","人物","人像","模特"],
  sanitize:function(s){var t=String(s==null?"":s);for(var i=0;i<this.FORBID.length;i++)t=t.split(this.FORBID[i]).join("");
    return t.replace(/[「」『』"]/g,"").replace(/\s+/g," ").trim();},
  configured:function(){return /^https?:\/\//i.test(this.endpoint);},
  /* 指向自建「文本AI后端(Kimi K3)」：TEXTAI.useSrv("https://域名")，地址存 dm_text_srv */
  useBackend:function(url,model){if(url){this.backend=url.replace(/\/+$/,"");this.endpoint=this.backend+"/api/text";localStorage.setItem("dm_text_srv",this.backend);}if(model)this.model=model;return window.__TEXTAI_STATUS__();},
  /* 自建后端：POST /api/text {text} → 已校验好的成品 JSON（推荐，Kimi K3 在服务端） */
  callSrv:function(userText){
    return new Promise(function(resolve){
      if(!TEXTAI.backend){resolve(null);return;}
      var controller=null,timer=null,done=false;
      function finish(v){if(done)return;done=true;if(timer)clearTimeout(timer);resolve(v);}
      try{
        if(window.AbortController)controller=new AbortController();
        timer=setTimeout(function(){if(controller)try{controller.abort();}catch(e){}finish(null);},TEXTAI.timeout);
        fetch(TEXTAI.backend+"/api/text",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({text:userText}),signal:controller?controller.signal:undefined})
          .then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(j){
            if(j&&typeof j.order==="boolean")finish(j);else finish(null);
          }).catch(function(){finish(null);});
      }catch(e){finish(null);}
    });
  },
  /* 兜底底层：OpenAI 兼容 chat（未配自建后端时用），resolve 纯文本 */
  chat:function(messages){
    return new Promise(function(resolve){
      if(TEXTAI.backend||!TEXTAI.configured()){resolve(null);return;}
      var controller=null,timer=null,done=false;
      function finish(v){if(done)return;done=true;if(timer)clearTimeout(timer);resolve(v);}
      try{
        if(window.AbortController)controller=new AbortController();
        timer=setTimeout(function(){if(controller)try{controller.abort();}catch(e){}finish(null);},TEXTAI.timeout);
        fetch(TEXTAI.endpoint,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({model:TEXTAI.model,messages:messages,temperature:.9}),
          signal:controller?controller.signal:undefined
        }).then(function(r){if(!r.ok)throw 0;return r.json();})
          .then(function(j){
            var txt=j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
            finish(txt?String(txt).trim():null);
          }).catch(function(){finish(null);});
      }catch(e){finish(null);}
    });
  },
  _parseJSON:function(txt){
    if(!txt)return null;
    var m=txt.match(/\{[\s\S]*\}/);
    if(!m)return null;
    try{return JSON.parse(m[0]);}catch(e){return null;}
  },
  /* 统一把成品规整成 {order,name,desc,reply,apology,mods,ai}；任何文案再过一遍禁用词 */
  _shape:function(o,userText){
    var clean=function(s){return TEXTAI.sanitize(s).slice(0,110);};
    var fizzy=/气泡|苏打|汽水|带气|加气|雪碧|可乐/.test(userText);
    var apology=clean(o.apology)||(fizzy?"抱歉，这台机器暂时做不了带气泡的饮品，我给你换一杯不加气泡、但一样清爽冰凉的，可以吗？":"");
    if(o.order===false)return {order:false,name:"",desc:"",reply:clean(o.reply)||"好的，你想喝什么随时告诉我～",apology:"",mods:null,ai:true};
    var mods=this._normMods(o);
    return {order:true,name:clean(o.name).replace(/特调/g,"").slice(0,10),
      desc:clean(o.desc||o.meaning),reply:"",apology:apology,mods:mods,
      temp:/^(cold|normal|hot)$/.test(o.temp)?o.temp:null,ai:true};
  },
  /* 高情商 + 高智商：先问自建 Kimi 后端；不可用再退回免密钥公共模型；都失败返回 null（调用方本地兜底） */
  understand:function(userText){
    var self=this;
    return this.callSrv(userText).then(function(j){
      if(j)return self._shape(j,userText);
      /* —— 公共模型兜底：仍把铁律塞进 system prompt —— */
      var sys="你是这台AI现调茶饮机的对话大脑。"+TEXTAI.MENU_CTX+
        "只要顾客的话里带有任何对饮品的需求、形容、口味、心情、价格或原料倾向，哪怕一两个字，一律 order=true 照做，不反问。"+
        "纯打招呼/道谢、纯辱骂与饮品无关、明确问机器用法/价格表/故障才 order=false。"+
        "只能用东方树叶/水溶C/橙汁/牛奶四种原料，绝不出现青柠、薄荷、气泡、花朵或人物；顾客要气泡要在apology致歉并改推无气泡清爽冰饮。"+
        "解析字段：milk奶量0-3；temp温度cold/normal/hot；tier档位1-3。只输出JSON："+
        "{\"order\":true,\"apology\":\"\",\"reply\":\"\",\"name\":\"4-6字饮品名\",\"desc\":\"30-60字风味情绪介绍\","+
        "\"milk\":null,\"temp\":null,\"tier\":null}";
      return self.chat([{role:"system",content:sys},{role:"user",content:userText}]).then(function(txt){
        var o=self._parseJSON(txt);
        if(!o||typeof o.order!=="boolean")return null;
        return self._shape(o,userText);
      }).catch(function(){return null;});
    });
  },
  _lvl:function(v){var n=parseInt(v,10);return (n===0||n===1||n===2||n===3)?n:null;},
  _normMods:function(o){
    if(!o||typeof o!=="object")return null;
    var m={};
    var milk=this._lvl(o.milk),sugar=this._lvl(o.sugar),tier=this._lvl(o.tier),orange=this._lvl(o.orange);
    if(milk!==null)m.milk=milk;
    if(sugar!==null)m.sugar=sugar;
    if(tier===1||tier===2||tier===3)m.tier=tier;
    if(/^(cold|normal|hot)$/.test(o.temp))m.temp=o.temp;
    if(orange!==null)m.extra={orange:orange}; /* 只有"橙汁/橙"这一种真实加料，且不新增其它 */
    if(typeof o.budget==="number"&&o.budget>0)m.budget=o.budget;
    else{var b=parseFloat(String(o.budget).replace(/[^\d.]/g,""));if(b>0)m.budget=b;}
    return Object.keys(m).length?m:null;
  },
  /* 每日推荐 / 招牌介绍：优先自建后端 /api/daily，其次公共模型；文案过禁用词，失败 null */
  pitch:function(name,en,price,hint){
    var self=this;
    var clean=function(t){return self.sanitize(t).slice(0,110);};
    if(this.backend){
      return new Promise(function(resolve){
        fetch(self.backend+"/api/daily",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({name:name,en:en,hint:hint})})
          .then(function(r){return r.ok?r.json():null;}).then(function(j){
            resolve(j&&j.text?clean(j.text):null);
          }).catch(function(){resolve(null);});
      });
    }
    var sys="你是高端茶饮品牌的资深产品文案。"+TEXTAI.MENU_CTX+
      "请写一句高情商、有画面感、能激发购买欲的推荐，第二人称，40-70字，突出口感层次与适合的心情/场景，不要价格、不要标题，只输出一句话正文，且不出现人物与4种之外的原料。";
    var user="饮品名："+name+(en?"（"+en+"）":"")+"，参考风味："+(hint||"招牌现调")+"，售价¥"+price+"。";
    return this.chat([{role:"system",content:sys},{role:"user",content:user}])
      .then(function(txt){return txt?clean(txt.replace(/^["“]|["”]$/g,"")):null;})
      .catch(function(){return null;});
  }
};
window.__TEXTAI_STATUS__=function(){return "文本AI："+TEXTAI.model+" @ "+TEXTAI.endpoint+"（默认免密钥直连，可用 TEXTAI.useBackend 切换自建中转；异常自动本地兜底）";};

/* ==================================================================
   DRINKAI —— 小程序唯一的后台链路：统一「饮料机AI编排服务」
   小程序只说一句话 → 服务内部一条龙：文本大脑(Kimi K3/可切豆包)起名写文案
   → 据配方推导4种真实原料 → 豆包 Seedream 出图 → 一次返回全套(含图片URL)。
   地址优先级：localStorage(dm_drink_srv，兼容旧 dm_text_srv) > 同主机 :8790。
   服务不可达 / 超时 → resolve(null)，调用方自动退回本地规则，原型离线也能点。
   ================================================================== */
/* ===== 历史记录：localStorage 存所有调配过的饮品，支持记录页一键再来 & 对话里召回 ===== */
var HISTORY={
  KEY:"dm_history_v1",MAX:60,
  all:function(){try{return JSON.parse(localStorage.getItem(this.KEY)||"[]");}catch(e){return [];}},
  save:function(r){
    var list=this.all();
    r.id=r.id||("h"+Date.now()+"_"+Math.floor(Math.random()*999));
    r.ts=Date.now();
    list.unshift(r);
    if(list.length>this.MAX)list=list.slice(0,this.MAX);
    try{localStorage.setItem(this.KEY,JSON.stringify(list));}catch(e){}
    if(typeof refreshRecBadge==="function")refreshRecBadge();
    return r;
  },
  count:function(){return this.all().length;},
  get:function(id){return this.all().filter(function(x){return x.id===id;})[0]||null;},
  remove:function(id){
    var list=this.all().filter(function(x){return x.id!==id;});
    localStorage.setItem(this.KEY,JSON.stringify(list));
    if(typeof refreshRecBadge==="function")refreshRecBadge();
  },
  /* 相似度：名字（含错别字容忍）+ 成分描述（奶茶/橙/清茶/维C） */
  _nameHit:function(rec,q){
    var n=(rec.name||"").replace(/[「」『』\s·]/g,""),qq=q.replace(/[「」『』\s，。、！？？!?,，.的了吗呢啊我要想来杯一杯那个这个]/g,"");
    if(!qq)return 0;
    if(n.indexOf(qq)>=0||qq.indexOf(n)>=0)return 1;
    /* 逐字命中率，容忍一两个错别字（如 清欢粒→清欢里） */
    var hit=0;for(var i=0;i<qq.length;i++)if(n.indexOf(qq[i])>=0)hit++;
    var rate=hit/Math.max(qq.length,n.length);
    return rate>=0.5?rate:0;
  },
  _ingHit:function(rec,q){
    var ing=rec.ingredients||{},score=0,need=0;
    var tests=[
      [/奶|拿铁|牛乳/,!!ing.milk],
      [/橙|橘|果汁/,!!ing.orange],
      [/维\s*c|c100|水溶|果味|酸/,!!ing.c],
      [/清茶|绿茶|乌龙|茉莉|红茶|纯茶/,ing.tea&&!ing.milk&&!ing.orange&&!ing.c]
    ];
    for(var i=0;i<tests.length;i++){
      if(tests[i][0].test(q)){need++;if(tests[i][1])score++;}
    }
    return need?score/need:0;
  },
  /* 在用户一句话里找历史：返回 {rec, candidates:[...], kind} */
  detect:function(q){
    var t=(q||"").toLowerCase(),list=this.all();
    if(!list.length)return null;
    /* 时间指代：直接取最近 */
    if(/上次|上回|前次|刚才|之前|最近|昨天|今天|那杯|那个|再来一?杯|还喝|照旧|老样子|一样的/.test(t)){
      /* "上次+名字" 先按名字筛 */
      var byName=this.matchByName(t.replace(/上次|上回|前次|刚才|之前|最近|昨天|今天|那杯|那个|再来一?杯|还喝|照旧|老样子|一样的|的|喝/g," ").trim());
      var pool=byName.length?byName:list;
      return {rec:pool[0],candidates:[],kind:"recent"};
    }
    /* 点名：精确/模糊名字（但"奶茶/橙汁/清茶"这类通用口味词不算点名，走成分匹配） */
    var bare=t.split("").filter(function(ch){
      return "，。、！？？!?,，.「」『』 　的了吗呢啊我要想来杯一个那这给做调喝点甜冰热浓清淡好最上次回前才之近昨天再来还照旧老样子".indexOf(ch)<0;
    }).join("");
    var isGeneric=/^(奶茶|牛奶|奶|清茶|红茶|绿茶|乌龙茶|茉莉|橙汁|橙子|果茶|果汁|水果茶|维C|维c|c100|气泡水|可乐|茶|饮品|饮料|好喝的|招牌|最贵|便宜)$/;
    var mn=isGeneric.test(bare)?[]:this.matchByName(t);
    if(mn.length){
      if(mn.length===1)return {rec:mn[0],candidates:[],kind:"name"};
      return {rec:mn[0],candidates:mn.slice(0,3),kind:"guess"};
    }
    /* 成分描述 */
    var scored=list.map(function(rec){return {rec:rec,s:HISTORY._ingHit(rec,t)};}).filter(function(x){return x.s>=0.66;}).sort(function(a,b){return b.s-a.s;});
    if(scored.length===1)return {rec:scored[0].rec,candidates:[],kind:"ingredient"};
    if(scored.length>1){
      var top=scored[0].s,ties=scored.filter(function(x){return x.s===top;}).map(function(x){return x.rec;});
      return {rec:ties[0],candidates:ties.slice(0,3),kind:"guess"};
    }
    return null;
  },
  matchByName:function(t){
    var self=this;
    return self.all().map(function(rec){return {rec:rec,s:self._nameHit(rec,t)};})
      .filter(function(x){return x.s>0;}).sort(function(a,b){return b.s-a.s;}).map(function(x){return x.rec;});
  }
};
function refreshRecBadge(){
  var n=document.getElementById("navRecN");
  if(n)n.textContent=HISTORY.count()>99?"99+":HISTORY.count();
}

/* ==================================================================
   个人版 —— 独立 localStorage key，与商用账本互不干扰
   ================================================================== */
var PERSONAL={
  histKey:"dm_personal_hist_v1",
  prefKey:"dm_personal_pref_v1",
  /* 个人版调配历史 */
  hist:function(){try{return JSON.parse(localStorage.getItem(this.histKey)||"[]");}catch(e){return [];}},
  saveHist:function(r){
    var list=this.hist();
    r.id=r.id||("ph"+Date.now()+"_"+Math.floor(Math.random()*999));
    r.ts=Date.now();
    list.unshift(r);
    if(list.length>40)list=list.slice(0,40);
    try{localStorage.setItem(this.histKey,JSON.stringify(list));}catch(e){}
    return r;
  },
  /* 偏好累积合并 */
  getPref:function(){try{return JSON.parse(localStorage.getItem(this.prefKey)||"null");}catch(e){return null;}},
  savePref:function(m){
    var cur=this.getPref()||{milk:[],sugar:[],temp:[],orange:[],n:0};
    if(typeof m.milk==="number"){cur.milk.push(m.milk);}
    if(typeof m.sugar==="number"){cur.sugar.push(m.sugar);}
    if(m.temp){cur.temp.push(m.temp);}
    if(typeof m.orange==="number"){cur.orange.push(m.orange);}
    cur.n=(cur.n||0)+1;
    try{localStorage.setItem(this.prefKey,JSON.stringify(cur));}catch(e){}
  },
  avg:function(arr){if(!arr||!arr.length)return null;var s=0;for(var i=0;i<arr.length;i++)s+=arr[i];return Math.round(s/arr.length*10)/10;},
  mode:function(arr){if(!arr||!arr.length)return null;var c={},max=0,mv=arr[0];
    for(var i=0;i<arr.length;i++){c[arr[i]]=(c[arr[i]]||0)+1;if(c[arr[i]]>max){max=c[arr[i]];mv=arr[i];}}return mv;},
  /* 按累积偏好算出一套推荐配方 */
  calcRec:function(){
    var p=this.getPref();if(!p||!p.n)return null;
    var r={};
    var milkAvg=this.avg(p.milk);if(milkAvg!==null)r.milk=Math.round(milkAvg);
    var sugarAvg=this.avg(p.sugar);if(sugarAvg!==null)r.sugar=Math.round(sugarAvg);
    var tempM=this.mode(p.temp);if(tempM)r.temp=tempM;
    var orangeAvg=this.avg(p.orange);if(orangeAvg!==null)r.orange=Math.round(orangeAvg);
    return r;
  },
  clearPref:function(){try{localStorage.removeItem(this.prefKey);}catch(e){}}
};
/* 全局标记：当前是否在个人版流程中 */
var isPersonalMode=false;
/* 构建模式：combined=含版本选择的合并版；commercial=商用独立站；personal=个人独立站 */
var BUILD_MODE="personal";
if(BUILD_MODE==="personal")isPersonalMode=true;

var DRINKAI={
  backend:(function(){
    var saved=(localStorage.getItem("dm_drink_srv")||localStorage.getItem("dm_text_srv")||"").replace(/\/+$/,"");
    if(saved)return saved;
    try{
      /* 静态托管域名（page.coze.site 等）没有同机后端，直接本地引擎，零等待 */
      if(/page\.coze\.site|coze\.site|coze\.cn|pages\./.test(location.hostname))return "";
      if(location.protocol==="http:"||location.protocol==="https:"){
        if(location.port==="8790")return location.origin;
        return location.protocol+"//"+location.hostname+":8790";
      }
    }catch(e){}
    return "http://localhost:8790";
  })(),
  timeout:30000,   /* 端到端含出图，给足时间（用户显式配置后端时） */
  get endpoint(){return this.backend+"/api/drink";},
  useSrv:function(url){this.backend=(url||"").replace(/\/+$/,"");
    if(this.backend)localStorage.setItem("dm_drink_srv",this.backend);
    return "编排服务："+(this.backend||"未配置");},
  /* 一句话 → 全套成品；失败 resolve(null) */
  order:function(userText){
    return new Promise(function(resolve){
      if(!DRINKAI.backend){resolve(null);return;}
      var controller=null,timer=null,done=false;
      function finish(v){if(done)return;done=true;if(timer)clearTimeout(timer);resolve(v);}
      try{
        if(window.AbortController)controller=new AbortController();
        timer=setTimeout(function(){if(controller)try{controller.abort();}catch(e){}finish(null);},DRINKAI.timeout);
        fetch(DRINKAI.endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({text:userText}),signal:controller?controller.signal:undefined})
          .then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(j){
            if(j&&typeof j.order==="boolean")finish(j);else finish(null);
          }).catch(function(){finish(null);});
      }catch(e){finish(null);}
    });
  },
  /* 把服务返回规整成前端直接可用的对象；文案再过一遍禁用词，绝不把脏字带上屏 */
  shape:function(d,userText){
    var clean=function(s){return TEXTAI.sanitize(s).slice(0,110);};
    if(d.order===false){
      return {order:false,reply:clean(d.reply)||"好的，你想喝什么随时告诉我～",ai:true};
    }
    var ing=d.ingredients||{};
    var mods={};
    /* 以服务据配方推导出的真实原料为准：奶量 / 橙汁只放真实存在的两种 */
    if(ing.milk===false)mods.milk=0;
    if(ing.orange===false)mods.orange=0; else if(ing.orange===true)mods.orange=2;
    var temp=/^(cold|normal|hot)$/.test(d.temp)?d.temp:null;
    if(temp)mods.temp=temp;
    /* 诗意长文案：优先 meaning/why，拼出一句有质感的介绍（屏幕只放得下精简版） */
    var desc=clean(d.desc||d.meaning)||"";
    return {
      order:true,
      name:clean(d.name).replace(/特调/g,"").slice(0,10),
      desc:desc,
      lead:clean(d.lead),meaning:clean(d.meaning),why:clean(d.why),
      layers:Array.isArray(d.layers)?d.layers.map(clean):[],benefit:clean(d.benefit),
      price:(typeof d.price==="number"&&d.price>0)?d.price:null,
      recipe:Array.isArray(d.recipe)?d.recipe:[],
      temp:temp,
      apology:clean(d.apology),
      ingredients:ing,
      image:(d.image&&d.image.url)?d.image:null,
      mods:Object.keys(mods).length?mods:null,
      textEngine:d.textEngine||"",textProvider:d.textProvider||"",degraded:!!(d.image&&d.image.degraded),
      ai:true
    };
  }
};
window.__DRINKAI_STATUS__=function(){return "编排服务 @ "+DRINKAI.endpoint+"（一句话→特调+豆包出图一条龙；异常自动本地兜底）";};

/* ===== 意图判断（本地兜底）：默认就按顾客说的生成，只拦纯打招呼/道谢/故障/问价表 =====
   设计原则：不挑顾客措辞，只要带一点对饮品的需求/形容/心情/价格/原料倾向就出单。 */
function detectIntent(t){
  /* 仅这些“纯社交 / 纯系统”场景才不出单 */
  if(/^(你好|您好|嗨|哈喽|hello|hi|在吗|在不在|喂)[\s!！.。~]*$/i.test(t))return {order:false,reply:chatReply(t)};
  if(/^(谢谢|谢啦|感谢|多谢|thanks|thank you)[\s!！.。~]*$/i.test(t))return {order:false,reply:chatReply(t)};
  if(/^(哈哈+|呵呵+|233+|666+)[\s!！.。~]*$/.test(t))return {order:false,reply:chatReply(t)};
  if(/坏了|故障|不能用|不出饮料|不出杯|卡住了|维修/.test(t))return {order:false,reply:chatReply(t)};
  /* 纯辱骂/抬杠，且全句没有任何对饮品的需求或形容 → 高情商化解，不出单 */
  var insult=/傻|蠢|笨|有病|神经病|智障|白痴|垃圾|废物|滚|脑残|有病吧|脑子/.test(t);
  var anyDrinkCue=/喝|奶茶|咖啡|茶|奶|糖|冰|热|气泡|甜|清爽|浓郁|解渴|提神|口味|口感|来|要|给|整|搞|安排|推荐|渴|杯|贵|便宜|好喝|心情|困|累|丧|烦/.test(t);
  if(insult && !anyDrinkCue)return {order:false,reply:chatReply(t)};
  /* 明确询问“价格表/多少钱”，且全程没有任何对饮品的形容或点单意思，才只报价 */
  if(/多少钱|价格表|怎么收费|价位表|菜单价/.test(t) && !/要|来|给我|整|搞|安排|推荐|最贵|最好|便宜|好喝|口感|口味|心情|奶|茶|咖啡|甜|冰|热|气泡/.test(t))
    return {order:false,reply:chatReply(t)};
  /* 其余一律按点单处理：哪怕只有“最贵的不要奶”“随便”“整点好喝的” */
  return {order:true};
}
/* 本地解析顾客的具体需求（断网兜底用）；返回与模型 mods 同构的对象 */
function parseMods(t){
  var m={};
  var tl=t.toLowerCase();
  /* 档位：最贵 / 顶级 → 3；便宜 / 划算 → 1 */
  if(/最贵|顶级|最好|豪华|顶配|高端|不差钱|来个贵|要好的|贵一点/.test(t))m.tier=3;
  else if(/最便宜|便宜点|便宜的|划算|实惠|平价|省钱/.test(t))m.tier=1;
  /* ——— 否定优先（先判"不要"，再判"要"） ——— */
  var noMilk=/不要奶|不加奶|去奶|无奶|别放奶|不放奶|不要加奶|没奶|不喝奶/.test(t);
  var noFruit=/不要果汁|不带果汁|不加果|无果汁|别放果|不要水果|不含果|不要橙|不加橙|别放橙|不要.*橙汁|不喝果汁|别.*果汁|不要果味|不带果味|不酸|别酸/.test(t);
  var noTea=/不要茶|不加茶|无茶|别放茶|不喝茶/.test(t);
  var noIce=/去冰|不要冰|无冰|不加冰|别放冰/.test(t);
  /* 奶量 */
  if(noMilk)m.milk=0;
  else if(/多奶|奶多|加多点奶|双倍奶|厚乳/.test(t))m.milk=3;
  else if(/少奶|奶少|少放点奶|少量奶/.test(t))m.milk=1;
  /* 糖 */
  if(/无糖|不要糖|不加糖|去糖|零卡|不要甜|不加甜/.test(t))m.sugar=0;
  else if(/少糖|低糖|微糖|三分|不.*甜|别太甜|少甜/.test(t))m.sugar=1;
  else if(/多糖|甜一点|多加糖|全糖/.test(t))m.sugar=3;
  /* 温度 */
  if(noIce)m.temp="normal";
  else if(/热饮|热的|要热|来杯热|加热|烫|暖/.test(t))m.temp="hot";
  else if(/常温|不冰/.test(t))m.temp="normal";
  else if(/冰|冷|凉|冰镇|冰爽/.test(t))m.temp="cold";
  /* 橙汁/果汁：否定 → orange=0 */
  if(noFruit)m.orange=0;
  else if(/多.*橙|橙.*多|加橙/.test(t))m.orange=3;
  /* 茶量暗示（通过 tier 影响浓度） */
  if(/少量茶|茶少|少放茶|淡一点|淡茶/.test(t)){if(!m.tier)m.tier=1;}
  if(/多茶|茶多|浓茶|茶浓|多加茶|浓一点/.test(t)){if(!m.tier)m.tier=3;}
  /* 意图推断（影响配方倾向） */
  if(/提神|困|犯困|熬夜|醒神|精神/.test(t)){
    if(!m.temp)m.temp="hot";
    if(!m.tier)m.tier=3; /* 浓茶底 */
  }
  if(/清爽|解腻|解渴|通透|清新/.test(t)){
    if(!noFruit&&m.orange==null)m.orange=2; /* 来点橙/维C */
    if(noMilk||m.milk===null)m.milk=0; /* 少奶或无奶 */
  }
  if(/浓郁|丝滑|奶香|醇厚|顺滑/.test(t)){
    if(!noMilk&&m.milk==null)m.milk=3;
  }
  if(/橙香|酸|维\s*c|vc|水溶/.test(t)){
    if(!noFruit&&m.orange==null)m.orange=2;
  }
  /* 具体预算 */
  var b=parseBudget(t);if(b!=null)m.budget=b;
  return Object.keys(m).length?m:null;
}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function chatReply(t){
  if(/为什么.*慢|怎么.*慢|太慢|等好久|还没好|多久/.test(t))
    return pick([
      "抱歉让你久等啦～现配现做一般一两分钟就好，要不要先说说想喝什么口味？",
      "马上就好，别着急。你也可以先告诉我口味，我这就给你排上。"]);
  if(/多少钱|价格|收费|贵不贵/.test(t))
    return pick([
      "招牌四款 ¥14～17，AI 定制 ¥18 起，加价项下单前都会写清楚。想先来哪杯？",
      "价格很透明：¥14 起，加料另算、明码标价。报个口味或预算，我帮你配。"]);
  if(/你是谁|你会|你能|怎么用|怎么点|可以吗|行不行/.test(t))
    return "我是你的专属饮品师，你说口味甚至说心情，我都能为你现调一杯。比如“心情不好，想喝点甜的”。";
  if(/谢谢|谢啦|感谢/.test(t))return pick(["不客气～想喝随时叫我。","应该的，记得渴了就来找我。"]);
  if(/你好|在吗|嗨|哈喽|喂/.test(t))return pick(["嗨～在的，今天想喝点什么？","你好呀，说说现在的心情或口味吧。"]);
  if(/坏了|故障|不出|不能用/.test(t))return "我帮你看看～也可以联系现场工作人员。要不要先说一遍想喝的口味？";
  if(/哈哈|有意思|好玩/.test(t))return pick(["嘿嘿～要不要认真来一杯？报口味就行。","笑完记得喝水哦，想喝什么告诉我。"]);
  if(/傻|蠢|笨|有病|神经病|智障|白痴|垃圾|废物|滚|脑残|脑子/.test(t))
    return pick([
      "哎呀，是我没服务好～别气别气，你想喝什么我马上用心做一杯赔罪。",
      "我的错我的错🙏 给我个补救机会吧，说个口味，我这就给你调好。"]);
  return pick([
    "在的，你想喝点什么都行——口味、心情、预算，甚至只说‘随便来杯好喝的’，我马上给你配一杯。",
    "怎么说我都能接住～给我个方向就行，清爽的、浓郁的、贵的便宜的、要奶不要奶，都可以。"]);
}

/* 从用户这句话里解析预算：如“要99的”“不低于50”“一百块” */
function parseBudget(t){
  var cn={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
  var m=t.match(/(\d+(?:\.\d+)?)\s*(?:块|元|rmb|￥|¥)/i);
  var val=null;
  if(m)val=parseFloat(m[1]);
  else{
    var mm=t.match(/([一二两三四五六七八九十百零]+)\s*[块元]/);
    if(mm){var s=mm[1],num=0,sec=0;
      for(var i=0;i<s.length;i++){var ch=s[i];
        if(ch==="百"){sec+=(num||1)*100;num=0;}
        else if(ch==="十"){sec+=(num||1)*10;num=0;}
        else if(ch==="零"){}
        else num=cn[ch]||0;}
      val=sec+num;}
  }
  if(val!=null && val>=1)return val;
  /* “不低于99 / 至少99 / 99以上” */
  return null;
}

/* 根据用户这句话：识别口味或情绪 → 生成专属画面描述 + 当场出图
   铁律：画面里只能有这杯饮料，原料只有 东方树叶/水溶C/橙汁/牛奶 + 冰/水；
   绝不出现人物、青柠、薄荷、香草、花朵、咖啡豆、珍珠，也不画气泡（机器没有气泡技术）。 */
function classify(t){
  var seed=seedOf(t+Date.now()%100000);
  function img(extra,sceneKey,ing){ing=ing||{};sceneKey=sceneKey||"fruitLight";
    return genImageURL("Express this flavor through color and texture only: "+extra+". "+(SCENE_STYLES[sceneKey]||SCENE_STYLES.fruitLight)+STYLE_TAIL,seed);}
  /* —— 情绪 / 场景 —— */
  if(/心情不好|难过|不开心|郁闷|丧|想哭|emo|烦|焦虑|安慰|治愈|犒劳|奖励自己|开心一下|幸福|甜蜜/.test(t))
    return {type:"moodWarm",temp:"cold",
      img:img("a comforting soothing drink, warm peachy orange tea blended with silky milk, soft creamy caramel swirl, "+
        "clear ice, gentle warm pastel peach and beige tones, tender healing mood","milk"),
      desc:"给你一杯温柔的安慰：暖橙茶汤兑入丝滑牛奶，入口绵密甘甜，像被轻轻拍了拍，心情会慢慢好起来。"};
  if(/开心|高兴|庆祝|约会|聚会|好心情/.test(t))
    return {type:"moodHappy",temp:"cold",
      img:img("a joyful bright drink, golden orange tea layered with fresh orange juice, clear ice cubes, "+
        "a curled orange peel twist on the rim, cheerful warm sunlight, airy festive warm tones","orange"),
      desc:"为好心情干杯：橙香明亮、茶汤清爽，冰爽又不腻口，把开心的味道再放大一点。"};
  if(/累|疲惫|放松|压力大|摸鱼/.test(t))
    return {type:"moodRelax",temp:"hot",
      img:img("a calming relaxing hot milk tea, soft warm caramel and milky tones, gentle white steam rising, cozy warm beige, restful and quiet","milk"),
      desc:"辛苦了，这杯帮你松一松：温润奶茶不抢味，热气慢慢腾起，喝一口让肩膀和心情都放下来。"};
  if(/困|犯困|熬夜|加班|提神|醒神/.test(t))
    return {type:"hot",temp:"hot",
      img:img("a warm hot amber Chinese tea, deep golden reddish-brown clear tea, visible rising white steam, "+
        "a curled orange peel twist on the rim, cozy and gently energizing","tea"),
      desc:"熬夜犯困就靠它：热茶汤醇厚回甘，热气唤醒精神，又不刺激，陪你把状态拉回来。"};
  /* —— 口味 —— */
  if(/热|暖/.test(t))
    return {type:"hot",temp:"hot",
      img:img("a warm hot amber Chinese tea, deep golden clear tea, gentle white steam curling above the cup, a curled orange peel twist, cozy","tea"),
      desc:"热饮温润回甘，杯口热气缓缓升起，适合需要被唤醒或取暖的时候。"};
  /* 想要气泡：机器做不了，文案由文本AI致歉，这里给一杯同样清爽、不带气泡的冰橙茶 */
  if(/气泡|苏打|汽水|清爽|柠|青柠|薄荷|冰爽|解腻/.test(t))
    return {type:"clear",temp:"cold",
      img:img("a refreshing still iced drink, crystal-clear pale golden blend of Chinese tea and fresh orange juice, "+
        "clear ice cubes, a curled orange peel twist, bright crisp and clean, no fizz, cold and thirst-quenching","fruitLight"),
      desc:"清透冰爽的橙香茶饮，冰凉通透、解腻解渴，虽然没有气泡，一样一口回神、元气满满。"};
  if(/不.*甜|无糖|少糖|清淡|不甜|简单|干净/.test(t))
    return {type:"light",temp:"cold",
      img:img("a very light clear pale golden Chinese tea, crystal clear, restrained, only a few ice cubes, "+
        "a curled orange peel twist, minimal and calm, lots of negative space","tea"),
      desc:""};
  if(/奶|拿铁|醇厚|丝滑|浓郁|奶香/.test(t))
    return {type:"milk",temp:"cold",
      img:img("a rich creamy milk tea, milky white and light caramel swirls in clear amber tea, silky milk texture, clear ice, indulgent","milk"),
      desc:""};
  return {type:"default",temp:"cold",
    img:img("a custom layered orange tea, amber golden gradient from clear tea to bright orange, clear ice, balanced and elegant","fruitLight"),
    desc:""};
}

function recSub(r){
  var ing=r.ingredients||{},parts=[];
  if(ing.milk)parts.push("奶茶");
  if(ing.orange)parts.push("橙汁");
  if(ing.c)parts.push("维C果茶");
  if(!parts.length)parts.push("清茶");
  parts.push(r.temp==="hot"?"热饮":(r.temp==="normal"?"常温":"冰饮"));
  if(r.ice&&r.ice!=="正常冰"&&r.ice!=="热饮无冰")parts.push(r.ice);
  if(r.sugar&&r.sugar!=="标准糖")parts.push(r.sugar);
  return parts.join(" · ");
}
function recTime(ts){
  var d=new Date(ts),now=new Date(),pad=function(n){return n<10?"0"+n:""+n;};
  var sameDay=d.toDateString()===now.toDateString();
  var yest=new Date(now);yest.setDate(now.getDate()-1);
  var isYest=d.toDateString()===yest.toDateString();
  var hm=pad(d.getHours())+":"+pad(d.getMinutes());
  if(sameDay)return "今天 "+hm;
  if(isYest)return "昨天 "+hm;
  return (d.getMonth()+1)+"月"+d.getDate()+"日 "+hm;
}
T.history=function(){
  var list=HISTORY.all();
  if(!list.length){
    return '<div class="reclist"><div class="recempty"><span class="big">🍵</span>'+
      '还没有调配记录<br>去「AI 配比」说句话，调出第一杯属于你的饮品吧</div></div>';
  }
  return '<div class="reclist">'+list.map(function(r){
    var img=r.image||"";
    return '<div class="reccard" data-hid="'+r.id+'">'+
      (img?'<img class="rcimg" src="'+img+'" onerror="this.style.visibility=\'hidden\'">':'<div class="rcimg"></div>')+
      '<div class="rcinfo"><div class="rcname">'+esc(r.name)+'</div>'+
      '<div class="rcsub">'+esc(recSub(r))+'</div>'+
      '<div class="rcdate">'+recTime(r.ts)+'</div></div>'+
      '<div class="rcprice">¥'+r.price+'</div><div style="font-size:18px;color:#9aa096">›</div></div>';
  }).join("")+'</div>';
};

T.select=function(){
  var sorted=DRINKS.slice().sort(function(a,b){return a.ord-b.ord;});
  return '<div class="ghead"><div class="pt">四 款 招 牌</div><div class="pe">点击任意一款进入调配</div></div>'+
    '<div class="grid2">'+sorted.map(function(d){
      return '<div class="gitem" data-drink="'+d.id+'"><div class="gimg"><img src="'+imgOf(d)+'"></div>'+
        '<div class="gname">'+d.name+'</div><div class="gprice">¥'+d.price+'</div></div>';
    }).join('')+'</div>';
};

/* ===== 选择版本落地页 ===== */
T.landing=function(){
  return '<div class="landing">'+
    '<div class="landing-title">'+
      '<div class="kicker">A I · T E A</div>'+
      '<div class="brand-hand">星耀洋芋</div>'+
      '<h1>渴了吗</h1>'+
      '<div class="sub">选 择 你 的 体 验</div><div class="rule"></div></div>'+
    '<div class="landing-cards">'+
      '<div class="lcard lcard-personal" id="goPersonal">'+
        '<div class="lcard-title">专属调配</div>'+
        '<div class="lcard-desc">AI 为你私人定制，记住你的偏好，无需付款</div>'+
        '<div class="lcard-go">进入个人版 →</div></div>'+
      '<div class="lcard lcard-commercial" id="goCommercial">'+
        '<div class="lcard-title">商用版</div>'+
        '<div class="lcard-desc">每日推荐 · 饮品选择 · 微信付款给店主</div>'+
        '<div class="lcard-go">进入商用版 →</div></div>'+
    '</div></div>';
};

/* ===== 个人版 AI 聊天 ===== */
/* 左栏品牌语每次随机，避免每次都一样 */
var PSIDE_QUOTES=[
  "把此刻的心情，<em>调成一杯</em>。",
  "特别的你，值得<em>单独调配</em>。",
  "没有第二杯一样，<em>这杯只属于你</em>。",
  "说一句话，<em>剩下的交给我</em>。",
  "你的口味，<em>值得被认真对待</em>。"
];
T.personalHome=function(){
  var n=INGDB.list().length;
  return '<div class="phome"><div class="phome-bg"></div><div class="phome-mask"></div>'+
    '<div class="phome-in">'+
      '<div class="phome-head"><div class="pk">F O R · Y O U · O N L Y</div>'+
      '<h1>专属调配</h1><div class="ps">今 天 想 从 哪 里 开 始</div><div class="pr"></div></div>'+
      '<div class="pcard pcard-mix" id="goMix"><span class="pc-no">01</span>'+
        '<div class="pc-t">配　比</div>'+
        '<div class="pc-d">说一句话，告诉我你此刻想喝的感觉，我按你的口味现场调出这一杯。</div>'+
        '<div class="pc-go">进 入 配 比 →</div></div>'+
      '<div class="pcard pcard-db" id="goDb"><span class="pc-no">02</span>'+
        '<div class="pc-t">数据库修改<span class="dbcount">（现有 '+n+' / 4 种原料）</span></div>'+
        '<div class="pc-d">直接说话就能管理家里的原料：加什么、删什么、换什么，我听得懂，帮你安排进 4 个位置。</div>'+
        '<div class="pc-go">管 理 原 料 →</div></div>'+
    '</div></div>';
};
T.personalAi=function(){
  var q=PSIDE_QUOTES[Math.floor(Math.random()*PSIDE_QUOTES.length)];
  return '<div class="personal-wrap chat-layout">'+
    '<div class="personal-bg"></div><div class="personal-overlay"></div>'+
    '<aside class="personal-side">'+
      '<div class="pside-bg"></div><div class="pside-mask"></div>'+
      '<div class="pside-top"><div class="pside-brand">专属调配<small>FOR&nbsp;YOU&nbsp;ONLY</small></div></div>'+
      '<div class="pside-mid"><div class="pside-quote">你的口味，<em>值得被认真对待</em>。</div></div>'+
      '<div class="pside-bot">'+
        (BUILD_MODE==="combined"?'<button id="sideVer">版本</button>':'<button id="sideHome">菜 单</button>')+
        '<button class="primary" id="sideRec">记录 <span id="sideRecN">'+PERSONAL.hist().length+'</span></button>'+
      '</div>'+
    '</aside>'+
    '<div class="personal-content">'+
      '<div class="chatwrap" style="background:transparent">'+
        '<div class="chatlist" id="chatlist"></div>'+
        '<div class="chatinput">'+
          '<input id="chatinput" placeholder="用你自己的话，告诉我此刻想喝什么…"><button id="chatsend">➤</button></div></div>'+
    '</div></div>';
};

/* ===== 个人版·数据库修改（聊天式，不展示原始四格数据） ===== */
T.personalDb=function(){
  return '<div class="personal-wrap chat-layout db-chat">'+
    '<div class="personal-bg"></div><div class="personal-overlay"></div>'+
    '<aside class="personal-side">'+
      '<div class="pside-bg"></div><div class="pside-mask"></div>'+
      '<div class="pside-top"><div class="pside-brand">原料库<small>MY&nbsp;INGREDIENTS</small></div></div>'+
      '<div class="pside-mid"><div class="pside-quote">四个位置，<em>说一声我就帮你安排</em>。</div></div>'+
      '<div class="pside-bot">'+
        (BUILD_MODE==="combined"?'<button id="sideVer">版本</button>':'<button id="sideHome">菜 单</button>')+
        '<button id="sideGrid">四格表</button>'+
      '</div>'+
    '</aside>'+
    '<div class="personal-content">'+
      '<div class="chatwrap" style="background:transparent">'+
        '<div class="chatlist" id="chatlist"></div>'+
        '<div class="chatinput">'+
          '<input id="chatinput" placeholder="说：加牛奶 / 把橙汁换成水溶C / 删掉红茶"><button id="chatsend">➤</button></div></div>'+
    '<div class="grid-mask" id="gridMask"><div class="grid-card">'+
      '<div class="grid-top"><h3>四格存储表</h3><button class="grid-close" id="gridClose">×</button></div>'+
      '<div class="grid-status"><span>坐标固定不可改，右侧点一下就能填 / 改，和对话实时同步</span><span class="grid-saved" id="gridSaved">已保存</span></div>'+
      '<table class="grid-table"><thead><tr><th>格子坐标</th><th>存储内容（当前配料）</th></tr></thead><tbody id="gridBody"></tbody></table>'+
      '<div class="grid-note">本表只存四个格子当前内容；你在对话里说“加/删/换”，这里会同步变化。</div>'+
      '<div class="grid-ops"><button class="greset" id="gridReset">清空全部</button><span class="gcount" id="gridCount"></span></div>'+
    '</div></div>'+
    '</div></div>';
};
/* ===== 个人版调配记录 ===== */
T.personalHistory=function(){
  var list=PERSONAL.hist();
  if(!list.length){
    return '<div class="reclist"><div class="recempty"><span class="big">🌸</span>'+
      '还没有调配记录<br>去「专属调配」说句话，调出第一杯属于你的饮品吧</div></div>';
  }
  return '<div class="reclist">'+list.map(function(r){
    var img=r.image||"";
    return '<div class="reccard" data-phid="'+r.id+'">'+
      (img?'<img class="rcimg" src="'+img+'" onerror="this.style.visibility=\'hidden\'">':'<div class="rcimg"></div>')+
      '<div class="rcinfo"><div class="rcname">'+esc(r.name)+'</div>'+
      '<div class="rcsub">'+esc(recSub(r))+'</div>'+
      '<div class="rcdate">'+recTime(r.ts)+'</div></div>'+
      '<div style="font-size:18px;color:#9aa096">›</div></div>';
  }).join("")+'</div>';
};

/* ===== 个人版调配完成页 ===== */
T.personalDone=function(){
  return '<div class="personal-wrap">'+
    '<div class="personal-bg"></div><div class="personal-overlay"></div>'+
    '<div class="personal-content done-wrap">'+
      '<div class="done-img"><img src="'+(ctx.aiImg||'')+'" onerror="this.style.visibility=\'hidden\'"></div>'+
      '<div class="done-name">'+(ctx.aiName||'你的专属饮品')+'</div>'+
      '<div class="done-desc">'+(ctx.aiDesc||'已为你调配完成')+'</div>'+
      '<div class="done-btns">'+
        '<button class="done-back" id="doneBack">返 回</button>'+
        '<button class="done-again" id="doneAgain">再来一杯</button>'+
      '</div></div></div>';
};

T.config=function(){
  var d=drinkById(ctx.drinkId);
  var showName=ctx.isAI?ctx.aiName:d.name;
  var hasPref=!!PERSONAL.getPref();
  var recBtn=hasPref&&isPersonalMode?'<span class="rec-config-btn" id="recConfigBtn">✦ 推荐配置</span>':'';
  var tasteSegs=
    '<div class="cgroup"><div class="clab">奶 量</div><div class="seg seg4" data-g="milk">'+
      '<button data-v="0"><span class="sic">'+MILKICON[0]+'</span>无奶</button>'+
      '<button data-v="1"><span class="sic">'+MILKICON[1]+'</span>少奶</button>'+
      '<button data-v="2"><span class="sic">'+MILKICON[2]+'</span>正常</button>'+
      '<button data-v="3"><span class="sic">'+MILKICON[3]+'</span>多奶</button></div></div>'+
    '<div class="cgroup"><div class="clab">甜 度</div><div class="seg seg4" data-g="sugar">'+
      '<button data-v="0"><span class="sic">'+SUGARICON[0]+'</span>无糖</button>'+
      '<button data-v="1"><span class="sic">'+SUGARICON[1]+'</span>少糖</button>'+
      '<button data-v="2"><span class="sic">'+SUGARICON[2]+'</span>正常</button>'+
      '<button data-v="3"><span class="sic">'+SUGARICON[3]+'</span>多糖</button></div></div>'+
    '<div class="cgroup"><div class="clab">酸 度 <span class="multi">（来自鲜橙，不想要就选无酸）</span></div>'+
      '<div class="seg seg4" data-tg="orange">'+
      [0,1,2,3].map(function(q){return '<button data-v="'+q+'">'+ACNAME[q]+'</button>';}).join('')+
      '</div></div>';
  var actionsHTML;
  if(isPersonalMode){
    /* 居家版：没有任何钱与加价；记住偏好≠开始调配，三按钮各司其职 */
    actionsHTML='<div class="conf-actions conf-actions-3">'+
      '<button class="conf-cancel" id="confCancel">取 消</button>'+
      '<button class="conf-save" id="confSave">记住我的偏好</button>'+
      '<button class="conf-start" id="confStart">开 始 调 配</button></div>'+
    '<div class="conf-hint" id="confHint" style="display:none">✓ 偏好已记住，点「开始调配」就为你现做这一杯</div>';
  }else{
    actionsHTML='<button class="cta" id="toPay">去 付 款</button>';
  }
  return '<div class="conf" style="position:relative">'+recBtn+
    '<div class="stage" style="height:268px;--travel:255px">'+
      '<img src="'+(ctx.isAI?ctx.aiImg:imgOf(d))+'">'+
      (ctx.isAI&&ctx.aiType==="hot"?"":bubblesHTML(14))+
      '<div class="haze soft" style="bottom:-40px;height:120px"></div></div>'+
    '<div class="titleblock" style="margin-top:-26px"><div class="n" style="font-size:27px">'+showName+'</div></div>'+
    tasteSegs+
    (isPersonalMode?'<div id="sumWrap"></div>':'<div id="sumWrap">'+summaryHTML()+'</div>')+
    actionsHTML+'</div>';
};
var ACNAME=["无酸","微酸","正常","清爽偏酸"];
function mkMtypeBtns(cur){
  return Object.keys(MILKTYPES).map(function(k){
    var m=MILKTYPES[k];
    return '<button data-v="'+k+'" class="'+(cur===k?"on":"")+'">'+m.name+
      (m.d?' <i class="mtag">+'+m.d+'</i>':'')+'</button>';
  }).join('');
}
function mkToppGroup(key,emoji){
  var v=cst.extra[key],t=TOPP[key];
  return '<div class="topprow"><div class="toppname">'+emoji+' '+t.name+'</div>'+
    '<div class="seg seg4 toppseg" data-tg="'+key+'">'+
      [0,1,2,3].map(function(q){
        return '<button data-v="'+q+'" class="'+(v===q?"on":"")+'">'+LNAME[q]+'</button>';
      }).join('')+
    '</div></div>';
}

/* milk：奶量0-3；sugar：甜度0-3；extra.orange：酸度（鲜橙份量0-3，0=无酸不加橙）
   配置页只剩 奶量/甜度/酸度 三项；温度由聊天理解隐式保留 */
var cst={milk:2,sugar:2,extra:{orange:2},temp:"cold"};
var LNAME=["无","少","正常","多"];
var MILKTYPES={
  cow:{name:"牛奶",d:0,cost:.8},
  oat:{name:"燕麦奶",d:2,cost:1.6},
  coco:{name:"椰奶",d:2,cost:1.5},
  soy:{name:"豆奶",d:1,cost:1.0}
};
/* 配料：售价系数(每份 delta = 单价*份量系数) 与 单位原料成本(按正常份) */
var TOPP={
  pearl:{name:"珍珠",basePrice:2,baseCost:.7},
  coconut:{name:"椰果",basePrice:2,baseCost:.6},
  orange:{name:"新鲜橙片",basePrice:1,baseCost:.5}
};
var TOPP_Q=[0,.6,1,1.5];            // 份量对应价格系数
var TOPP_COST_Q=[0,.6,1,1.45];      // 份量对应成本系数
function deltaText(v){if(v>0)return '<i class="plus">+¥'+v+'</i>';if(v<0)return '<i class="minus">-¥'+(-v)+'</i>';return '<i class="zero">¥0</i>';}

/* ===== 成本模型（市场采购价口径的原料成本） =====
   不同饮品基础成本不同，再叠加奶/糖/配料 */
var BASECOST={d1:5.2,d2:4.6,feng:4.3,rou:5.6};
function calcPrice(){
  var s=cst;
  var base=ctx.isAI?ctx.aiPrice:drinkById(ctx.drinkId).price;
  var dMilk=(s.milk===3?2:s.milk===0?-1:0);
  var dSugar=(s.sugar===3?1:0);
  /* 酸度=鲜橙份量，按正常份1元线性：0无酸-0.6 / 1微酸0.6 / 2正常1 / 3清爽偏酸1.5 */
  var dAcid=Math.round(TOPP.orange.basePrice*TOPP_Q[s.extra.orange]*100)/100;
  var dTop=dAcid,dItems=[];
  if(s.extra.orange>0)dItems.push("鲜橙"+LNAME[s.extra.orange]);
  /* 用户主动选择的加料/规格：独立计价，永远叠加，不受目标价/档位影响 */
  var addOns=Math.round((dMilk+dSugar+dTop)*100)/100;
  /* 基础那杯：只含起价与档位；目标预算只作用于基础杯，不抵扣任何加料 */
  var tierUp=0,tierLabel="";
  if(ctx.aiTier===3){tierUp=14;tierLabel="顶级尊享";}
  else if(ctx.aiTier===1){tierUp=-4;tierLabel="高性价比";}
  var core=Math.round((base+tierUp)*100)/100;
  var premium=0;
  if(ctx.targetBudget && ctx.targetBudget>core){
    premium=Math.round((ctx.targetBudget-core)*100)/100;  /* 把“基础那杯”顶到预算，加料另算 */
  }
  var total=Math.round((core+premium+addOns)*100)/100;
  if(total<8){var adj=Math.round((8-total)*100)/100;tierUp=Math.round((tierUp+adj)*100)/100;core=Math.round((core+adj)*100)/100;total=Math.round((core+premium+addOns)*100)/100;}  /* 守地板价，但不动加料 */
  return {base:base,dMilk:dMilk,dSugar:dSugar,dAcid:dAcid,dTop:dTop,addOns:addOns,
    subtotal:Math.round((base+addOns)*100)/100,tierUp:tierUp,tierLabel:tierLabel,premium:premium,total:total,dItems:dItems};
}
function calcCost(){
  var s=cst;
  /* AI 定制单同样有茶汤/果汁基底成本（按招牌均价档计 5.0），不能为 0 */
  var base=ctx.isAI?5.0:(BASECOST[ctx.drinkId]!=null?BASECOST[ctx.drinkId]:5);
  var cMilk=(s.milk===3?.6:s.milk===1?-.2:s.milk===0?-.5:0);
  var cSugar=(s.sugar===3?.15:0);
  var cTop=TOPP.orange.baseCost*TOPP_COST_Q[s.extra.orange];
  var overhead=1.2;   // 杯/吸管/封口/水电分摊
  var cTier=ctx.aiTier===3?5.0:ctx.aiTier===1?-0.8:0;  /* 顶级档用优选原料，平价档省料 */
  var c=Math.round((base+cMilk+cSugar+cTop+overhead+cTier)*100)/100;
  return Math.max(c,0);
}
function summaryHTML(){
  var s=cst,p=calcPrice();
  ctx.lastPrice=p.total;
  function row(l,v){return '<div class="srow"><span>'+l+'</span><span>'+v+'</span></div>';}
  var baseName=ctx.isAI?ctx.aiName:drinkById(ctx.drinkId).name;
  var h='<div class="summary">'+
    row("「"+baseName+"」起价",'<b class="basep">¥'+p.base+'</b>')+
    row(LNAME[s.milk]+"奶",deltaText(p.dMilk))+
    row(LNAME[s.sugar]+"糖",deltaText(p.dSugar))+
    row(ACNAME[s.extra.orange]+"（鲜橙）",deltaText(p.dAcid));
  if(p.tierUp!==0)h+=row(p.tierLabel==="顶级尊享"?"顶级尊享（按你要的最贵档，优选原料）":"高性价比档",deltaText(p.tierUp));
  if(p.premium>0)h+=row("定制溢价（基础那杯按预算 ¥"+ctx.targetBudget+"，加料另计）",deltaText(p.premium));
  h+='<div class="stotal"><span>合 计</span><b>¥'+p.total+'</b></div></div>';
  return h;
}
function refreshSum(){var w=document.getElementById("sumWrap");if(w)w.innerHTML=summaryHTML();}

var PAYICON={
  wechat:'<svg width="22" height="22" viewBox="0 0 24 24"><path d="M9.4 4C5.6 4 3 6.7 3 9.9c0 1.8 1 3.4 2.5 4.4l-.6 1.9 2.2-1.1c.7.2 1.4.3 2.2.3h.5a5.6 5.6 0 0 1-.2-1.5c0-3.1 2.8-5.5 6.3-5.5h.5C15.9 5.7 12.9 4 9.4 4z" fill="#22a35b"/><circle cx="7.2" cy="8.8" r=".8" fill="#fff"/><circle cx="11.3" cy="8.8" r=".8" fill="#fff"/><path d="M21 14.2c0-2.5-2.4-4.5-5.3-4.5S10.4 11.7 10.4 14.2s2.4 4.5 5.3 4.5c.6 0 1.2-.1 1.8-.3l1.8.9-.5-1.6c1.4-.9 2.2-2.2 2.2-3.5z" fill="#2fae63"/><circle cx="14.2" cy="14" r=".65" fill="#fff"/><circle cx="17.2" cy="14" r=".65" fill="#fff"/></svg>'
};
/* 收款方是店主本人微信号（个人收款码）。顾客扫码转账给店主，并填 6 位订单码；
   店主在「饮料机账本」导入微信账单 CSV 自动核对记账。个人收款码无官方到账回调，
   这里不伪造支付成功；只有店主核对到账后机器才会确认出餐。 */
var OWNER_WXID="wxid_auf9zvuxskml22";
var ORDKEY="drink_machine_orders_v1";
var QRKEY="drink_machine_owner_qr";
function maskWxid(s){return s&&s.length>10?s.slice(0,8)+"…"+s.slice(-2):s;}
function genOrderCode(){
  for(var i=0;i<50;i++){
    var c=String(Math.floor(100000+Math.random()*900000));
    var dup=loadOrders().some(function(o){return o.code===c&&o.status!=="paid";});
    if(!dup)return c;
  }
  return String(Date.now()).slice(-6);
}
function loadOrders(){try{return JSON.parse(localStorage.getItem(ORDKEY)||"[]");}catch(e){return [];}}
function saveOrders(a){try{localStorage.setItem(ORDKEY,JSON.stringify(a));}catch(e){}}
function ownerQr(){try{return localStorage.getItem(QRKEY)||"images/wxqr-card.png";}catch(e){return "images/wxqr-card.png";}}
/* 同一杯同金额、10 分钟内未核对的订单复用，避免重复进支付页生成一堆单 */
function ensureOrder(amount,itemName,cost){
  var now=Date.now(),ords=loadOrders();
  var hit=ords.filter(function(o){
    return o.status!=="paid"&&Math.abs(o.amount-amount)<0.005&&o.item===itemName&&now-o.ts<10*60*1000;
  }).sort(function(a,b){return b.ts-a.ts;})[0];
  if(hit)return hit;
  var o={orderId:"YL"+now+"_"+Math.random().toString(36).slice(2,6),
    code:genOrderCode(),amount:amount,cost:cost,item:itemName,ts:now,status:"pending"};
  ords.push(o);saveOrders(ords);return o;
}

T.pay=function(){
  var amount=ctx.lastPrice||drinkById(ctx.drinkId).price;
  return '<div class="cashier">'+
    '<div class="cashier-top">'+
      '<div class="cashier-payee">向店主微信付款 · 本机 A08</div>'+
      '<div class="cashier-amount"><small>¥</small>'+amount+'</div></div>'+
    '<div class="cashier-body">'+
      '<div class="cashier-row"><span>商品</span><span>'+(ctx.isAI?ctx.aiName:drinkById(ctx.drinkId).name)+'</span></div>'+
      '<div class="cashier-row"><span>收款微信</span><span style="font-variant-numeric:tabular-nums">'+maskWxid(OWNER_WXID)+'</span></div>'+
      '<div class="cashier-row"><span>支付方式</span><span><span class="pmi">'+PAYICON.wechat+'</span> 微信（扫店主收款码）</span></div>'+
    '</div>'+
    '<button class="cashier-paybtn" id="payPrimary">立即支付 ¥'+amount+'</button>'+
    '<div class="cashier-vnote">付款直接进入<b>店主本人微信</b>；指纹 / 面容 / 支付密码都在微信内完成，本小程序不接触</div>'+
    /* 收款弹层：展示店主个人收款码 + 6 位订单码，顾客转账后等待店主核对 */
    '<div class="wxoverlay" id="wxOverlay">'+
      '<div class="wxcard" id="wxCard">'+
        '<div class="wxbrand">'+PAYICON.wechat+' 微信收款</div>'+
        '<div class="wxamount"><small>¥</small><span id="wxAmount">'+amount+'</span></div>'+
        '<div class="wxpayee">收款方：店主本人 '+maskWxid(OWNER_WXID)+'</div>'+
        '<div class="wxqr" id="wxQr"></div>'+
        '<div class="wxstep" id="wxStep1">'+
          '<div class="wxcodeline">转账时请在<b>「添加转账说明 / 备注」</b>里填写订单码</div>'+
          '<div class="wxordercode" id="wxOrderCode">------</div>'+
        '</div>'+
        '<div class="wxstep" id="wxStep2" style="display:none">'+
          '<div class="wxspin"></div><div class="wxverifytext">已收到你的付款通知，店主核对到账后立刻出餐，请勿离开…</div>'+
        '</div>'+
        '<div class="wxstep" id="wxStepOk" style="display:none">'+
          '<div class="wxokbig">✓</div>'+
          '<div class="wxoktitle">已收到，正在出餐</div>'+
          '<div class="wxoksub">请在取餐口等候，凭订单码 <b id="wxOkCode"></b> 取餐</div>'+
          '<div class="wxokbtn" id="wxDone">完 成</div>'+
        '</div>'+
        '<div class="wxtip" id="wxTip">长按或截图保存收款码 → 微信「扫一扫」识别 → 输入金额并备注订单码</div>'+
        '<div class="wxbtnrow" id="wxBtnRow"><div class="wxcancel" id="wxCancel">取消</div>'+
        '<div class="wxok" id="wxPaidBtn">我已转账完成</div></div>'+
      '</div>'+
    '</div>'+
  '</div>';
};

function bindPay(p){
  var amount=ctx.lastPrice||drinkById(ctx.drinkId).price;
  var itemName=ctx.isAI?ctx.aiName:drinkById(ctx.drinkId).name;
  var cost=calcCost();
  var order=null, pollTimer=null;
  var ov=p.querySelector("#wxOverlay");

  function openQR(){
    order=ensureOrder(amount,itemName,cost);
    p.querySelector("#wxAmount").textContent=order.amount;
    p.querySelector("#wxOrderCode").textContent=order.code;
    var qr=ownerQr();
    var qrBox=p.querySelector("#wxQr");
    if(qr){qrBox.innerHTML='<img src="'+qr+'" alt="店主微信收款码" style="width:224px;height:298px;object-fit:contain;border-radius:14px;box-shadow:0 6px 20px -8px rgba(0,0,0,.25)">';}
    else{
      qrBox.innerHTML='<div class="wxqrph">🧑\u200d💼<div>店主收款码占位</div><small>店主在账本里上传本人收款码后，<br>这里会显示真实微信收款码</small></div>';
    }
    p.querySelector("#wxStep1").style.display="block";
    p.querySelector("#wxStep2").style.display="none";
    p.querySelector("#wxStepOk").style.display="none";
    p.querySelector("#wxBtnRow").style.display="flex";
    p.querySelector("#wxTip").style.display="block";
    p.querySelector("#wxPaidBtn").textContent="我已转账完成";
    ov.classList.add("show");
  }
  function close(){ov.classList.remove("show");stopPolling();}
  function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
  function markPaidUI(){
    stopPolling();
    p.querySelector("#wxStep1").style.display="none";
    p.querySelector("#wxStep2").style.display="none";
    p.querySelector("#wxStepOk").style.display="block";
    p.querySelector("#wxOkCode").textContent=order?order.code:"";
    p.querySelector("#wxTip").style.display="none";
    p.querySelector("#wxBtnRow").style.display="none";
    var btn=p.querySelector("#payPrimary");
    btn.disabled=true;
    btn.innerHTML='<span class="paycheck">✓</span> 支付成功 · 正在出餐';
    btn.classList.add("done");
  }
  /* 跨标签页：店主在账本核对到账后，订单 status 变 paid，这里立即收到 */
  function checkPaid(){
    if(!order)return false;
    var o=loadOrders().find(function(x){return x.orderId===order.orderId;});
    if(o&&o.status==="paid"){markPaidUI();return true;}
    return false;
  }

  p.querySelector("#payPrimary").onclick=openQR;
  p.querySelector("#wxCancel").onclick=close;
  /* 顾客点“我已转账完成”：进入等待核对状态（不立即出餐、不记收入），轮询订单状态 */
  p.querySelector("#wxPaidBtn").onclick=function(){
    if(!order)return;
    p.querySelector("#wxStep1").style.display="none";
    p.querySelector("#wxTip").style.display="none";
    p.querySelector("#wxPaidBtn").textContent="等待店主核对…";
    p.querySelector("#wxStep2").style.display="flex";
    if(checkPaid())return;
    stopPolling();
    pollTimer=setInterval(checkPaid,1200);
  };
  var doneBtn=p.querySelector("#wxDone");
  if(doneBtn)doneBtn.onclick=function(){close();resetHome();};
  ov.onclick=function(e){if(e.target===ov)close();};
  window.addEventListener("storage",function(e){
    if(e.key===ORDKEY&&ov.classList.contains("show"))checkPaid();
  });
}
/* 全局起名函数，供 bindChat 和 bindPersonalChat 共用 */
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
/* 从原话推断茶量：1 淡 / 2 正常 / 3 浓 */
function teaStrengthFrom(raw){
  var t=String(raw||"");
  if(/浓茶|多茶|茶多|多放茶|多加茶|茶浓|浓一点|提神|困|熬夜|清醒/.test(t))return 3;
  if(/少量茶|茶少|少放茶|少茶|淡一点|淡茶|茶淡/.test(t))return 1;
  return 2;
}
/* 高情商起名：严格按真实成分与情绪选大词库，近因去重，两版共用 */
function globalMakeName(t,state){
  state=state||{};
  var raw=String(t||"");
  var acid=(state.acid!=null?state.acid:(cst.extra?cst.extra.orange:2));
  var milk=(state.milk!=null?state.milk:cst.milk);
  var teaLv=(state.teaLv!=null?state.teaLv:teaStrengthFrom(raw));
  var hot=state.hot!=null?state.hot:cst.temp==="hot";
  var noFruit=acid<=0||/不要果汁|不带果汁|不加果|无果汁|别放果|不要水果|不含果|不要橙|不加橙|不要酸|不酸|别酸|不要果味|不带果味/.test(raw);
  var noMilk=milk<=0||/不要奶|不加奶|去奶|无奶|别放奶|不放奶|没奶|不喝奶/.test(raw);
  var wantMilk=!noMilk&&(milk>=2||/奶|拿铁|牛乳|丝滑|醇厚|浓郁|温柔|治愈/.test(raw));
  var wantFruit=!noFruit&&(acid>=2||/橙|橘|维\s*c|水溶|酸|果味|果汁|清爽|清新|解腻|元气/.test(raw.toLowerCase()));
  var wantTeaStrong=teaLv>=3,wantTeaLight=teaLv<=1;
  var noTea=noTeaRequested(raw);   /* 明确不要茶：名字也绝不许带茶味字眼 */
  var pools=[];
  if(/最贵|顶级|豪华|高端|顶配/.test(raw))pools.push(["金阙","玉盏","瑶席","鎏光","御品","琉盏"]);
  if(hot)pools.push(["暖盏","温屿","暮炉","晴雪","煨春","衔暖"]);
  if(wantMilk)pools.push(["云乳","雪乳","醇白","酥云","奶云","白屿","绵霜","乳烟","凝脂","月白"]);
  if(wantFruit)pools.push(["橙光","橘颂","斜阳","橘野","澄橙","暖橘","金珀","晓橙","橘屿","明霞"]);
  if(!noTea){
    if(wantTeaStrong)pools.push(["岩韵","浓洇","醒山","厚叶","松风煮","烈盏","墨茶","沉岩"]);
    else if(wantTeaLight)pools.push(["薄茶","浅瓯","半盏绿","叶隙","一抿","淡烟"]);
    else pools.push(["乌龙","茉上","红窗","绿萼","春涧","茶坞","叶露","半山","茶色","晴川","青榄","知夏"]);
  }
  if(/清爽|清新|解腻|通透|提神/.test(raw))pools.push(["清风","澄光","溪光","初霁","泠然","白露","漱石"]);
  if(/累|疲惫|放松|压力|治愈|安慰|犒劳|难[过受]|郁闷|幸福|晚安|睡/.test(raw))pools.push(["暖云","轻愈","慢享","松风","小憩","软暮","抚肩","安晚"]);
  var tail=["一盏","慢饮","有期","入怀","初见","半盏","闲时","小叙","之引","微醺","来信","入夜","枕风","正好","轻声","三时","予你","时雨"];
  if(!pools.length)pools.push(noTea?["橙光","澄光","金珀","晓橙","明霞","溪光","初霁","泠然"]:["澄光","清欢","叶露","半山","茶色","晴川"]);
  if(typeof globalMakeName._used!=="object")globalMakeName._used=[];
  var cand;
  for(var i=0;i<24;i++){
    var pool=pools[Math.floor(Math.random()*pools.length)];
    cand=pool[Math.floor(Math.random()*pool.length)]+tail[Math.floor(Math.random()*tail.length)];
    if(globalMakeName._used.indexOf(cand)<0)break;
  }
  globalMakeName._used.push(cand);
  if(globalMakeName._used.length>40)globalMakeName._used.shift();
  return cand;
}
/* 全局共享：好处文案（商用/个人本地兜底复用）。无茶时一律不选含茶的句子 */
var LOCAL_BEN={
  milk:"奶香温柔、入口顺滑，累的时候来一杯很治愈、很踏实。",
  clear:"清透解腻、零负担，犯困或吃撑时最救场。",
  orange:"橙香明亮，早晨或没精神时来一杯很元气。",
  hot:"热气暖暖地捧着，一口下去暖到胃里，很舒服。",
  teaStrong:"茶味足、回甘长，犯困或想提神时特别顶用。",
  teaLight:"清淡不抢戏，温润顺口，什么时候喝都没负担。",
  fruit:"果香清亮、酸甜正好，没精神时来一杯特别醒神。"
};
/* 用户原话是否明确“不要茶/去茶”——只认真正否定茶，不误伤“茶”字的正常出现 */
function noTeaRequested(raw){
  var t=String(raw||"");
  return /不要茶|不想喝茶|不喝茶|不要茶底|不加茶|不放茶|去茶|无茶|没有茶|别放茶|去掉茶|不要有茶|不要茶叶/.test(t);
}
/* 严格按真实配方生成多维度文案：为什么这么调 / 三层风味 / 这杯的好。
   铁律：酸度0 绝不出现 果/橙；hasTea=false 时全篇绝不出现 茶/回甘/茶叶；只描述真实存在的东西。
   入参 state：{milk0-3,sugar0-3,acid0-3,teaLv1-3,hot:bool,hasTea:bool} */
var _copyRand=0;
function _pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function buildLocalCopy(state){
  var milk=state.milk||0,sugar=state.sugar==null?2:state.sugar,
      acid=state.acid||0,teaLv=state.teaLv||2,hot=!!state.hot,
      hasTea=state.hasTea!==false;
  var hasMilk=milk>=1,hasAcid=acid>=1,milkHeavy=milk>=3,milkLight=milk===1,
      acidHeavy=acid>=3,acidLight=acid===1,teaStrong=teaLv>=3,teaLight=teaLv<=1,
      sugar0=sugar===0,sugarLow=sugar===1;
  /* —— 为什么这么调：只描述真实存在的东西 —— */
  var whyParts=[];
  if(hasTea){
    if(teaStrong)whyParts.push(_pick(["把茶底泡得足足的，让茶香先立住、有底气","特意加重了茶味，入口就是一记扎实的茶香","茶底浓一点，香气更有存在感"]));
    else if(teaLight)whyParts.push(_pick(["茶底收得很淡，只留一缕若有若无的茶香","少放了些茶，喝起来清清淡淡不抢人","茶味压得轻轻的，顺口不苦涩"]));
    else whyParts.push(_pick(["茶香先立住分寸","茶底香气刚刚好，清而不淡"]));
  }
  if(hasMilk){
    if(milkHeavy)whyParts.push(_pick(["再厚厚地铺上奶香，口感绵密丝滑","奶香给足，入口醇厚饱满","奶量拉满，是温温柔柔的乳香"]));
    else if(milkLight)whyParts.push(_pick(["只点一点奶香，轻轻润一润口感","少许奶意让口感更柔和，不腻","薄薄一层奶香，顺滑不厚重"]));
    else whyParts.push(_pick(["奶香慢慢铺开，口感顺滑温柔","奶香不抢戏，把口感调得柔和舒服"]));
  }
  if(hasAcid){
    if(acidHeavy)whyParts.push(_pick(["最后用一抹明亮的鲜橙酸把整杯点亮，清爽利落","鲜橙的酸甜给足，喝起来特别醒神","橙香清透，酸甜把层次整个提了起来"]));
    else if(acidLight)whyParts.push(_pick(["只借一点点鲜橙的明亮，提个味就收","一丝若隐若现的酸香，让收口更清爽","极淡的鲜橙气，轻轻提一下层次"]));
    else whyParts.push(_pick(["再用一点鲜橙酸把层次点亮","一抹酸甜刚好，让口感更明亮"]));
  }
  if(sugar0)whyParts.push("一点糖都不放，喝的就是原味");
  else if(sugarLow)whyParts.push("糖收着放，只留温润不留甜腻");
  if(hot)whyParts.push("再温到刚刚好的热度");
  if(!whyParts.length)whyParts.push("清清爽爽，就是这一杯本来的味道");
  var why=whyParts.join("，")+"。";
  /* —— 风味层次：多感官句库随机选3句并打乱，无茶时所有茶句一律不入池 —— */
  var pool=[];
  function addPool(cond,arr){if(cond)arr.forEach(function(s2){pool.push(s2);});}
  if(hasTea){
    addPool(teaStrong,["茶香来得直接又扎实，一入口就立住了","咽下去之后，舌根还留着明显的茶味","底味有存在感，苦得很收敛，只剩醇厚","热的时候香气最冲，凉一点又更柔"]);
    addPool(teaLight,["香气淡淡的，像背景音一样托着整杯","味道很轻，喝起来几乎没有负担","余味里只剩一缕清香，很快就散了"]);
    addPool(!teaStrong&&!teaLight,["香气干净，清清爽爽地铺开","口感温润，不涩也不寡","回甘是那种很斯文的甜","香气在嘴里转一圈，走得很利落"]);
  }
  /* 奶香 */
  addPool(hasMilk&&milkHeavy,["奶香厚厚一层，口感绵密得像云","乳香裹着舌头，特别踏实","喝完嘴角还留着奶的温润","醇厚感主要来自这口奶，很满足"]);
  addPool(hasMilk&&!milkHeavy,["奶香只是轻轻一抹，口感很圆润","奶意柔柔地滑过去，不腻","顺滑是奶香给的，但它不抢味","中段能尝到一点温温的乳香"]);
  /* 鲜橙酸度 */
  addPool(hasAcid&&acidHeavy,["酸甜很明快，舌尖一下子就醒了","橙香清透，整杯都被点亮了","酸得有精神，咽完还想再来一口","冰凉的酸甜最解暑气"]);
  addPool(hasAcid&&!acidHeavy,["只有一丝酸意在边上悄悄提味","鲜橙气若有若无，让收口更清爽","那一点点酸，刚好解了腻","尾调泛出一点橙香，很俏皮"]);
  /* 温度 */
  addPool(hot,(hasTea?["热气带着茶香往上走，捧着很安心","一口下去，暖意一直落到胃里","热饮让香气更慢、更厚","温度刚刚好，不烫嘴却很暖"]
                       :["热气缓缓往上走，捧着很安心","一口下去，暖意一直落到胃里","热饮喝起来更柔、更厚","温度刚刚好，不烫嘴却很暖"]));
  addPool(!hot,["冰冰凉凉的，滑得特别快","杯壁的凉气先到，喝着很解暑","冰感把甜度压得很克制","凉着喝，层次反而更分明"]);
  /* 甜度 */
  addPool(sugar0,["完全不靠糖，喝的就是本身的味道","无糖但不寡，靠香气撑着","清爽到可以一口接一口"]);
  addPool(sugarLow,["甜度收得很克制，几乎只是提个味","低糖喝着轻盈，不会发齁"]);
  /* 口感/整体 */
  addPool(hasMilk&&hasAcid,["奶的柔和酸的明亮撞在一起，很有层次","一边顺滑一边清爽，口感很妙"]);
  addPool(hasTea&&!hasMilk&&!hasAcid,["就是一杯很纯粹的味道，干净利落","没有多余的东西，原味最耐喝"]);
  addPool(!hasTea&&!hasMilk&&hasAcid,["满满一杯果味的明亮，干净利落","酸甜清爽，喝起来毫无负担"]);
  addPool(!hasTea&&hasMilk&&!hasAcid,["就是一杯很纯粹的奶香，干净利落","奶香原味，喝着最踏实"]);
  /* 洗牌 + 随机取3句，保证每次顺序与内容都不同 */
  for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=pool[i];pool[i]=pool[j];pool[j]=tmp;}
  var layers=pool.slice(0,3);
  if(layers.length<3)layers=layers.concat(["喝起来很顺口，想慢慢喝完","整体平衡得刚刚好","是一杯会让人记住的味道"]).slice(0,3);
  /* —— 好处（无茶时绝不选含茶句）—— */
  var benefit;
  if(hasMilk&&hasAcid)benefit=LOCAL_BEN.milk;
  else if(hasMilk)benefit=LOCAL_BEN.milk;
  else if(hasAcid&&!hot)benefit=LOCAL_BEN.orange;
  else if(hasAcid&&hot)benefit=LOCAL_BEN.fruit;
  else if(hot)benefit=hasTea?LOCAL_BEN.teaStrong:LOCAL_BEN.hot;
  else if(hasTea&&teaStrong)benefit=LOCAL_BEN.teaStrong;
  else if(hasTea)benefit=LOCAL_BEN.teaLight;
  else benefit=LOCAL_BEN.clear;
  return {why:why,layers:layers,benefit:benefit};
}

/* ===== 现场高情商「产品级」开场介绍（商用/个人通用，每杯现写、绝不重复）=====
   入参同 buildLocalCopy 的 state + rawText；只写这杯真实存在的东西。
   铁律：acid=0 绝不出现 果/橙/果酸/果香/酸甜。 */
var _introUsed=[];
function buildProductIntro(state,rawText){
  /* 铁律：只一句话夸产品，不提任何配料/原料/制作过程/技术；高级、克制、有被懂的感觉 */
  var lines=[
    "这一杯，只为读懂你此刻的口味而生。",
    "你的口味，值得被认真而郑重地对待。",
    "不必多说，你想要的那份恰到好处，我都懂。",
    "在这一杯里，藏着只属于你的分寸与心意。",
    "一杯懂你的味道，胜过千言万语。"
  ];
  var intro=_pick(lines);
  var tries=0;
  while(_introUsed.indexOf(intro)>=0&&tries<3){intro=_pick(lines);tries++;}
  _introUsed.push(intro);if(_introUsed.length>24)_introUsed.shift();
  return intro;
}
function bindChat(p){
  var list=p.querySelector("#chatlist"),input=p.querySelector("#chatinput");
  function add(role,html){var d=document.createElement("div");d.className="cmsg "+role;
    d.innerHTML=(role==="ai"?'<div class="cai-av">🍵</div>':'')+'<div class="cb">'+html+'</div>';
    list.appendChild(d);list.scrollTop=list.scrollHeight;return d;}
  function say(html,cb){var m=add("ai",'<span class="typing"><i></i><i></i><i></i></span>');var e=m.querySelector(".cb");
    setTimeout(function(){e.innerHTML=html;list.scrollTop=list.scrollHeight;if(cb)cb(e);},560);}
  var rejectPhrases=[
    "好的，这杯先撤下～再跟我说说你想要的感觉，我重新给你想。",
    "没问题，我们换一个。你想清爽点、浓郁点，还是换个温度？",
    "收到，重新来。把你此刻的心情或口味告诉我，我马上再配一杯。"
  ],rejectN=0;
  function thinkingBubble(){
    var m=add("ai",'<span class="typing"><i></i><i></i><i></i></span>');
    return m.querySelector(".cb");
  }
  function bindPrevButtons(box,temp,snap){
    var st=box.querySelector("#aiStart"),rj=box.querySelector("#aiReject");
    if(st)st.onclick=function(){
      /* 每张卡片记住自己那一杯的快照：点谁就恢复谁，避免连续配多杯时被最新一杯的全局状态覆盖（串名 bug） */
      resetCst(temp);
      if(snap){
        if(typeof snap.milk==="number")cst.milk=snap.milk;
        if(typeof snap.sugar==="number")cst.sugar=snap.sugar;
        if(snap.extra&&typeof snap.extra.orange==="number")cst.extra.orange=snap.extra.orange;
        cst.temp=snap.temp||temp;
        ctx.isAI=true;ctx.drinkId="d1";
        if(snap.name)ctx.aiName=snap.name;
        if(snap.desc)ctx.aiDesc=snap.desc;
        if(snap.lead)ctx.aiLead=snap.lead;
        if(snap.why)ctx.aiWhy=snap.why;
        if(snap.benefit)ctx.aiBenefit=snap.benefit;
        if(snap.layers)ctx.aiLayers=snap.layers;
        if(snap.img)ctx.aiImg=snap.img;
        ctx.aiType=snap.temp||temp;
        if(snap.price)ctx.aiPrice=snap.price;
      }
      go("config");
    };
    if(rj)rj.onclick=function(){say(rejectPhrases[rejectN++%rejectPhrases.length]);};
  }
  /* 离线兜底时的本地现调文案（服务没起来也保证 lead/why/layers/benefit 不空，每次随机） */
  var LOCAL_LEADS=["把此刻的心情，调成一杯。","不必将就，你的口味值得现调。","风过叶尖，恰好是这一杯。","顺手为你，起了个新名字。","今天这杯，想替你说句话。","愿这一口，接住今天的你。","好味道，值得为你重新起笔。","杯里没有将就，只有刚刚好。","今天的风味，为你另起一行。","先敬此刻——这杯为你现调。","愿回甘替我说句：辛苦了。","一杯入喉，万事皆可慢慢来。"],
    LOCAL_LEAD_USED=[],
    LOCAL_WHY_M=["茶香先立住分寸，奶香把口感调得顺滑温柔，回甘更舒服。","奶香不抢戏，只是把茶的棱角轻轻收住，喝起来绵密不齁。"],
    LOCAL_WHY_C=["一丝清亮果酸，酸甜刚好把茶味点亮。","一点果酸让口感更明亮，清爽不寡淡。"],
    LOCAL_WHY_O=["橙香明亮讨喜，和茶底搭在一起很有元气。","橙香天然清新，让整杯更有层次。"];
  function pickFreshLead(rawText){
    /* 无茶时过滤掉含 茶/回甘 的引言 */
    var banTea=noTeaRequested(rawText);
    var pool=LOCAL_LEADS.filter(function(x){return !(banTea&&/茶|回甘/.test(x));});
    var avail=pool.filter(function(x){return LOCAL_LEAD_USED.indexOf(x)<0;});
    if(!avail.length){avail=pool.slice();LOCAL_LEAD_USED.length=0;}
    var s=avail[Math.floor(Math.random()*avail.length)];
    LOCAL_LEAD_USED.push(s);return s;
  }
  function localCopy(c2,rawText){
    var lc=buildLocalCopy({milk:cst.milk,sugar:cst.sugar,acid:cst.extra?cst.extra.orange:0,
      teaLv:teaStrengthFrom(rawText),hot:c2&&c2.temp==="hot",hasTea:!noTeaRequested(rawText)});
    return {lead:pickFreshLead(rawText),why:lc.why,layers:lc.layers,benefit:lc.benefit};
  }
  /* 点单：图由本地风味分类决定（保证出图稳定），名字与高情商介绍由真模型生成 */
  function presentOrder(box,rawText,name,desc,c,apology,svc,silent){
    svc=svc||{};
    if(!svc.lead){var lc=localCopy(c,rawText);svc.lead=lc.lead;svc.why=lc.why;svc.layers=lc.layers;svc.benefit=lc.benefit;if(!svc.temp)svc.temp=c.temp;}
    /* 本地兜底：开场产品介绍也现场生成，绝不使用 classify 里写死的同一句，也不复用历史 desc */
    desc=buildProductIntro({milk:cst.milk,sugar:cst.sugar,acid:cst.extra?cst.extra.orange:0,
      teaLv:teaStrengthFrom(rawText),hot:(svc.temp||(c&&c.temp))==="hot"},rawText);
    ctx.isAI=true;
    ctx.aiName=esc(name);
    ctx.aiDesc=esc(desc);
    /* 完整产品描述：现场现调，每次都不一样——开场短引 / 为什么推荐 / 风味三层 / 这杯的好处 */
    ctx.aiLead=svc&&svc.lead?esc(svc.lead):"";
    ctx.aiWhy=svc&&svc.why?esc(svc.why):"";
    ctx.aiMeaning=svc&&svc.meaning?esc(svc.meaning):"";
    ctx.aiBenefit=svc&&svc.benefit?esc(svc.benefit):"";
    ctx.aiLayers=(svc&&svc.layers&&svc.layers.map)?svc.layers.map(function(x){return esc(x);}):[];
    var temp=(svc&&svc.temp)||c.temp;
    /* 图片只认编排服务这一条链路返回的 URL（服务端默认豆包 Seedream，无 Key 时服务端自行降级）；
       服务没给图才退回本地占位，绝不在前端另起第二次出图调用。 */
    var svcImg=(svc&&svc.image&&svc.image.url)?svc.image.url:"";
    ctx.aiImg=svcImg||c.img;
    ctx.aiType=temp;
    if(svc&&svc.price)ctx.aiPrice=svc.price;
    /* 无气泡致歉放在最前（机器没有气泡技术），随后照常给无气泡替代方案 */
    ctx.aiFlavor=buildFlavor(rawText);
    box.innerHTML=(apology?'<p style="margin:0 0 10px;line-height:1.6">'+esc(apology)+'</p>':"")+aiPrevHTML();
    list.scrollTop=list.scrollHeight;
    /* 原料以编排服务据配方推导出的真实开关为准；服务缺失时才本地推导，绝不出现 4 种之外的东西 */
    var ingredients;
    if(svc&&svc.ingredients&&typeof svc.ingredients==="object"){
      ingredients={
        tea:svc.ingredients.tea!==false&&!noTeaRequested(rawText),
        milk:!!svc.ingredients.milk,
        c:!!svc.ingredients.c,
        orange:!!svc.ingredients.orange,
        ice:svc.ingredients.ice!==false&&temp!=="hot"
      };
    }else{
      /* 离线推导：先尊重否定（不要奶/不要果汁），再看明确口味，最后才用本地分类，绝不硬塞橙 */
      var tl=rawText.toLowerCase();
      var noMilk=/不要奶|不加奶|去奶|无奶|别放奶|不放奶|没奶/.test(tl);
      var noFruit=/不要果汁|不带果汁|不加果|无果汁|别放果|不要水果|不含果|不要橙|不加橙|别放橙|不要酸|不酸|别酸|不要果味|不带果味/.test(tl);
      var wantMilk=!noMilk&&((cst.milk>0)||/奶|拿铁|牛乳/.test(tl));
      var sayOrange=!noFruit&&/橙|橘|维生素|c100|水溶|补\s*c|维\s*c|果味|果汁/.test(tl);
      var sayC=!noFruit&&/水溶|c100|维c|补c|酸|清爽|清新|解腻|醒/.test(tl);
      var wantOrange=!noFruit&&(sayOrange||(!/不要|不加|别|无|不/.test(tl)&&(c.type==="default"||c.type==="moodHappy")));
      var wantC=!noFruit&&(sayC||(wantOrange&&/清爽|清新/.test(tl)));
      ingredients={ tea:!noTeaRequested(rawText), milk:wantMilk, c:wantC, orange:!!wantOrange, ice:temp!=="hot" };
    }
    if(svcImg){
      /* 服务已端到端出好图：加载完成淡入，失败提示但不阻断下单 */
      var im0=box.querySelector("#genImg");
      if(im0){im0.src=svcImg;}
    }else{
      /* 无后端：直接用预置高清真图（豆包 Seedream 离线图库），不调免费兜底模型，零等待无水印 */
      var seed=seedOf(rawText+name);
      var localImg=staticPick(ingredients,temp,seed);
      ctx.aiImg=localImg;
      var imL=box.querySelector("#genImg");
      if(imL)imL.src=localImg;
    }
    /* 存入调配记录（复刻的单子不重复存） */
    if(!silent){
      try{
        HISTORY.save({
          name:name,desc:desc||"",query:rawText,
          temp:temp,ice:svc.ice||c.ice||"",sugar:svc.sugar||c.sugar||"",
          price:ctx.aiPrice||0,image:ctx.aiImg||"",ingredients:ingredients,
          svc:{lead:svc.lead,why:svc.why,layers:svc.layers,benefit:svc.benefit,meaning:svc.meaning,
               temp:temp,ingredients:ingredients,image:{url:ctx.aiImg||""},price:ctx.aiPrice||0,
               ice:svc.ice||c.ice||"",sugar:svc.sugar||c.sugar||""}
        });
      }catch(e){}
    }
    /* 此刻该杯的名字/配方/图/价格全部定稿，再绑定本卡片按钮并冻结快照（复刻单也要可点） */
    bindPrevButtons(box,temp,{
      milk:cst.milk,sugar:cst.sugar,extra:{orange:cst.extra?cst.extra.orange:2},temp:temp,
      name:ctx.aiName,desc:ctx.aiDesc,lead:ctx.aiLead,why:ctx.aiWhy,benefit:ctx.aiBenefit,
      layers:ctx.aiLayers,img:ctx.aiImg,price:ctx.aiPrice
    });
  }
  /* 复刻历史那一杯（不再请求 AI，直接用存档全套） */
  function replayHistory(box,r,sayText){
    resetCst(r.temp==="hot"?"hot":(r.temp==="normal"?"normal":"cold"));
    cst.temp=r.temp==="hot"?"hot":(r.temp==="normal"?"normal":"cold");
    var fakeC={type:"history",temp:cst.temp,ice:r.ice||"",sugar:r.sugar||"",
      img:r.image||"",desc:r.desc||"",ingredients:r.ingredients||{tea:true}};
    if(r.price)ctx.aiPrice=r.price;
    presentOrder(box,sayText||("再来一杯「"+r.name+"」"),r.name,r.desc||"",fakeC,null,r.svc,true);
  }
  window.__replayHistory=function(r){
    var page=stack[stack.length-1].el,list2=page.querySelector("#chatlist");
    var box2=add("ai","");var bubble=box2.querySelector(".cb");
    replayHistory(bubble,r);
    list2.scrollTop=list2.scrollHeight;
  };
  function send(){
    var t=input.value.trim();if(!t)return;
    add("user",esc(t));input.value="";
    var box=thinkingBubble();
    /* 历史召回：用户点名字 / 说配料 / 说"上次那杯" → 先在本地记录里找 */
    var hit=HISTORY.detect(t);
    if(hit&&hit.kind!=="guess"){
      replayHistory(box,hit.rec,t);
      return;
    }
    if(hit&&hit.candidates&&hit.candidates.length){
      box.innerHTML='<div class="recguess" style="margin:0"><h4>我猜你说的是之前这杯，点一下就为你重做：</h4>'+
        hit.candidates.map(function(r,i){
          return '<div class="gitem" data-gid="'+i+'">'+
            (r.image?'<img src="'+r.image+'" onerror="this.style.visibility=\'hidden\'">':'<img>')+
            '<div style="flex:1;min-width:0"><div class="gn">'+esc(r.name)+'</div>'+
            '<div class="gs">'+esc(recSub(r))+' · '+recTime(r.ts)+'</div></div><div style="color:#9aa096">›</div></div>';
        }).join("")+'</div>';
      list.scrollTop=list.scrollHeight;
      var gitems=box.querySelectorAll(".gitem");
      for(var gi=0;gi<gitems.length;gi++){(function(idx){
        gitems[idx].onclick=function(){replayHistory(box,hit.candidates[idx],t);};
      })(gi);}
      return;
    }
    /* 唯一主链路：一句话 → 编排服务 /api/drink 内部完成理解/起名/文案/配方/致歉/豆包出图，一次返回全套。
       服务不可达 / 超时 → 退回本地规则(TEXTAI 独立后端 + classify)，原型离线也能点，绝不卡住。 */
    DRINKAI.order(t).then(function(raw){
      var d=raw?DRINKAI.shape(raw,t):null;
      if(d&&d.ai&&d.order){
        /* —— 编排服务一条龙结果 —— */
        var c=classify(t);
        var temp=d.temp||c.temp;
        resetCst(temp);
        if(temp)cst.temp=temp;
        applyMods(d.mods);                /* 奶量/橙汁/温度以服务据配方的推导为准 */
        if(d.price)ctx.aiPrice=d.price;
        if(!ctx.aiTier)ctx.aiTier=0;
        presentOrder(box,t,d.name||globalMakeName(t),d.desc||c.desc,c,d.apology,d);
        return;
      }
      if(d&&d.ai&&d.order===false){
        box.innerHTML=esc(d.reply||chatReply(t)).replace(/\n/g,"<br>");
        list.scrollTop=list.scrollHeight;
        return;
      }
      /* —— 本地/独立后端兜底（编排服务没起来时） —— */
      TEXTAI.understand(t).then(function(u){
        var isOrder,aiName,aiDesc,replyText,mods;
        if(u&&u.ai){
          isOrder=u.order;aiName=u.name;aiDesc=u.desc;replyText=u.reply;mods=u.mods;
        }else{
          var intent=detectIntent(t);
          isOrder=intent.order;replyText=intent.reply||"";
          if(isOrder)mods=parseMods(t);   /* 断网时也本地解析“最贵/不要奶”等 */
        }
        if(isOrder){
          var c2=classify(t);               /* 仅用于定出图风格与温度 */
          resetCst(c2.temp);
          if(c2.temp)cst.temp=c2.temp;
          applyMods(mods);
          if(!ctx.aiTier)ctx.aiTier=0;
          presentOrder(box,t,aiName||globalMakeName(t),aiDesc||c2.desc,c2,u&&u.apology);
        }else{
          box.innerHTML=esc(replyText||chatReply(t)).replace(/\n/g,"<br>");
          list.scrollTop=list.scrollHeight;
        }
      });
    });
  }
  p.querySelector("#chatsend").onclick=send;
  input.addEventListener("keydown",function(e){if(e.key==="Enter")send();});
  _bindVoice(p);
  _watchChat(p);
  /* 欢迎词：每次进入 AI 配比都现挑一条，且明确"每一杯都是现场现调、绝不重样" */
  var welcomes=[
    "嗨，欢迎回来～<br>一杯好茶，清有清的透亮，醇有醇的温柔，冰热酸甜都能随你此刻的心情走。<br>今天想喝点什么感觉？说一句话就行。",
    "你来啦，先别急。<br>累了、腻了、想开心一下，哪怕只说“随便”，我也给你一杯不重样的好喝的。",
    "欢迎光临～<br>清爽的、醇厚的、热乎的、明亮的，你说出口的那句，就是这一杯的灵魂。",
    "嗨～今天这杯，注定和你上次喝的不一样。<br>茶香、奶香、果香能转出很多种惊喜，说说看，你想要什么感觉？",
    "你好呀，我是你的专属调配师。<br>口味、心情、预算、忌口都可以说，比如“来个贵一点的、不要奶”，剩下的交给我，保证好喝又好看。",
    "见到你真高兴～<br>每一杯都是听你说完才动手，新鲜得刚刚好。现在的你，想被清爽叫醒，还是想被温柔接住？",
    "嗨，今天过得怎么样？<br>不管顺不顺，先把心情交给我——清清爽爽，或温温柔柔，我都能给你调成一杯好喝的。",
    "欢迎光临～<br>想喝什么直接开口，模糊一点也没关系，“随便来点”“解解腻”“热乎点”，我都听得懂、做得出。",
    "嘿，准备好被一杯饮料懂一下了吗？<br>说说口味或心情，这杯的名字和味道，都会跟着你这句话长出来。",
    "你来啦～<br>好味道值得现做：你一句话，我马上给你变出一杯专属的，名字也是为这一杯新起的。",
    "嗨～今天想清爽利落，还是醇厚治愈？<br>没有标准答案，你说出来的那句最重要，我负责把它做到最好喝。",
    "欢迎呀。<br>茶香清透、奶香丝滑、果香明亮，浓淡冰热样样都有——告诉我你此刻想要的味道就好。"
  ];
  say(welcomes[Math.floor(Math.random()*welcomes.length)]);
}

/* 记录页：点一条 → 进 AI 配比并直接重做这杯 */
function bindHistory(p){
  var cards=p.querySelectorAll(".reccard");
  for(var i=0;i<cards.length;i++){(function(card){
    card.onclick=function(){
      var r=HISTORY.get(card.getAttribute("data-hid"));
      if(!r)return;
      go("ai");
      setTimeout(function(){if(window.__replayHistory)window.__replayHistory(r);},320);
    };
  })(cards[i]);}
}

/* 回到默认调配状态（AI 单开始前也用它重置） */
/* 下单前先套用已记住的偏好作为默认基底；本次对话里明确说的加减/不要，随后由 applyMods/applyHardBans 覆盖 */
function applySavedPref(){
  try{
    var rec=PERSONAL.calcRec();if(!rec)return;
    if(typeof rec.milk==="number")cst.milk=rec.milk;
    if(typeof rec.sugar==="number")cst.sugar=rec.sugar;
    if(typeof rec.orange==="number")cst.extra.orange=rec.orange;
    if(rec.temp)cst.temp=rec.temp;
  }catch(e){}
}
function flavorToast(msg){
  var t=document.createElement("div");t.className="flavortoast";t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.classList.add("show");},10);
  setTimeout(function(){t.classList.remove("show");setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},300);},1900);
}
function resetCst(temp){
  cst={milk:2,sugar:2,extra:{orange:2},temp:temp||"cold"};
}
/* 把 AI/本地解析出的偏好落到 cst 与 ctx（价格档位/目标预算） */
function applyMods(m){
  if(!m)return;
  if(typeof m.milk==="number"&&m.milk>=0&&m.milk<=3)cst.milk=m.milk;
  if(typeof m.sugar==="number"&&m.sugar>=0&&m.sugar<=3)cst.sugar=m.sugar;
  if(typeof m.temp==="string"&&/cold|normal|hot/.test(m.temp))cst.temp=m.temp;
  /* 酸度=鲜橙份量：兼容解析结果里的 orange / pearl/coconut 等旧字段一律忽略 */
  if(typeof m.orange==="number"&&m.orange>=0&&m.orange<=3)cst.extra.orange=m.orange;
  if(typeof m.tier==="number"&&m.tier>=0&&m.tier<=3)ctx.aiTier=m.tier;
  if(typeof m.budget==="number"&&m.budget>0)ctx.targetBudget=m.budget;
}
/* 硬保险：只认用户原话里的否定，无论模型返回什么都强制执行
   “不要果汁/橙汁” → 橙汁档位强制 0（水溶C是维C饮，不在此列，除非连果味也不要） */
function applyHardBans(raw){
  var t=String(raw||"");
  var noFruit=/不要果汁|不带果汁|不加果|无果汁|别放果|不要水果|不含果|不要橙汁|不加橙汁|别放橙汁|不要橙|不加橙|不喝果汁|不要果味|不带果味/.test(t);
  var noMilk=/不要奶|不加奶|去奶|无奶|别放奶|不放奶|没奶|不喝奶/.test(t);
  var noTea=/不要茶|不加茶|无茶|别放茶|不喝茶/.test(t);
  var noIce=/去冰|不要冰|无冰|不加冰|别放冰/.test(t);
  var noSugar=/无糖|不要糖|不加糖|去糖|不要甜|不加甜/.test(t);
  if(noFruit)cst.extra.orange=0;
  if(noMilk)cst.milk=0;
  if(noIce&&cst.temp==="cold")cst.temp="normal";
  if(noSugar)cst.sugar=0;
  return {noFruit:noFruit,noMilk:noMilk,noTea:noTea,noIce:noIce,noSugar:noSugar};
}

/* ==================================================================
   页面导航框架：页面栈 stack + mount/go/back/chrome
   ================================================================== */
var stack=[];
var META={
  landing:{t:"",bar:false,noBack:true},
  home:{t:"",bar:false,noBack:true},
  daily:{t:"每日推荐"},
  ai:{t:"AI 配比"},
  history:{t:"调 配 记 录"},
  select:{t:"饮品选择"},
  config:{t:"调 配"},
  pay:{t:"收 银 台"},
  personalAi:{t:"专属调配"},
  personalHome:{t:"",bar:false,noBack:true},
  personalDb:{t:"数据库修改"},
  personalHistory:{t:"调配记录"},
  personalDone:{t:"",bar:true,noBack:true}
};
var pagesEl=document.getElementById("pages");
var navEl=document.getElementById("navbar");
function mount(name){
  var el=document.createElement("div");
  el.className="page";
  el.innerHTML=T[name]();
  pagesEl.appendChild(el);
  bind(name,el);
  return el;
}
function bind(name,p){
  if(name==="landing")bindLanding(p);
  else if(name==="home")bindHome(p);
  else if(name==="daily")bindDaily(p);
  else if(name==="ai")bindChat(p);
  else if(name==="history")bindHistory(p);
  else if(name==="select")bindSelect(p);
  else if(name==="config")bindConfig(p);
  else if(name==="pay")bindPay(p);
  else if(name==="personalAi")bindPersonalChat(p);
  else if(name==="personalHome")bindPersonalHome(p);
  else if(name==="personalDb")bindPersonalDb(p);
  else if(name==="personalHistory")bindPersonalHistory(p);
  else if(name==="personalDone")bindPersonalDone(p);
}
function chrome(name){
  document.body.classList.toggle("p-split",name==="personalAi"||name==="personalDb"||name==="personalHome");
  var m=META[name]||{t:""};
  if(m.bar===false){navEl.style.visibility="hidden";return;}
  navEl.style.visibility="visible";
  var backHTML=(stack.length>1&&!m.noBack)?'<span class="back" id="navBack">‹</span>':"";
  /* 版本按钮：有返回箭头时排在箭头右侧，无箭头时贴左 */
  var verStyle="right:auto;left:"+(backHTML?"56px":"12px")+";border-color:var(--gold);color:var(--gold)";
  var verHTML=(BUILD_MODE==="combined"&&name!=="landing")?'<span class="navrec" id="navVer" style="'+verStyle+'">版本</span>':"";
  var recHTML="";
  if(name==="ai"){
    recHTML='<span class="navrec" id="navRec">记录<span class="rn" id="navRecN">0</span></span>';
  }else if(name==="personalAi"){
    recHTML='<span class="navrec" id="navRec">记录<span class="rn" id="navRecN">'+PERSONAL.hist().length+'</span></span>';
  }
  navEl.innerHTML=verHTML+backHTML+'<span id="navtitle">'+(m.t||"")+'</span>'+recHTML;
  var b=navEl.querySelector("#navBack");
  if(b)b.onclick=back;
  var r=navEl.querySelector("#navRec");
  if(r){
    if(name==="personalAi"){
      r.onclick=function(){go("personalHistory");};
    }else{
      refreshRecBadge();r.onclick=function(){go("history");};
    }
  }
  var v=navEl.querySelector("#navVer");
  if(v)v.onclick=goLanding;
}
/* 返回选择版本页（个人/商用通用）：清空栈、复位模式 */
function goLanding(){
  while(stack.length>0){var x=stack.pop();if(x.el.parentNode)x.el.parentNode.removeChild(x.el);}
  isPersonalMode=false;
  document.body.classList.remove("p-split");
  go("landing");
}
function go(name){
  var el=mount(name);
  stack.push({name:name,el:el});
  requestAnimationFrame(function(){el.classList.add("show");});
  chrome(name);
}
function back(){
  if(stack.length<=1)return;
  var cur=stack.pop();
  cur.el.classList.remove("show");
  setTimeout(function(){if(cur.el.parentNode)cur.el.parentNode.removeChild(cur.el);},260);
  var top=stack[stack.length-1];
  chrome(top.name);
}
/* 清空栈直接回首页（扫码进入/支付后重置用） */
function resetHome(){
  var rootName=BUILD_MODE==="personal"?"personalAi":"home";
  while(stack.length>0){
    var x=stack.pop();
    if(x.el.parentNode)x.el.parentNode.removeChild(x.el);
  }
  var el=mount(rootName);stack.push({name:rootName,el:el});
  requestAnimationFrame(function(){el.classList.add("show");});
  chrome(rootName);
}

/* ---------- 首页 ---------- */
function bindHome(p){
  p.querySelectorAll(".hopt[data-go], [data-go]").forEach(function(el){
    el.onclick=function(){go(el.getAttribute("data-go"));};
  });
  var hv=p.querySelector("#homeVer");
  if(hv)hv.onclick=goLanding;
}
/* ---------- 每日推荐 ---------- */
function bindDaily(p){
  var btn=p.querySelector('[data-go="config"]');
  if(btn)btn.onclick=function(){
    var d=drinkById(ctx.drinkId);
    resetCst();
    ctx.isAI=false;ctx.aiTier=0;ctx.targetBudget=0;
    ctx.lastPrice=d.price;
    go("config");
  };
  /* 每日推荐文案：真模型现生成（失败用默认 reason 兜底），按天缓存 */
  var pitch=p.querySelector("#dailyPitch");
  if(pitch&&window.TEXTAI){
    var d=drinkById(ctx.drinkId),cacheKey="daily_pitch_"+todayStr()+"_"+d.id;
    var cached=null;try{cached=localStorage.getItem(cacheKey);}catch(e){}
    if(cached){pitch.textContent=cached;}
    else{
      TEXTAI.pitch(d.name,d.en,d.price,d.reason).then(function(txt){
        if(txt&&pitch){pitch.textContent=txt;try{localStorage.setItem(cacheKey,txt);}catch(e){}}
      }).catch(function(){});
    }
  }
}
/* ---------- 饮品选择 ---------- */
function bindSelect(p){
  p.querySelectorAll("[data-drink]").forEach(function(el){
    el.onclick=function(){
      ctx.drinkId=el.getAttribute("data-drink");
      ctx.isAI=false;ctx.aiTier=0;ctx.targetBudget=0;
      resetCst();
      ctx.lastPrice=drinkById(ctx.drinkId).price;
      go("config");
    };
  });
}
/* ---------- 调配 ---------- */
function bindConfig(p){
  function refreshSegs(){
    p.querySelectorAll(".seg[data-g]").forEach(function(seg){
      var g=seg.getAttribute("data-g");
      seg.querySelectorAll("button").forEach(function(b){
        var v=b.getAttribute("data-v");
        var on=(String(cst[g])===v);
        b.classList.toggle("on",!!on);
      });
    });
    p.querySelectorAll(".seg[data-tg]").forEach(function(seg){
      var k=seg.getAttribute("data-tg");
      seg.querySelectorAll("button").forEach(function(b){
        b.classList.toggle("on",String(cst.extra[k])===b.getAttribute("data-v"));
      });
    });
  }
  refreshSegs();
  p.querySelectorAll(".seg[data-g]").forEach(function(seg){
    seg.onclick=function(e){
      var b=e.target.closest("button");if(!b)return;
      var g=seg.getAttribute("data-g"),v=b.getAttribute("data-v");
      cst[g]=parseInt(v,10);   /* 现在只有 milk / sugar */
      if(!isPersonalMode){var pr=calcPrice();ctx.lastPrice=pr.total;}
      refreshSegs();if(!isPersonalMode)refreshSum();
    };
  });
  /* 酸度（=鲜橙份量 extra.orange）：居家版不刷价格；商用版影响小额加价 */
  p.querySelectorAll(".seg[data-tg]").forEach(function(seg){
    seg.onclick=function(e){
      var b=e.target.closest("button");if(!b)return;
      var k=seg.getAttribute("data-tg");
      cst.extra[k]=parseInt(b.getAttribute("data-v"),10);
      if(!isPersonalMode){var pr=calcPrice();ctx.lastPrice=pr.total;refreshSum();}
      refreshSegs();
    };
  });
  if(!isPersonalMode){var pr=calcPrice();ctx.lastPrice=pr.total;refreshSum();}
  var tp=p.querySelector("#toPay");
  if(tp)tp.onclick=function(){go("pay");};
  /* 个人版按钮：取消 / 记住偏好（仅保存） / 开始调配（才出杯） */
  var saveBtn=p.querySelector("#confSave");
  if(saveBtn)saveBtn.onclick=function(){
    PERSONAL.savePref({milk:cst.milk,sugar:cst.sugar,orange:cst.extra.orange,temp:cst.temp});
    var hint=p.querySelector("#confHint");
    if(hint){hint.style.display="block";}
    saveBtn.classList.add("saved");saveBtn.textContent="✓ 已记住偏好";
  };
  var startBtn=p.querySelector("#confStart");
  if(startBtn)startBtn.onclick=function(){personalFinish(p);};
  var cancelBtn=p.querySelector("#confCancel");
  if(cancelBtn)cancelBtn.onclick=function(){back();};
  var recBtn=p.querySelector("#recConfigBtn");
  if(recBtn)recBtn.onclick=function(){
    var rec=PERSONAL.calcRec();
    if(!rec)return;
    if(typeof rec.milk==="number")cst.milk=rec.milk;
    if(typeof rec.sugar==="number")cst.sugar=rec.sugar;
    if(typeof rec.orange==="number")cst.extra.orange=rec.orange;
    refreshSegs();
    recBtn.classList.add("applied");
    recBtn.textContent="✓ 已按偏好选好";
    setTimeout(function(){recBtn.classList.remove("applied");recBtn.textContent="✦ 推荐配置";},2000);
  };
}
function personalFinish(p){
  /* 个人版：跳过支付，直接出成品（仅由「开始调配」触发） */
  var ingredients={tea:true,milk:cst.milk>0,c:false,orange:cst.extra.orange>0,ice:cst.temp!=="hot"};
  /* 推断水溶C：冷的、无奶、有鲜橙时带一点维C清爽 */
  if(cst.temp==="cold"&&cst.milk===0&&cst.extra.orange>0)ingredients.c=true;
  /* 记录到个人历史 */
  PERSONAL.saveHist({
    name:ctx.aiName||"专属调配",desc:ctx.aiDesc||"",
    image:ctx.aiImg||"",temp:cst.temp,
    ingredients:ingredients,
    settings:{milk:cst.milk,sugar:cst.sugar,orange:cst.extra.orange,temp:cst.temp}
  });
  go("personalDone");
}
/* ===== 居家原料库：4 个位置（X1Y1/X1Y2/X2Y1/X2Y2），自然语言增删改查，用户看不到原始库 ===== */
var INGDB={
  key:"four_slot_storage_v1",          /* 与四格存储表页面完全一致：小写坐标 + 同键 */
  legacyKey:"dm_home_ingdb_v1",
  slots:["X1Y1","X1Y2","X2Y1","X2Y2"],
  low:function(slot){return String(slot).toLowerCase();},
  migrated:false,
  migrateOnce:function(){
    if(this.migrated)return;this.migrated=true;
    try{
      var has=localStorage.getItem(this.key);
      if((has===null||has==="{}")&&localStorage.getItem(this.legacyKey)){
        var lo=JSON.parse(localStorage.getItem(this.legacyKey)||"{}"),no={};
        this.slots.forEach(function(sl){var v=lo[sl];if(v)no[sl.toLowerCase()]=v;});
        localStorage.setItem(this.key,JSON.stringify(no));
      }
    }catch(e){}
  },
  load:function(){this.migrateOnce();
    try{var o=JSON.parse(localStorage.getItem(this.key)||"{}");return o&&typeof o==="object"?o:{};}catch(e){return {};}},
  save:function(o){try{localStorage.setItem(this.key,JSON.stringify(o));}catch(e){}},
  list:function(){var o=this.load();return this.slots.map(function(sl){return {slot:sl,name:(o[sl.toLowerCase()]||"").trim()};}).filter(function(x){return x.name;});},
  count:function(){return this.list().length;},
  emptySlots:function(){var o=this.load();return this.slots.filter(function(sl){return !(o[sl.toLowerCase()]||"").trim();});},
  slotOfName:function(name){name=(name||"").trim();var o=this.load();
    for(var i=0;i<this.slots.length;i++){if((o[this.slots[i].toLowerCase()]||"").trim()===name)return this.slots[i];}return "";},
  getAt:function(slot){var o=this.load();return (o[this.low(slot)]||"").trim();},
  addAt:function(slot,name){var o=this.load();o[this.low(slot)]=name;this.save(o);},
  removeAt:function(slot){var o=this.load();delete o[this.low(slot)];this.save(o);},
  clear:function(){this.save({x1y1:"",x1y2:"",x2y1:"",x2y2:""});}
};
function _cnNum(t){if(/一|1|第一个|一号/.test(t))return 1;if(/二|2|两个?|第二个|二号/.test(t))return 2;return 0;}
function _parseSlot(t){
  var m=/x\s*([12])\s*y\s*([12])/i.exec(t);
  if(m)return "X"+m[1]+"Y"+m[2];
  /* 第N个（位置/格子/原料/槽）→ 按 X1Y1,X1Y2,X2Y1,X2Y2 顺序 */
  var om=/第\s*([一二两三四1-4])\s*个(?:位置|格子|原料|槽|位)?/.exec(t);
  if(om){var mm={"一":1,"二":2,"两":2,"三":3,"四":4};var oi=/[1-4]/.test(om[1])?parseInt(om[1],10):mm[om[1]];
    if(oi>=1&&oi<=4)return ["X1Y1","X1Y2","X2Y1","X2Y2"][oi-1];}
  var row=_cnNum(/第二行|下行|下面那行|下边/.test(t)?("2"):(/第一行|上行|上面那行|上边/.test(t)?("1"):""));
  var col=_cnNum(/第二列|第二格|右边/.test(t)?("2"):(/第一列|第一格|左边/.test(t)?("1"):""));
  if(row&&col)return "X"+row+"Y"+col;
  return "";
}
var ING_ALIAS={
  "东方树叶":"东方树叶","茉莉花茶":"茉莉花茶","红茶":"红茶","绿茶":"绿茶","乌龙茶":"乌龙茶","茶":"东方树叶",
  "牛奶":"牛奶","纯牛奶":"牛奶","鲜奶":"牛奶","奶":"牛奶","燕麦奶":"燕麦奶","椰奶":"椰奶","豆奶":"豆奶",
  "橙汁":"橙汁","鲜橙汁":"橙汁","橙子":"橙汁","橙":"橙汁","橘子汁":"橙汁","橘汁":"橙汁",
  "水溶c":"水溶C","水溶c100":"水溶C","c100":"水溶C","维生素c":"水溶C","维c":"水溶C",
  "蜂蜜":"蜂蜜","糖浆":"糖浆","糖":"糖","气泡水":"气泡水","苏打水":"苏打水","水":"水","矿泉水":"水","冰水":"冰水"
};
var _ING_KEYS=Object.keys(ING_ALIAS).sort(function(a,b){return b.length-a.length;});
function _isQuantWord(w){return /^[一二两三四五六七八九十0-9]+$/.test(w||"");}
function _cn2num(w){
  var m={"一":1,"二":2,"两":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10};
  if(/^[0-9]+$/.test(w))return parseInt(w,10);
  return m[w]||0;
}
function _normIng(name){
  name=(name||"").replace(/[\s,，。、的个瓶杯一份点儿啊呀吧啦呢吗]/g,"").trim();
  if(!name)return "";
  for(var i=0;i<_ING_KEYS.length;i++){if(name===_ING_KEYS[i])return ING_ALIAS[_ING_KEYS[i]];}
  for(var j=0;j<_ING_KEYS.length;j++){if(name.indexOf(_ING_KEYS[j])>=0)return ING_ALIAS[_ING_KEYS[j]];}
  return name;
}
function _extractName(t){
  var m=/把([一-龥A-Za-z0-9]{1,8}?)(?:改成|换成|改为|替换成)/.exec(t);
  if(m&&m[1])return _normIng(m[1]);
  m=/(?:改成|换成|改为|替换成)([一-龥A-Za-z0-9]{1,8})/.exec(t);
  if(m&&m[1])return _normIng(m[1]);
  /* 先扫别名库（长 key 优先），保证“水溶c / 维c”等带字母也能命中 */
  for(var ai=0;ai<_ING_KEYS.length;ai++){if(t.indexOf(_ING_KEYS[ai])>=0)return ING_ALIAS[_ING_KEYS[ai]];}
  m=/(?:加|放|添|新增|添加|来|要)(?:上|进|到)?[一-龥A-Za-z0-9]{0,6}?([一-龥A-Za-z0-9]{2,8})(?:进去|一下)?$/.exec(t);
  if(m){return _normIng(m[1]);}
  var g=t.match(/[一-龥A-Za-z0-9]{2,6}/g)||[];
  var stop=["数据库","原料","位置","删除","新增","修改","换成","添加","增加","去掉","不要","换成","第一个","第二个","已经","现在","帮我","可以","一下","什么","怎么","看看","里面","还有","多少"];
  for(var i=g.length-1;i>=0;i--){var w=_normIng(g[i]);if(w&&stop.indexOf(w)<0&&!/[删改加新增减替查看看位置个]/.test(w))return w;}
  return "";
}
/* ===== 一句话多原料解析：支持 顿号/逗号/和/跟/与/还有/以及，识别任意“X汁/X水/X奶”等 ===== */
var _ING_STOP=["数据库","原料","位置","删除","删掉","新增","修改","换成","替换","添加","增加","去掉","不要","移除","清空","已经","现在","帮我","可以","一下","什么","怎么","看看","里面","还有","以及","多少","一瓶","一点","一些","几个","这个","那个","一种","三种","四种","五种","两个","我们","你们","他们","请问","优先","需要","想要","饮料","东西","菜单","记录","全部","所有"];
var _ING_SHORT={ "奶":"牛奶","橙":"橙汁","茶":"东方树叶","糖":"糖","水":"水" };
var _QTY_WORDS="个瓶杯份盅罐盒袋点些款种口把";
/* 剥掉动作/数量/量词/语气，得到核心名词；不判断它“像不像饮料”，用户说加什么就加什么 */
function _cleanItem(w){
  if(!w)return "";
  w=w.replace(new RegExp("[一二两三四五六七八九十0-9]+\\s*["+_QTY_WORDS+"]","g"),"");
  w=w.replace(/[一二两三四五六七八九十0-9]/g,"");
  var prev;
  do{ prev=w;
    w=w.replace(/^(请|帮我|给我|我要|我想|想要|我|你|它|这|那)/,"");
    w=w.replace(new RegExp("^["+_QTY_WORDS+"]+"),"");
    w=w.replace(/^(加上|加点|加些|加一?|添加|添上|添点|新增|增加|放上|放点|放些|放入|放进|放一?|来一?|来点|来个|来份|删掉|删除|删去|删点|去掉|不要|移除|换成|改成|替换成|把|将|拿|再|还|又|上|进|去)/,"");
  }while(w!==prev&&w.length);
  w=w.replace(new RegExp("["+_QTY_WORDS+"]+$"),"");
  w=w.replace(/[了着过吧啊呀呢哦嘛的]+$/,"").trim();
  return w;
}
/* 只要剥出来是个正经名词就接受（含煎饺、白菜等任意物）；纯数量/量词/动作/单生字不接受 */
function _isValidItem(w){
  if(!w)return false;
  if(w.length<1||w.length>8)return false;
  if(/^[一二两三四五六七八九十0-9]+$/.test(w))return false;
  if(new RegExp("^["+_QTY_WORDS+"]+$").test(w))return false;
  if(_ING_STOP.indexOf(w)>=0)return false;
  if(/^(加|添|新增|添加|增加|放|来|要|补|删|去掉|不要|换|改成|换成|把|将|给|想|还有|以及|再|还|又|个|瓶|杯|份|点|些|种)$/.test(w))return false;
  /* 单字只接受已知单字别名（奶水茶糖橙），避免误吞动作残留 */
  if(w.length===1&&!_ING_SHORT[w])return false;
  return true;
}
function _normItem(w){
  w=_cleanItem(w);
  for(var i=0;i<_ING_KEYS.length;i++){if(w===_ING_KEYS[i])return ING_ALIAS[_ING_KEYS[i]];}
  /* 长别名子串（含水溶c）：按长度优先 */
  var lk=_ING_KEYS.filter(function(k){return k.length>=2;}).sort(function(a,b){return b.length-a.length;});
  for(var j=0;j<lk.length;j++){if(w.indexOf(lk[j])>=0)return ING_ALIAS[lk[j]];}
  return w;
}
function _extractIngredients(t){
  var found=[];
  function push(raw){
    var w=_cleanItem(raw);
    if(!_isValidItem(w))return;
    var std=_normItem(w);
    if(std&&found.indexOf(std)<0)found.push(std);
  }
  /* 1) 长别名先 mask（水溶C/燕麦奶/东方树叶等），保证归一且不被单字吞 */
  var work=t, masks=[];
  function maskRange(a,b,std){var ph="@"+masks.length+"@";masks.push(std);work=work.slice(0,a)+ph+work.slice(b);}
  _ING_KEYS.filter(function(k){return k.length>=2;}).sort(function(a,b){return b.length-a.length;}).forEach(function(key){
    var at=work.indexOf(key);
    while(at>=0){ if(work[at]!=="@"){maskRange(at,at+key.length,ING_ALIAS[key]);} at=work.indexOf(key); }
  });
  /* 2) 单字别名：独立词边界才认（奶/橙/茶/糖/水），避免“水溶C”被“水”吞 */
  Object.keys(_ING_SHORT).forEach(function(ch){
    var re=new RegExp("(^|[^一-龥A-Za-z0-9@])"+ch+"(?=$|[^一-龥A-Za-z0-9])","g"),m;
    while((m=re.exec(work))){var at=m.index+(m[1]?1:0);if(work[at]!=="@"){maskRange(at,at+1,_ING_SHORT[ch]);re.lastIndex=0;}}
  });
  /* 3) 在“动作动词之后”的列举区里，按 分隔符 和 数词+量词 切分，逐段取名词 */
  var segs=work.split(/[、,，。；;和跟与]|还有|以及/g);
  segs.forEach(function(seg){
    /* 先还原这段里命中的别名 */
    seg.replace(/@(\d+)@/g,function(m,d){found.indexOf(masks[parseInt(d,10)])<0&&found.push(masks[parseInt(d,10)]);return "";});
    var rest=seg.replace(/@\d+@/g," ");
    /* 按“数词+量词”再切：一个橙汁 / 一个煎饺 → 橙汁 / 煎饺 */
    var parts=rest.split(new RegExp("[一二两三四五六七八九十0-9]+\\\\s*["+_QTY_WORDS+"]?","g"));
    parts.forEach(function(pa){
      /* 去掉残留动作前缀 */
      pa=pa.replace(/^(请|帮我|给我|我要|我想|想要|我|再|还|又|来|去|加|添|放|点|要|把|将)/,"").trim();
      var cand=_cleanItem(pa);
      if(_isValidItem(cand))push(cand);
    });
  });
  return found;
}
function _dbReply(t){
  t=String(t||"");
  var items=INGDB.list(), cnt=items.length;
  function names(){return INGDB.list().map(function(x){return x.name;}).join("、");}
  function tailHint(){return INGDB.count()<2?"记得哦，少于 2 种我可调不出一杯，要不再补一种？":(INGDB.count()<4?"还能再加 "+(4-INGDB.count())+" 种。":"4 个位置都安排得满满的。");}
  function afterHint(){return INGDB.count()<2?"对啦，光一种我可调不出一杯哦，至少要 2 种，再补一种吧～":(INGDB.count()<4?"还能再加 "+(4-INGDB.count())+" 种。":"4 个位置都满啦，想换新的得先删一种哦。");}
  /* 查询 */
  if(/有什么|有哪些|有多少|看一下|看看|列一下|现在的|都有啥|什么原料|查看|清单|列表/.test(t)&&!/删|改|换|加|添|不要/.test(t)){
    if(!cnt)return "现在 4 个位置都还空着哦～你直接告诉我「加点牛奶」「加橙汁」，我就帮你安排上。";
    var extra=cnt<2?"对啦，至少要有 2 种原料我才调得出一杯，再补一种吧～":(cnt<4?"还可以再加 "+(4-cnt)+" 种。":"4 个位置都满啦。");
    return "现在为你备着的原料有：<b>"+names()+"</b>，共 "+cnt+" 种。"+extra;
  }
  /* 删除（支持一句话删多个：删掉A、B和C） */
  if(/删|去掉|不要|移除|拿走|清空/.test(t)){
    if(/全部|清空|都删|所有/.test(t)){if(!cnt)return "本来就是空的啦，4 个位置都没放东西～";INGDB.clear();return "好啦，4 个位置我都帮你清空了，现在可以重新放你想喝的原料啦。";}
    var delNames=_extractIngredients(t), delSlot=_parseSlot(t);
    /* 指定位置删除 */
    if(!delNames.length&&delSlot){
      var ds=INGDB.getAt(delSlot);
      if(!ds)return delSlot+" 这个位置现在就是空的，没东西可删哦～";
      INGDB.removeAt(delSlot);
      return "已经把 "+delSlot+" 的 <b>"+ds+"</b> 撤下来啦。现在还有 "+INGDB.count()+" 种原料。"+tailHint();
    }
    if(!delNames.length){
      if(!cnt)return "现在库里还没有原料哦，想删也没东西可删～不如先告诉我你想加点什么？";
      return "你想删掉哪一个呀？现在有 <b>"+names()+"</b>，告诉我名字或位置（比如“删掉牛奶”）就行，也可以一次说多个。";
    }
    var gone=[], miss=[];
    delNames.forEach(function(nm){
      var sl=INGDB.slotOfName(nm);
      if(sl){INGDB.removeAt(sl);gone.push(nm);}else miss.push(nm);
    });
    var msg="";
    if(gone.length)msg+="已经帮你撤下：<b>"+gone.join("、")+"</b>。";
    if(miss.length)msg+="不过 <b>"+miss.join("、")+"</b> 现在库里没有哦。";
    msg+="现在还剩 "+INGDB.count()+" 种。"+tailHint();
    return msg;
  }
  /* 修改（把 A 改成 B / A 换成 B） */
  if(/改成|换成|改为|替换|变/.test(t)){
    var fromM=/把([一-龥A-Za-z0-9]{1,8}?)(?:改成|换成|改为|替换成)/.exec(t);
    var toM=/(?:改成|换成|改为|替换成)([一-龥A-Za-z0-9]{1,8})/.exec(t);
    var slotM=_parseSlot(t), fromName=fromM?_normIng(fromM[1]):"", toName=toM?_normIng(toM[1]):"";
    var slot2=slotM||(fromName?INGDB.slotOfName(fromName):"");
    if(!slot2)return "你想改哪个位置或哪种原料呀？比如“把牛奶换成燕麦奶”，或者“X1Y1 改成橙汁”。";
    var cur=INGDB.getAt(slot2);
    if(!cur)return slot2+" 这个位置现在是空的，没有东西可改哦～直接告诉我想加什么就行。";
    if(!toName)return "想把 <b>"+cur+"</b> 换成什么呀？说一声我就给你换上。";
    var occ=INGDB.slotOfName(toName);
    if(occ&&occ!==slot2)return toName+" 已经在 "+occ+" 啦，一种原料放一个位置就够咯，换一个别的试试？";
    INGDB.addAt(slot2,toName);
    return "好嘞，已经把 "+slot2+" 的 <b>"+cur+"</b> 换成 <b>"+toName+"</b> 了。现在备着："+INGDB.list().map(function(x){return x.name;}).join("、")+"。";
  }
  /* 新增（支持一次加多个，逐个报告位置；空位不够则一个都不加，反问优先级/先删谁） */
  if(/加|添|新增|添加|增加|放|来|要|补/.test(t)){
    /* “加五个/加5种”这类数量超过 4，直接高情商拒绝 */
    var qm=/([一二两三四五六七八九十0-9]+)\s*(个|种|瓶|杯)?/.exec(t.replace(/第[一二三四五六七八九十0-9]+(行|列|格|个)/g,""));
    if(qm){var qv=_cn2num(qm[1]);
      if(qv>4)return "哈哈，我也想给你多备点，可家里这台一共只有 <b>4 个位置</b>（X1Y1、X1Y2、X2Y1、X2Y2），第 "+qm[1]+" 个实在放不下啦～你挑最想喝的 4 种告诉我就行，多一种都得先删掉一种腾位置。";
    }
    var want=_extractIngredients(t);
    var addSlot=_parseSlot(t);
    if(!want.length)return "你想加点什么原料呀？可以一次说多个，比如“加黄瓜汁、西瓜汁和胡萝卜汁”，我逐个帮你安排进 4 个位置里。";
    /* 过滤掉已存在的 */
    var fresh=want.filter(function(nm){return !INGDB.slotOfName(nm);});
    var dup=want.filter(function(nm){return INGDB.slotOfName(nm);});
    if(!fresh.length){
      return want.map(function(nm){return "「"+nm+"」已经在 "+INGDB.slotOfName(nm)+" 啦";}).join("；")+"。一种原料放一个位置就够咯～现在备着："+INGDB.list().map(function(x){return x.name;}).join("、")+"。";
    }
    /* 指定了单个位置：只处理一个原料的放入/替换 */
    if(addSlot){
      if(fresh.length===1&&want.length===1){
        var nm0=fresh[0], cur0=INGDB.getAt(addSlot);
        INGDB.addAt(addSlot,nm0);
        if(cur0)return "好嘞，"+addSlot+" 原来的 <b>"+cur0+"</b> 我直接给你换成 <b>"+nm0+"</b> 了。现在备着："+INGDB.list().map(function(x){return x.name;}).join("、")+"。";
        return "已经把 <b>"+nm0+"</b> 安排到 <b>"+addSlot+"</b> 啦～"+afterHint();
      }
    }
    var empty=INGDB.emptySlots();
    /* 空位不够：一个都不加，反问 */
    if(fresh.length>empty.length){
      var which=fresh.join("、");
      if(empty.length===0){
        return "哎呀，4 个位置（X1Y1、X1Y2、X2Y1、X2Y2）<b>都已经放满了</b>，所以这"+(fresh.length>1?"几个":"个")+"（"+which+"）我<b>先一个都没加</b>。你想怎么安排？<br>· 告诉我<b>优先加哪一个</b>，我把它换到某个位置；<br>· 或者先让我<b>删掉</b>一种现有的（现在有："+names()+"），腾了位置我再补。";
      }
      return "你要加的有 <b>"+fresh.length+"</b> 种（"+which+"），可现在只剩 <b>"+empty.length+"</b> 个空位置（"+empty.join("、")+"），放不下，所以这几个我<b>先一个都没加</b>。请问你想<b>优先加哪"+(fresh.length>1?"些":"个")+"</b>？或者先让我<b>删掉</b>一种腾位置（现在有："+names()+"），你定，我照办。";
    }
    /* 空位够：按空位顺序逐个放入，并逐个报告位置 */
    var report=[];
    fresh.forEach(function(nm,idx){
      var slot=empty[idx];
      INGDB.addAt(slot,nm);
      report.push("<b>"+nm+"</b> 加到了 <b>"+slot+"</b>");
    });
    var msg="好嘞，已经帮你安排好："+report.join("；")+"。";
    if(dup.length)msg+="（另外 "+dup.join("、")+" 本来就在库里，就没重复放啦）";
    msg+="<br>现在一共 "+INGDB.count()+" 种原料。"+afterHint();
    return msg;
  }
  /* 兜底引导 */
  return "这里是你的原料库管理，一共就 4 个位置。你可以直接说：<br>· “加点牛奶”——新增原料<br>· “把牛奶换成燕麦奶”——修改<br>· “删掉橙汁”——删除<br>· “现在有什么”——查看<br>我都听得懂，帮你安排得明明白白。"+(cnt?"<br>目前库里有：<b>"+names()+"</b>。":"");
}
/* ---------- 选择版本落地页 ---------- */
function bindLanding(p){
  var gP=p.querySelector("#goPersonal");
  var gC=p.querySelector("#goCommercial");
  if(gP)gP.onclick=function(){isPersonalMode=true;go("personalAi");};
  if(gC)gC.onclick=function(){isPersonalMode=false;go("home");};
}
/* ---------- 个人版入口菜单 ---------- */
function bindPersonalHome(p){
  var m=p.querySelector("#goMix"),db=p.querySelector("#goDb");
  if(m)m.onclick=function(){isPersonalMode=true;go("personalAi");};
  if(db)db.onclick=function(){isPersonalMode=true;go("personalDb");};
}
/* 回到个人版入口（清栈） */
function resetToPersonalHome(){
  while(stack.length>0){var x=stack.pop();if(x.el.parentNode)x.el.parentNode.removeChild(x.el);}
  var el=mount("personalHome");stack.push({name:"personalHome",el:el});
  requestAnimationFrame(function(){el.classList.add("show");});
  chrome("personalHome");
}
/* ---------- 个人版·数据库修改聊天 ---------- */
function bindPersonalDb(p){
  var list=p.querySelector("#chatlist"),input=p.querySelector("#chatinput");
  var sh=p.querySelector("#sideHome");if(sh)sh.onclick=resetToPersonalHome;
  var sr=p.querySelector("#sideRec");if(sr)sr.onclick=function(){go("personalHistory");};
  /* —— 四格表弹窗：与外部四格表同键 four_slot_storage_v1，双向同步 —— */
  var mask=p.querySelector("#gridMask");
  function openGrid(){
    var body=p.querySelector("#gridBody");body.innerHTML="";
    INGDB.slots.forEach(function(sl){
      var tr=document.createElement("tr");
      var td1=document.createElement("td");td1.className="gcoord";td1.textContent=sl.toLowerCase();
      var td2=document.createElement("td");td2.className="gcell";td2.setAttribute("contenteditable","true");
      td2.textContent=INGDB.getAt(sl);
      td2.addEventListener("input",function(){
        var o=INGDB.load();o[sl.toLowerCase()]=td2.textContent.trim();INGDB.save(o);
        var tip=p.querySelector("#gridSaved");tip.classList.add("on");setTimeout(function(){tip.classList.remove("on");},1000);
        updateCount();
      });
      tr.appendChild(td1);tr.appendChild(td2);body.appendChild(tr);
    });
    updateCount();mask.classList.add("show");
  }
  function updateCount(){var gc=p.querySelector("#gridCount");if(gc)gc.textContent="当前 "+INGDB.count()+" / 4 种";}
  var sg=p.querySelector("#sideGrid");if(sg)sg.onclick=openGrid;
  var gcBtn=p.querySelector("#gridClose");if(gcBtn)gcBtn.onclick=function(){mask.classList.remove("show");};
  if(mask)mask.addEventListener("click",function(e){if(e.target===mask)mask.classList.remove("show");});
  var gr=p.querySelector("#gridReset");
  if(gr)gr.onclick=function(){
    if(confirm("清空四个格子填写的内容？")){INGDB.clear();mask.classList.remove("show");
      setTimeout(function(){var m=add("ai","<span class=\"typing\"><i></i><i></i><i></i></span>");
        m.querySelector(".cb").innerHTML="好啦，四个格子都清空了，现在可以重新放你想喝的原料啦～";list.scrollTop=list.scrollHeight;},60);}
  };
  function add(role,html){var d=document.createElement("div");d.className="cmsg "+role;
    d.innerHTML=(role==="ai"?'<div class="cai-av" style="background:rgba(255,255,255,.6)">🗂️</div>':'')+'<div class="cb">'+html+'</div>';
    list.appendChild(d);list.scrollTop=list.scrollHeight;return d;}
  function say(html){var m=add("ai",'<span class="typing"><i></i><i></i><i></i></span>');var e=m.querySelector(".cb");
    setTimeout(function(){e.innerHTML=html;list.scrollTop=list.scrollHeight;},460);}
  function send(){
    var t=input.value.trim();if(!t)return;
    add("user",esc(t));input.value="";
    setTimeout(function(){say(_dbReply(t));},120);
  }
  p.querySelector("#chatsend").onclick=send;
  input.addEventListener("keydown",function(e){if(e.key==="Enter")send();});
  _bindVoice(p);
  _watchChat(p);
  var n=INGDB.count();
  say("这里是你的<b>原料库</b>管理，一共就 4 个位置，我帮你记着。<br>直接说就行，比如“加牛奶”“把橙汁换成水溶C”“删掉红茶”“现在有什么”。"+
    (n?"<br>现在库里有：<b>"+INGDB.list().map(function(x){return x.name;}).join("、")+"</b>。":"<br>现在 4 个位置都还空着，先告诉我想加点什么吧～"));
}
/* ---------- 个人版聊天 ---------- */
function bindPersonalChat(p){
  var list=p.querySelector("#chatlist"),input=p.querySelector("#chatinput");
  var sv=p.querySelector("#sideVer");if(sv)sv.onclick=function(){
    while(stack.length>0){var x=stack.pop();if(x.el.parentNode)x.el.parentNode.removeChild(x.el);}
    isPersonalMode=false;go("landing");
  };
  var sr=p.querySelector("#sideRec");if(sr)sr.onclick=function(){go("personalHistory");};
  var shm=p.querySelector("#sideHome");if(shm)shm.onclick=resetToPersonalHome;
  function add(role,html){var d=document.createElement("div");d.className="cmsg "+role;
    d.innerHTML=(role==="ai"?'<div class="cai-av" style="background:rgba(255,255,255,.6);backdrop-filter:blur(8px)">🌸</div>':'')+'<div class="cb">'+html+'</div>';
    list.appendChild(d);list.scrollTop=list.scrollHeight;return d;}
  function say(html,cb){var m=add("ai",'<span class="typing"><i></i><i></i><i></i></span>');var e=m.querySelector(".cb");
    setTimeout(function(){e.innerHTML=html;list.scrollTop=list.scrollHeight;if(cb)cb(e);},560);}
  function esc2(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function thinkingBubble(){var m=add("ai",'<span class="typing"><i></i><i></i><i></i></span>');return m.querySelector(".cb");}
  /* —— 个人版专属文案：高情商、多维度（短引/为什么为你调/三层风味/这杯的好） —— */
  var PER_LEADS=[
    "这么特别的要求，值得我为你单独调一杯。",
    "懂了——这一杯，我只按你的喜好来配。",
    "没有第二杯和它一样，因为它是为你此刻调的。",
    "你的口味值得被认真对待，我重新为你起一杯。",
    "这个想法很妙，我把它原原本本调成了一杯。",
    "别人喝不到的味道，今天专属于你。",
    "收到你的小挑剔了，刚刚好的那杯，为你现调。",
    "不用迁就任何菜单，这杯完全照你说的来。"];
  var PER_LEAD_USED=[];
  function perLead(raw){
    var t=raw||"";
    function pick(arr){var av=arr.filter(function(x){return PER_LEAD_USED.indexOf(x)<0;});
      if(!av.length){av=arr.slice();}
      var s=av[Math.floor(Math.random()*av.length)];PER_LEAD_USED.push(s);
      if(PER_LEAD_USED.length>24)PER_LEAD_USED.shift();return s;}
    var hints=[];
    var _noTea=noTeaRequested(t);
    if(/不要果汁|不喝果汁|不要橙|不加橙/.test(t))hints.push("去掉果汁");
    if(/不要奶|不喝奶|无奶/.test(t))hints.push("不放奶");
    if(!_noTea&&/少量茶|茶少|淡/.test(t))hints.push("淡淡的茶底");
    if(!_noTea&&/浓茶|多茶|提神|困/.test(t))hints.push("提得起神的浓茶");
    if(_noTea)hints.push("不放茶底");
    if(/多奶|双倍奶|厚乳/.test(t))hints.push("厚厚一层奶香");
    if(/少糖|无糖|不甜/.test(t))hints.push("收着点甜");
    if(/热|暖|烫/.test(t))hints.push("暖到胃里的温度");
    if(/清爽|解腻|解渴/.test(t))hints.push("清清爽爽");
    if(/累|疲惫|治愈|放松|犒劳|难[过受]|郁闷|压力/.test(t))hints.push("哄一哄今天的你");
    var lead;
    if(hints.length){
      lead=pick([
        "你想要的是"+hints[0]+"——这么具体的喜好，值得我为你单独调这一杯。",
        "懂了，"+hints[0]+"，我把分寸都替你拿捏好，这一杯只属于你。",
        "特别的你，值得一杯"+hints[0]+"的现调，我这就为你配。"]);
    }else lead=pick(PER_LEADS);
    return lead;
  }
  /* 复用多维度本地文案：严格按真实 cst 与原话茶量，个人专属短引 */
  function perLocalCopy(c2,raw){
    var lc=buildLocalCopy({milk:cst.milk,sugar:cst.sugar,acid:cst.extra?cst.extra.orange:0,
      teaLv:teaStrengthFrom(raw),hot:c2&&c2.temp==="hot",hasTea:!noTeaRequested(raw)&&!!_pStock().tags.tea});
    return {lead:perLead(raw),why:lc.why,layers:lc.layers,benefit:lc.benefit};
  }
  /* 个人版AI出图后展示结果，点"开始"进config */
  function personalPresentOrder(box,rawText,name,desc,c,apology,svc){
    svc=svc||{};
    _pClampCst();
    var lc=perLocalCopy(c,rawText);
    if(!svc.lead)svc.lead=lc.lead;
    if(!svc.why)svc.why=lc.why;
    if(!(svc.layers&&svc.layers.length))svc.layers=lc.layers;
    if(!svc.benefit)svc.benefit=lc.benefit;
    if(!svc.temp)svc.temp=c.temp;
    /* 本地兜底：开场产品介绍现场生成，每杯不一样、严格按真实配方与情绪，不复用历史 desc */
    svc.desc=buildProductIntro({milk:cst.milk,sugar:cst.sugar,acid:cst.extra?cst.extra.orange:0,
      teaLv:teaStrengthFrom(rawText),hot:(svc.temp||c.temp)==="hot"},rawText);
    desc=svc.desc;
    ctx.isAI=true;ctx.aiName=esc2(name);ctx.aiDesc=esc2(desc);
    ctx.aiLead=svc.lead?esc2(svc.lead):"";
    ctx.aiWhy=svc.why?esc2(svc.why):"";
    ctx.aiMeaning=svc.meaning?esc2(svc.meaning):"";
    ctx.aiBenefit=svc.benefit?esc2(svc.benefit):"";
    ctx.aiLayers=(svc.layers&&svc.layers.map)?svc.layers.map(function(x){return esc2(x);}):[];
    var temp=(svc&&svc.temp)||c.temp;
    var svcImg=(svc&&svc.image&&svc.image.url)?svc.image.url:"";
    ctx.aiImg=svcImg||c.img;ctx.aiType=temp;
    /* 出图：无后端时用staticPick */
    var ingredients;
    if(svc&&svc.ingredients&&typeof svc.ingredients==="object"){
      ingredients={tea:svc.ingredients.tea!==false&&!noTeaRequested(rawText),milk:!!svc.ingredients.milk,c:!!svc.ingredients.c,orange:!!svc.ingredients.orange,ice:svc.ingredients.ice!==false&&temp!=="hot"};
    }else{
      var tl2=rawText.toLowerCase();
      var noMilk2=/不要奶|不加奶|去奶|无奶/.test(tl2);
      var noFruit2=/不要果汁|不加果|无果汁|不要橙|不加橙|不喝果汁/.test(tl2);
      var wantMilk2=!noMilk2&&/奶|拿铁|牛乳|丝滑|醇厚/.test(tl2);
      var wantOrange2=!noFruit2&&/橙|橘|维\s*c|水溶|果味|果汁/.test(tl2);
      var wantC2=!noFruit2&&/水溶|c100|维c|清爽|清新|解腻/.test(tl2);
      ingredients={tea:!noTeaRequested(rawText),milk:wantMilk2,c:wantC2,orange:wantOrange2,ice:temp!=="hot"};
    }
    _pClampIng(ingredients);
    if(!svcImg){var seed=seedOf(rawText+name);var localImg=staticPick(ingredients,temp,seed);ctx.aiImg=localImg;}
    ctx.aiFlavor=buildFlavor(rawText);
    box.innerHTML=(apology?'<p style="margin:0 0 10px;line-height:1.6">'+esc2(apology)+'</p>':"")+aiPrevHTML();
    list.scrollTop=list.scrollHeight;
    /* 绑定按钮 */
    /* 绑定按钮：本杯快照冻结，连续配多杯时点哪张卡片就恢复哪杯 */
    var st=box.querySelector("#aiStart"),rj=box.querySelector("#aiReject");
    var psnap={milk:cst.milk,sugar:cst.sugar,orange:cst.extra?cst.extra.orange:2,temp:temp,
      name:ctx.aiName,desc:ctx.aiDesc,lead:ctx.aiLead,why:ctx.aiWhy,benefit:ctx.aiBenefit,
      layers:ctx.aiLayers,img:ctx.aiImg};
    if(st)st.onclick=function(){
      resetCst(psnap.temp);
      cst.milk=psnap.milk;cst.sugar=psnap.sugar;cst.extra.orange=psnap.orange;cst.temp=psnap.temp;
      ctx.isAI=true;ctx.aiName=psnap.name;ctx.aiDesc=psnap.desc;ctx.aiLead=psnap.lead;
      ctx.aiWhy=psnap.why;ctx.aiBenefit=psnap.benefit;ctx.aiLayers=psnap.layers;
      ctx.aiImg=psnap.img;ctx.aiType=psnap.temp;
      personalFinish(null);
    };
    var pv=box.querySelector("#aiSavePref");
    if(pv)pv.onclick=function(){
      PERSONAL.savePref({milk:psnap.milk,sugar:psnap.sugar,orange:psnap.orange,temp:psnap.temp});
      this.classList.add("saved");this.textContent="✓ 已记住，以后照这个来";
      flavorToast("已记住你的口味，下次默认这么调～");
    };
    if(rj)rj.onclick=function(){var rs=["没关系，这杯先撤下～再告诉我你想要的感觉，我重新为你调一杯。","收到，我们换一个。想更清爽、更温柔，还是换个温度？你说，我来配。","好呀，重新来过。把此刻的心情或挑剔都讲给我，这一杯我专门为你调。"];say(rs[Math.floor(Math.random()*rs.length)]);};
    var imL=box.querySelector("#genImg");if(imL)imL.src=ctx.aiImg;
  }
  function send(){
    var t=input.value.trim();if(!t)return;
    add("user",esc2(t));input.value="";
    var box=thinkingBubble();
    var __gate=_pGate(t);
    if(__gate){box.innerHTML=esc2(__gate).replace(/\n/g,"<br>");list.scrollTop=list.scrollHeight;return;}
    DRINKAI.order(t).then(function(raw){
      var d=raw?DRINKAI.shape(raw,t):null;
      if(d&&d.ai&&d.order){
        var c=classify(t);var temp=d.temp||c.temp;resetCst(temp);if(temp)cst.temp=temp;applySavedPref();
        applyMods(d.mods);applyHardBans(t);if(d.price)ctx.aiPrice=d.price;
        personalPresentOrder(box,t,d.name||globalMakeName(t),d.desc||c.desc,c,d.apology,d);return;
      }
      if(d&&d.ai&&d.order===false){box.innerHTML=esc2(d.reply||chatReply(t)).replace(/\n/g,"<br>");list.scrollTop=list.scrollHeight;return;}
      TEXTAI.understand(t).then(function(u){
        var isOrder,aiName,aiDesc,replyText,mods;
        if(u&&u.ai){isOrder=u.order;aiName=u.name;aiDesc=u.desc;replyText=u.reply;mods=u.mods;}
        else{var intent=detectIntent(t);isOrder=intent.order;replyText=intent.reply||"";if(isOrder)mods=parseMods(t);}
        if(isOrder){var c2=classify(t);resetCst(c2.temp);if(c2.temp)cst.temp=c2.temp;applySavedPref();applyMods(mods);applyHardBans(t);
          personalPresentOrder(box,t,aiName||globalMakeName(t),aiDesc||c2.desc,c2,u&&u.apology);
        }else{box.innerHTML=esc2(replyText||chatReply(t)).replace(/\n/g,"<br>");list.scrollTop=list.scrollHeight;}
      });
    });
  }
  p.querySelector("#chatsend").onclick=send;
  input.addEventListener("keydown",function(e){if(e.key==="Enter")send();});
  _bindVoice(p);
  _watchChat(p);
  var welcomes=["嗨，欢迎光临你的专属调配间 ✿<br>今天想喝一杯什么样的？把感觉、口味或是此刻的心情告诉我，我来为你慢慢调好。",
    "你好呀，很高兴见到你 🌸<br>这里的每一杯都只为你一个人而调。说一句话，我们就开始吧。",
    "欢迎回来～<br>今天的你，想被一杯什么味道接住？清爽的、温柔的，还是浓郁一点的？",
    "嗨，欢迎来到这一方小小的调配台。<br>不用急，慢慢说，你想要的那一杯，我都会认真替你调出来。",
    "你来了呀 ✿<br>把今天的期待交给我就好——一句话，一杯专属于你的味道，马上为你呈现。"];
  say(welcomes[Math.floor(Math.random()*welcomes.length)]);
}
/* ---------- 个人版记录 ---------- */
function bindPersonalHistory(p){
  var cards=p.querySelectorAll(".reccard");
  for(var i=0;i<cards.length;i++){(function(card){
    card.onclick=function(){
      var list=PERSONAL.hist();
      var id=card.getAttribute("data-phid");
      var r=null;for(var j=0;j<list.length;j++)if(list[j].id===id){r=list[j];break;}
      if(!r)return;
      /* 恢复配方参数进config */
      ctx.isAI=true;ctx.aiName=r.name;ctx.aiImg=r.image||"";ctx.aiType=r.temp||"cold";
      if(r.settings){
        resetCst(r.settings.temp||"cold");
        cst.milk=r.settings.milk!=null?r.settings.milk:2;
        cst.sugar=r.settings.sugar!=null?r.settings.sugar:2;
        cst.temp=r.settings.temp||"cold";
        cst.extra.orange=r.settings.orange!=null?r.settings.orange:2;
      }else{resetCst(r.temp);}
      /* 历史回放也要现场生成 desc，不复用旧存档 */
      ctx.aiDesc=buildProductIntro({milk:cst.milk,sugar:cst.sugar,acid:cst.extra.orange,
        teaLv:teaStrengthFrom(r.query||""),hot:cst.temp==="hot"},r.query||"");
      go("config");
    };
  })(cards[i]);}
}
/* ---------- 个人版完成页 ---------- */
function bindPersonalDone(p){
  var again=p.querySelector("#doneAgain");
  var bk=p.querySelector("#doneBack");
  if(again)again.onclick=function(){
    /* 回到个人版聊天，清栈到 personalAi */
    while(stack.length>1){var x=stack.pop();if(x.el.parentNode)x.el.parentNode.removeChild(x.el);
      if(x.name==="personalAi")break;}
    var top=stack[stack.length-1];
    if(top.name!=="personalAi"){go("personalAi");}
    else{top.el.classList.add("show");chrome("personalAi");}
  };
  if(bk)bk.onclick=function(){
    /* 返回个人版首页 */
    while(stack.length>1){var x=stack.pop();if(x.el.parentNode)x.el.parentNode.removeChild(x.el);}
    var top=stack[stack.length-1];top.el.classList.add("show");chrome("personalAi");
  };
}

var _bootName=BUILD_MODE==="personal"?"personalHome":BUILD_MODE==="commercial"?"home":"landing";
stack.push({name:_bootName,el:mount(_bootName)});
requestAnimationFrame(function(){stack[0].el.classList.add("show");});
chrome(_bootName);
