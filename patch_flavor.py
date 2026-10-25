# -*- coding: utf-8 -*-
import re, sys

# ---------- 公共高脚杯 SVG / 图例渲染（颜色与口味由 FLA 决定） ----------
COMMON_TAIL = r'''
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
  var id="flclip"+(__flavSeq++),H=78,top=34,bottom=112,bands="",cursor=bottom;
  if(!f.seg.length){bands='<rect x="18" y="'+top+'" width="144" height="'+H+'" fill="#ECE7DC"/>';}
  else{f.seg.forEach(function(s,i){var h=i===f.seg.length-1?cursor-top:s.pct/100*H;var yy=cursor-h;bands+='<rect x="18" y="'+yy.toFixed(1)+'" width="144" height="'+(h+0.8).toFixed(1)+'" fill="'+FLA[s.k].fill+'"/>';cursor=yy;});}
  var bowl="M30,36 H150 L132,104 Q128,114 118,114 H62 Q52,114 48,104 Z";
  return '<svg viewBox="0 0 180 168" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="风味占比高脚杯">'+
    '<defs><clipPath id="'+id+'"><path d="'+bowl+'"/></clipPath></defs>'+
    '<g clip-path="url(#'+id+')">'+bands+
    '<path d="M42,44 C40,66 45,90 55,104" stroke="#ffffff" stroke-opacity=".5" stroke-width="6" fill="none" stroke-linecap="round"/></g>'+
    '<path d="'+bowl+'" fill="none" stroke="rgba(96,110,124,.6)" stroke-width="2.4" stroke-linejoin="round"/>'+
    '<ellipse cx="90" cy="36" rx="60" ry="7" fill="none" stroke="rgba(96,110,124,.55)" stroke-width="2.2"/>'+
    '<line x1="90" y1="114" x2="90" y2="150" stroke="rgba(96,110,124,.6)" stroke-width="5" stroke-linecap="round"/>'+
    '<line x1="60" y1="153" x2="120" y2="153" stroke="rgba(96,110,124,.6)" stroke-width="5" stroke-linecap="round"/></svg>';
}
function flavorVizHTML(){
  var f=ctx.aiFlavor||FLAVOR_EMPTY;
  var map={};f.seg.forEach(function(s){map[s.k]=s.pct;});
  var lg=f.keys.map(function(k){var on=(map[k]||0)>0;return '<div class="fl-item'+(on?'':' off')+'"><i class="fl-ring" style="border-color:'+FLA[k].ring+';background:'+(on?FLA[k].fill:'#ffffff')+'"></i><span class="fl-name">'+FLA[k].n+'</span><em>'+(map[k]||0)+'%</em></div>';}).join("");
  var flip=BUILD_MODE==="commercial"?" flip":"";
  return '<div class="flavorviz'+flip+'"><div class="fv-head">风 味 占 比</div><div class="fv-body"><div class="fv-glass">'+gobletSVG(f)+'</div><div class="fv-legend">'+lg+'</div></div></div>';
}
'''

PERSONAL_SNIPPET = r'''
/* ===== AI 风味占比高脚杯（个人版：酸/甜/苦/辣/咸） ===== */
var FLA={sour:{n:"酸",fill:"#F5C53A",ring:"#D99E00"},sweet:{n:"甜",fill:"#F7A3C2",ring:"#DF5F97"},bitter:{n:"苦",fill:"#5CB36A",ring:"#378A45"},spicy:{n:"辣",fill:"#E4514A",ring:"#C52E27"},salty:{n:"咸",fill:"#4B92E4",ring:"#2A6DC2"}};
var FLAVOR_EMPTY={seg:[],keys:["sour","sweet","bitter","spicy","salty"]};
function buildFlavor(rawText){
  var milk=cst.milk||0,sugar=cst.sugar||0,acid=(cst.extra&&cst.extra.orange)||0;
  var tea=!noTeaRequested(rawText)?teaStrengthFrom(rawText):0;
  /* 个人版五味：奶香的甘润并入甜 */
  var w={sour:acid*1.0,sweet:sugar*1.0+milk*0.55,bitter:tea*0.85,spicy:0,salty:0};
  var keys=["sour","sweet","bitter","spicy","salty"],stack=["bitter","sour","sweet","spicy","salty"];
  return flavorPct(w,keys,stack);
}
''' + COMMON_TAIL

