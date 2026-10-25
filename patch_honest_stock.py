# -*- coding: utf-8 -*-
"""库存诚实闸门补丁：个人版(INGDB) / 商用版(CDB) 同一套逻辑。
- 用户点名的原料类别，四格库里没有 → 原原本本回复做不到、列出现货，不出单。
- 纯口感诉求(奶香/丝滑/醇厚)需奶却无奶 → 同样如实说明，不拿别的假装。
- 成品(cst/风味杯/文案/配图)只用现货：没奶奶香=0、没茶茶味=0、无果类酸味=0。
所有替换均断言唯一命中，避免误伤。"""
import io,sys

def block(db):
    return r'''
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
  var items=__DB__.list(),tags={},names=[];
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
      line="你要的「"+_pMilkPhrase(t)+"」得用奶才行，可现在原料库里没有任何奶制品，我没办法给你做出"+_pMilkPhrase(t)+"，也不能凭空给你变出奶来。";
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
'''.replace("__DB__",db)

def patch(path,db,mode):
    s=io.open(path,encoding="utf-8").read()
    def rep(old,new,n=1):
        nonlocal s
        c=s.count(old)
        assert c==n,"[%s] 锚点命中 %d 次(期望%d): %r"%(path,c,n,old[:60])
        s=s.replace(old,new)
    # 1) 注入整段（buildFlavor 前）
    rep("function buildFlavor(rawText){", block(db)+"\nfunction buildFlavor(rawText){")
    # 2) buildFlavor 茶味必须有茶底现货
    rep("  var hasTea=!noTeaRequested(rawText),teaLv=teaStrengthFrom(rawText);",
        "  var hasTea=!noTeaRequested(rawText)&&!!_pStock().tags.tea,teaLv=teaStrengthFrom(rawText);")
    if mode=="personal":
        # 3) perLocalCopy 文案茶底
        rep("      teaLv:teaStrengthFrom(raw),hot:c2&&c2.temp===\"hot\",hasTea:!noTeaRequested(raw)});",
            "      teaLv:teaStrengthFrom(raw),hot:c2&&c2.temp===\"hot\",hasTea:!noTeaRequested(raw)&&!!_pStock().tags.tea});")
        # 4) bindPersonalChat 发送闸门（esc2 唯一）
        rep("    add(\"user\",esc2(t));input.value=\"\";\n    var box=thinkingBubble();\n    DRINKAI.order(t).then(function(raw){",
            "    add(\"user\",esc2(t));input.value=\"\";\n    var box=thinkingBubble();\n    var __gate=_pGate(t);\n    if(__gate){box.innerHTML=esc2(__gate).replace(/\\n/g,\"<br>\");list.scrollTop=list.scrollHeight;return;}\n    DRINKAI.order(t).then(function(raw){")
        # 5) personalPresentOrder 开头钳制 cst
        rep("  function personalPresentOrder(box,rawText,name,desc,c,apology,svc){\n    svc=svc||{};",
            "  function personalPresentOrder(box,rawText,name,desc,c,apology,svc){\n    svc=svc||{};\n    _pClampCst();")
        # 6) 配料开关钳制（wantMilk2 分支汇合后）
        rep("      ingredients={tea:!noTeaRequested(rawText),milk:wantMilk2,c:wantC2,orange:wantOrange2,ice:temp!==\"hot\"};\n    }\n    if(!svcImg){var seed=seedOf(rawText+name);var localImg=staticPick(ingredients,temp,seed);ctx.aiImg=localImg;}",
            "      ingredients={tea:!noTeaRequested(rawText),milk:wantMilk2,c:wantC2,orange:wantOrange2,ice:temp!==\"hot\"};\n    }\n    _pClampIng(ingredients);\n    if(!svcImg){var seed=seedOf(rawText+name);var localImg=staticPick(ingredients,temp,seed);ctx.aiImg=localImg;}")
    else:
        # 3) 活跃 bindChat localCopy(rawText,2292) + 个人残留 perLocalCopy(raw,2813) 两处统一
        rep("hasTea:!noTeaRequested(rawText)});",
            "hasTea:!noTeaRequested(rawText)&&!!_pStock().tags.tea});")
        rep("hasTea:!noTeaRequested(raw)});",
            "hasTea:!noTeaRequested(raw)&&!!_pStock().tags.tea});")
        # 4) bindChat 发送闸门（esc + 历史召回前）
        rep("    add(\"user\",esc(t));input.value=\"\";\n    var box=thinkingBubble();\n    /* 历史召回",
            "    add(\"user\",esc(t));input.value=\"\";\n    var box=thinkingBubble();\n    var __gate=_pGate(t);\n    if(__gate){box.innerHTML=esc(__gate).replace(/\\n/g,\"<br>\");list.scrollTop=list.scrollHeight;return;}\n    /* 历史召回")
        # 5) bindChat presentOrder 开头钳制 cst（复刻单 silent 不钳）
        rep("  function presentOrder(box,rawText,name,desc,c,apology,svc,silent){\n    svc=svc||{};",
            "  function presentOrder(box,rawText,name,desc,c,apology,svc,silent){\n    svc=svc||{};\n    if(!silent)_pClampCst();")
        # 6) 配料开关钳制（bindChat wantMilk 分支，注意空格风格）
        rep("      ingredients={ tea:!noTeaRequested(rawText), milk:wantMilk, c:wantC, orange:!!wantOrange, ice:temp!==\"hot\" };\n    }\n    if(svcImg){",
            "      ingredients={ tea:!noTeaRequested(rawText), milk:wantMilk, c:wantC, orange:!!wantOrange, ice:temp!==\"hot\" };\n    }\n    _pClampIng(ingredients);\n    if(svcImg){")
    io.open(path,"w",encoding="utf-8").write(s)
    print("patched",mode,path,len(s))

if __name__=="__main__":
    base="/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/"
    which=sys.argv[1] if len(sys.argv)>1 else "all"
    if which in ("all","personal"):
        patch(base+"公开展示_个人版v2/index.html","INGDB","personal")
    if which in ("all","commercial"):
        patch(base+"公开展示_商用版/index.html","CDB","commercial")
