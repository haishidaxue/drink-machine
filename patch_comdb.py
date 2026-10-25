# -*- coding: utf-8 -*-
import io, os, re

P="公开展示_商用版/index.html"
s=io.open(P,encoding="utf-8").read()
orig=s

# ---------------------------------------------------------------
# 1) 注入商用四格原料库 + 配方引擎（放在 drinkById 定义之后）
# ---------------------------------------------------------------
ANCHOR='function dailyIndex(){var n=new Date(),s=new Date(n.getFullYear(),0,0);return Math.floor((n-s)/86400000)%4;}'
assert ANCHOR in s, "dailyIndex anchor not found"

ENGINE = r'''
/* ==================================================================
   CDB —— 商用四格原料库（与后台四格看板 / four_slot_storage_v1 同源）
   四槽 X1Y1/X1Y2/X2Y1/X2Y2；空库时默认装入四种标准原料。
   配方引擎按当前原料“怎么好喝怎么来”组出最多 4 款饮品，
   饮品选择页与每日推荐都从这 4 款里取。
   ================================================================== */
var CDB={
  key:"four_slot_storage_v1",
  slots:["X1Y1","X1Y2","X2Y1","X2Y2"],
  DEFAULT:{x1y1:"东方树叶",x1y2:"水溶C100",x2y1:"橙汁",x2y2:"牛奶"},
  low:function(sl){return String(sl).toLowerCase();},
  load:function(){
    var o={};
    try{o=JSON.parse(localStorage.getItem(this.key)||"{}")||{};}catch(e){o={};}
    var out={},any=false;
    this.slots.forEach(function(sl){var v=(o[sl.toLowerCase()]||"").trim();out[sl.toLowerCase()]=v;if(v)any=true;});
    if(!any){var def=this.DEFAULT;this.slots.forEach(function(sl){out[sl.toLowerCase()]=def[sl.toLowerCase()];});this.seeded=true;}
    return out;
  },
  list:function(){var o=this.load();return this.slots.map(function(sl){return {slot:sl,name:o[sl.toLowerCase()]};}).filter(function(x){return x.name;});},
  count:function(){return this.list().length;}
};
function _ingTag(name){
  var t=String(name||"");
  if(/水溶|维\s*c|c100|气泡|苏打|柠檬/.test(t))return "c";
  if(/奶|拿铁|牛乳/.test(t))return "milk";
  if(/橙|橘|柑/.test(t))return "orange";
  if(/茶|树叶|乌龙|茉莉|红茶|绿茶|普洱/.test(t))return "tea";
  if(/咖啡|美式|拿铁/.test(t))return "coffee";
  if(/莓|葡萄|桃|梨|苹果|芒果|百香|西瓜|瓜|荔枝|果/.test(t))return "fruit";
  if(/水|矿泉/.test(t))return "water";
  return "other";
}
function _ingOf(tag){var xs=CDB.list();for(var i=0;i<xs.length;i++)if(_ingTag(xs[i].name)===tag)return xs[i].name;return "";}
function _hasTag(tag){return !!_ingOf(tag);}
/* 组合 → 预览图：颜色严格对应（奶白/橙/果/茶），复用预置高清真图 */
function _comboImg(c){
  var m=/奶|拿铁|牛乳/.test(c),o=/橙|橘/.test(c),f=/水溶|维\s*c|c100|莓|葡萄|桃|果|柠檬|气泡/.test(c),t=/茶|树叶/.test(c);
  if(m&&t)return "images/milk1.png";
  if(m&&o)return "images/milk3.png";
  if(m)return "images/milk2.png";
  if(o&&t)return "images/orange3.png";
  if(o&&f)return "images/fruit3.png";
  if(o)return "images/orange1.png";
  if(f&&t)return "images/fruit1.png";
  if(f)return "images/fruit2.png";
  if(t)return "images/tea1.png";
  return "images/tea2.png";
}
/* 四种招牌组合（按标准四原料），命中即给出精致命名与文案、固定配图 */
var CDB_SIG=[
  {match:function(){return _hasTag("orange")&&_hasTag("tea");},
   en:"ORANGE TEA",base:16,
   pick:function(){return {parts:[_ingOf("tea"),_ingOf("orange")],img:"images/orange3.png"};},
   name:function(){return "橙香醒力饮";},
   reason:"明亮橙汁遇上清润茶香，酸甜提神、冰凉通透，犯困时给身体利落开机的一杯。"},
  {match:function(){return _hasTag("milk")&&_hasTag("tea");},
   en:"MILK TEA CLOUD",base:15,
   pick:function(){return {parts:[_ingOf("tea"),_ingOf("milk")],img:"images/milk1.png"};},
   name:function(){return "茶云舒润饮";},
   reason:"温润茶香裹着丝滑奶香，柔和不刺激，像给喉咙和心情盖上一层柔软的云。"},
  {match:function(){return _hasTag("orange")&&_hasTag("c");},
   en:"FRESH BREEZE",base:14,
   pick:function(){return {parts:[_ingOf("c"),_ingOf("orange")],img:"images/fruit1.png"};},
   name:function(){return "橙风疏沁饮";},
   reason:"水溶C的清冽托起明亮橙香与一丝果酸，满杯冰爽、一扫油腻，像迎面一阵干净的风。"},
  {match:function(){return _hasTag("milk")&&_hasTag("orange");},
   en:"CLOUD ORANGE",base:17,
   pick:function(){return {parts:[_ingOf("milk"),_ingOf("orange")],img:"images/milk3.png"};},
   name:function(){return "云橙柔萃饮";},
   reason:"丝滑奶香与明亮橙香交融，酸甜恰到好处，温柔又有小小的满足感。"}
];
var __curDrinks=null;
function buildDrinks(){
  var ings=CDB.list();
  var have={};ings.forEach(function(x){have[_ingTag(x.name)]=x.name;});
  var out=[],used={};
  function push(parts,name,en,reason,img,base){
    var key=parts.slice().sort().join("|");if(used[key])return false;used[key]=1;
    out.push({id:"c"+(out.length+1),name:name,en:en,reason:reason,img:img,base:base,parts:parts.slice()});
    return true;
  }
  /* 1) 命中的招牌组合优先 */
  CDB_SIG.forEach(function(sig){
    if(out.length>=4)return;
    if(sig.match()){var pi=sig.pick();push(pi.parts,sig.name(),sig.en,sig.reason,pi.img,sig.base);}
  });
  /* 2) 还有空位：用当前原料两两台 / 单料，自动补满到最多 4 款 */
  var tags=Object.keys(have);
  var pairName={tea:"茶",milk:"奶",orange:"橙",c:"C",fruit:"果",coffee:"咖",water:"水",other:"特"};
  function autoName(ps){
    var ts=ps.map(_ingTag),set={};ts.forEach(function(t){set[t]=1;});
    if(set.milk&&set.tea)return "醇奶鲜茶";
    if(set.milk&&set.orange)return "云朵橙奶";
    if(set.orange&&set.tea)return "鲜橙清茶";
    if(set.orange&&set.c)return "橙C冰萃";
    if(set.fruit&&set.tea)return "果味清茶";
    if(set.milk&&set.fruit)return "果香奶云";
    return ps[0].replace(/(饮料|汁|茶|奶|水)$/,"")+"轻饮";
  }
  /* 两两组合 */
  for(var i=0;i<ings.length&&out.length<4;i++){
    for(var j=i+1;j<ings.length&&out.length<4;j++){
      var a=ings[i].name,b=ings[j].name,combo=a+"·"+b;
      push([a,b],autoName([a,b]),"HOUSE BLEND",a+"与"+b+"按顺口比例调和，互相提味、怎么好喝怎么来。",_comboImg(combo),15);
    }
  }
  /* 仍不足：单料清饮 */
  for(var k=0;k<ings.length&&out.length<4;k++){
    var nm=ings[k].name;
    push([nm],nm.replace(/(饮料)$/,"")+"清饮","PURE",nm+"本味清饮，干净利落地呈现原料本身的风味。",_comboImg(nm),13);
  }
  __curDrinks=out;
  return out;
}
function drinkList(){if(!__curDrinks)buildDrinks();return __curDrinks;}
function currentDrink(id){
  var list=drinkList();
  for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];
  return list[dailyIndex()%list.length]||list[0];
}
function currentDrinkImg(id){return currentDrink(id).img;}
'''