COMMERCIAL_SNIPPET = r'''
/* ===== AI 风味占比高脚杯（商用版：酸/甜/苦/奶香，图例在左） ===== */
var FLA={sour:{n:"酸",fill:"#F5C53A",ring:"#D99E00"},sweet:{n:"甜",fill:"#F7A3C2",ring:"#DF5F97"},bitter:{n:"苦",fill:"#5CB36A",ring:"#378A45"},milk:{n:"奶香",fill:"#F2EBDA",ring:"#C6B99C"}};
var FLAVOR_EMPTY={seg:[],keys:["sour","sweet","bitter","milk"]};
function buildFlavor(rawText){
  var milk=cst.milk||0,sugar=cst.sugar||0,acid=(cst.extra&&cst.extra.orange)||0;
  var tea=!noTeaRequested(rawText)?teaStrengthFrom(rawText):0;
  var w={sour:acid*1.0,sweet:sugar*1.0,bitter:tea*0.85,milk:milk*0.95};
  var keys=["sour","sweet","bitter","milk"],stack=["bitter","milk","sour","sweet"];
  return flavorPct(w,keys,stack);
}
''' + COMMON_TAIL

CSS = r'''
  .flavorviz{margin:0;background:linear-gradient(180deg,#f7f5ee,#f0ebdf);padding:15px 16px 13px}
  .flavorviz .fv-head{font-size:10.5px;letter-spacing:4px;color:#9a8a63;text-align:center;margin-bottom:4px}
  .flavorviz .fv-body{display:flex;align-items:center;justify-content:center;gap:16px;padding:2px 0}
  .flavorviz.flip .fv-body{flex-direction:row-reverse;gap:18px}
  .flavorviz .fv-glass{flex:0 0 104px;width:104px}
  .flavorviz .fv-glass svg{width:100%;height:auto;display:block}
  .flavorviz .fv-legend{display:flex;flex-direction:column;gap:9px}
  .flavorviz .fl-item{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#4a463c;white-space:nowrap}
  .flavorviz .fl-item .fl-ring{width:13px;height:13px;border-radius:50%;border:2px solid #ccc;box-sizing:border-box;flex:0 0 13px}
  .flavorviz .fl-item .fl-name{letter-spacing:1px}
  .flavorviz .fl-item em{font-style:normal;color:#8a7f63;font-size:11px;min-width:32px}
  .flavorviz .fl-item.off{opacity:.4}
'''

PV_RE = re.compile(r"'<div class=\"pv-img\">.*?</div>'\+\s*\n\s*(?='<div class=\"ab\">)", re.S)
INNER_RE = re.compile(r"\n([ \t]*)box\.innerHTML=\(apodyDummy")  # placeholder, replaced below
INNER_RE = re.compile(r"(\n)([ \t]*)box\.innerHTML=\(apology\?")

def patch(path, snippet):
    s = open(path, encoding="utf-8").read()
    assert "function flavorVizHTML" not in s, "already patched: "+path
    # 1) CSS before .aiprev
    anchor_css = "  .aiprev{margin-top:13px;"
    assert anchor_css in s, "css anchor missing"
    s = s.replace(anchor_css, CSS + anchor_css, 1)
    # 2) flavor functions before aiPrevHTML
    anchor_fn = "function aiPrevHTML(){"
    assert anchor_fn in s, "aiPrevHTML anchor missing"
    s = s.replace(anchor_fn, snippet + "\n" + anchor_fn, 1)
    # 3) replace pv-img block with goblet
    s2, n = PV_RE.subn(lambda m: "flavorVizHTML()+\n    '<div class=\"ab\">", s)
    assert n == 1, "pv-img block matches=%d" % n
    s = s2
    # 4) compute flavor before each aiPrevHTML innerHTML render
    s2, n = INNER_RE.subn(lambda m: m.group(1)+m.group(2)+"ctx.aiFlavor=buildFlavor(rawText);"+m.group(1)+m.group(2)+"box.innerHTML=(apology?", s)
    assert n >= 1, "no innerHTML present site"
    s = s2
    open(path,"w",encoding="utf-8").write(s)
    print("patched", path, "present-sites=", n)

patch("/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/公开展示_个人版v2/index.html", PERSONAL_SNIPPET)
patch("/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/公开展示_商用版/index.html", COMMERCIAL_SNIPPET)
print("DONE")
