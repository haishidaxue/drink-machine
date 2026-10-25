# -*- coding: utf-8 -*-
import io
FILES={
 "/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/公开展示_个人版v2/index.html":"personal",
 "/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/公开展示_商用版/index.html":"commercial",
}

PARSER = r'''/* ===== 对话口味意图解析：否定清零 / 多少调档 / 只要X铺满；辣咸默认绝不放 ===== */
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
'''

PERSONAL_BUILD = r'''function buildFlavor(rawText){
  var milk=cst.milk||0,sugar=cst.sugar||0,acid=(cst.extra&&cst.extra.orange)||0;
  var hasTea=!noTeaRequested(rawText),teaLv=teaStrengthFrom(rawText);
  /* 个人版五味，奶的甘润并入甜；辣/咸在 base 里恒为 0（绝不默认放）*/
  var base={sour:acid>0?acid*1.0:0,sweet:sugar*1.0+milk*0.5,bitter:hasTea?teaLv*0.85:0};
  var keys=["sour","sweet","bitter","spicy","salty"];
  var w=parseTasteIntent(rawText,base,keys);
  return flavorPct(w,keys,["bitter","sour","sweet","spicy","salty"]);
}'''

COMMERCIAL_BUILD = r'''function buildFlavor(rawText){
  var milk=cst.milk||0,sugar=cst.sugar||0,acid=(cst.extra&&cst.extra.orange)||0;
  var hasTea=!noTeaRequested(rawText),teaLv=teaStrengthFrom(rawText);
  var base={sour:acid>0?acid*1.0:0,sweet:sugar*1.0,bitter:hasTea?teaLv*0.85:0,milk:milk*0.95};
  var keys=["sour","sweet","bitter","milk"];
  var w=parseTasteIntent(rawText,base,keys);
  return flavorPct(w,keys,["bitter","milk","sour","sweet"]);
}'''

def replace_func(s,name,body):
    i=s.index("function "+name+"(");j=s.index("{",i);d=0;k=j
    while k<len(s):
        if(s[k]=="{"):d+=1
        elif s[k]=="}":
            d-=1
            if d==0:k+=1;break
        k+=1
    return s[:i]+body+s[k:]

for path,kind in FILES.items():
    s=io.open(path,encoding="utf-8").read()
    assert "parseTasteIntent" not in s, "already patched "+path
    build = PERSONAL_BUILD if kind=="personal" else COMMERCIAL_BUILD
    s=replace_func(s,"buildFlavor", PARSER+build)
    io.open(path,"w",encoding="utf-8").write(s)
    print("patched",kind)
print("DONE")