s=s.replace(ANCHOR, ANCHOR+"\n"+ENGINE, 1)

# ---------------------------------------------------------------
# 2) imgOf / drinkById 在商用流程里改走当前库饮品（AI 仍走原 IMG）
# ---------------------------------------------------------------
s=s.replace(
 'function imgOf(d){return IMG[d.id];}',
 'function imgOf(d){return (d&&d.img)?d.img:(d&&IMG[d.id])?IMG[d.id]:"images/tea1.png";}',1)
s=s.replace(
 'function drinkById(id){for(var i=0;i<DRINKS.length;i++)if(DRINKS[i].id===id)return DRINKS[i];return DRINKS[0];}',
 'function drinkById(id){return currentDrink(id);}',1)

# ---------------------------------------------------------------
# 3) 每日推荐：从当前 4 款里按天轮换
# ---------------------------------------------------------------
s=s.replace(
 '  var d=DRINKS[dailyIndex()];ctx.drinkId=d.id;ctx.isAI=false;ctx.targetBudget=0;ctx.aiTier=0;\n  return stageHTML(d)+',
 '  var dl=drinkList();var d=dl[dailyIndex()%dl.length];ctx.drinkId=d.id;ctx.isAI=false;ctx.targetBudget=0;ctx.aiTier=0;ctx.lastPrice=d.base;\n  return stageHTML(d)+',1)
# 首页进入每日推荐时的同名设置（home 卡片跳转由 go 统一渲染，无需改）；T.daily 缓存键里 d.id 已动态，OK

# ---------------------------------------------------------------
# 4) 饮品选择：渲染当前库 4 款
# ---------------------------------------------------------------
old_sel = (
 'T.select=function(){\n'
 '  var sorted=DRINKS.slice().sort(function(a,b){return a.ord-b.ord;});\n'
 '  return \'<div class="ghead"><div class="pt">四 款 招 牌</div><div class="pe">点击任意一款进入调配</div></div>\'+\n'
 '    \'<div class="grid2">\'+sorted.map(function(d){\n'
 '      return \'<div class="gitem" data-drink="\'+d.id+\'"><div class="gimg"><img src="\'+imgOf(d)+\'"></div>\'+\n'
 '        \'<div class="gname">\'+d.name+\'</div><div class="gprice">¥\'+d.price+\'</div></div>\';\n'
 '    }).join(\'\')+\'</div>\';\n'
 '};')
new_sel = (
 'T.select=function(){\n'
 '  buildDrinks();var sorted=drinkList();\n'
 '  var ing=CDB.list().map(function(x){return x.name;}).join(" · ");\n'
 '  return \'<div class="ghead"><div class="pt">今 日 四 款</div><div class="pe">按当前原料现配：\'+ing+\'</div></div>\'+\n'
 '    \'<div class="grid2">\'+sorted.map(function(d){\n'
 '      return \'<div class="gitem" data-drink="\'+d.id+\'"><div class="gimg"><img src="\'+d.img+\'"></div>\'+\n'
 '        \'<div class="gname">\'+d.name+\'</div><div class="gprice">¥\'+d.base+\'</div></div>\';\n'
 '    }).join(\'\')+\'</div>\';\n'
 '};')
assert old_sel in s, "T.select block not found"
s=s.replace(old_sel,new_sel,1)

# ---------------------------------------------------------------
# 5) 选中饮品 → 配置/付款：用动态饮品的起价
# ---------------------------------------------------------------
s=s.replace(
 '      ctx.drinkId=el.getAttribute("data-drink");\n      ctx.isAI=false;ctx.aiTier=0;ctx.targetBudget=0;\n      resetCst();\n      ctx.lastPrice=drinkById(ctx.drinkId).price;\n      go("config");',
 '      ctx.drinkId=el.getAttribute("data-drink");\n      ctx.isAI=false;ctx.aiTier=0;ctx.targetBudget=0;\n      resetCst();\n      ctx.lastPrice=drinkById(ctx.drinkId).base;\n      go("config");',1)
# 每日推荐“选择这款”
s=s.replace(
 '    var d=drinkById(ctx.drinkId);\n    resetCst();\n    ctx.isAI=false;ctx.aiTier=0;ctx.targetBudget=0;\n    ctx.lastPrice=d.price;\n    go("config");',
 '    var d=drinkById(ctx.drinkId);\n    resetCst();\n    ctx.isAI=false;ctx.aiTier=0;ctx.targetBudget=0;\n    ctx.lastPrice=d.base;\n    go("config");',1)
# bindDaily 缓存键 d.id 已可用；其余 drinkById(...).price 出现在 pay/calcPrice/summary，统一兜底 .base
s=s.replace('drinkById(ctx.drinkId).price','(drinkById(ctx.drinkId).base||drinkById(ctx.drinkId).price)')

io.open(P,"w",encoding="utf-8").write(s)
print("patched index.html, delta chars:", len(s)-len(orig))

# ---------------------------------------------------------------
# 6) 同域四格库页面 board.html（与看板同源 four_slot_storage_v1）
# ---------------------------------------------------------------
grid=io.open("公开展示_个人版v2/grid.html",encoding="utf-8").read()
board=grid.replace("四格存储表","商用原料库·四格").replace(
 '<footer>四格存储表 · 与原表内容一致</footer>',
 '<footer>商用原料库 · 四格 X1Y1–X2Y2 · 与饮品机同步</footer>')
io.open("公开展示_商用版/board.html","w",encoding="utf-8").write(board)
print("board.html written", len(board))
