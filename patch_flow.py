# -*- coding: utf-8 -*-
import io

P_PER = "/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/公开展示_个人版v2/index.html"
P_COM = "/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/公开展示_商用版/index.html"

# ============ 1) 全新 3D 真实高脚杯：替换 gobletSVG 函数体 ============
NEW_GOBLET = r'''function gobletSVG(f){
  var id="gl"+(__flavSeq++);
  var top=40,bottom=116,H=bottom-top;
  var bowl="M34,42 C34,86 50,118 90,118 C130,118 146,86 146,42 C132,48 48,48 34,42 Z";
  var bands="",cursor=bottom;
  if(!f.seg.length){
    bands='<rect x="26" y="'+top+'" width="128" height="'+H+'" fill="url(#'+id+'empty)"/>';
  }else{
    f.seg.forEach(function(s,i){
      var col=FLA[s.k].g||FLA[s.k].fill;
      var h=i===f.seg.length-1?cursor-top:s.pct/100*H;
      var yy=cursor-h;
      bands+='<rect x="26" y="'+yy.toFixed(2)+'" width="128" height="'+(h+0.6).toFixed(2)+'" fill="'+col+'"/>';
      if(i>0)bands+='<line x1="26" y1="'+yy.toFixed(2)+'" x2="154" y2="'+yy.toFixed(2)+'" stroke="rgba(0,0,0,.16)" stroke-width="1"/>';
      if(i===f.seg.length-1){
        bands+='<ellipse cx="90" cy="'+yy.toFixed(2)+'" rx="56" ry="6.5" fill="'+col+'"/><ellipse cx="90" cy="'+(yy-1.2).toFixed(2)+'" rx="46" ry="3.6" fill="#ffffff" opacity=".28"/>';
      }
      cursor=yy;
    });
  }
  return ''+
  '<svg viewBox="0 0 180 196" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="风味占比高脚杯">'+
    '<defs>'+
      '<linearGradient id="'+id+'empty" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#dfe6ea" stop-opacity=".35"/></linearGradient>'+
      '<linearGradient id="'+id+'glass" x1="0" y1="0" x2="1" y2="0">'+
        '<stop offset="0" stop-color="#9fb2bd" stop-opacity=".55"/><stop offset=".14" stop-color="#ffffff" stop-opacity=".12"/>'+
        '<stop offset=".5" stop-color="#ffffff" stop-opacity=".04"/><stop offset=".86" stop-color="#ffffff" stop-opacity=".14"/>'+
        '<stop offset="1" stop-color="#8fa3af" stop-opacity=".5"/></linearGradient>'+
      '<radialGradient id="'+id+'base" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".7"/><stop offset=".7" stop-color="#cdd9df" stop-opacity=".3"/><stop offset="1" stop-color="#9fb2bd" stop-opacity=".45"/></radialGradient>'+
      '<clipPath id="'+id+'clip"><path d="'+bowl+'"/></clipPath>'+
    '</defs>'+
    '<ellipse cx="90" cy="189" rx="46" ry="6" fill="#000000" opacity=".10"/>'+
    '<g clip-path="url(#'+id+'clip)">'+bands+'</g>'+
    '<g clip-path="url(#'+id+'clip)"><rect x="26" y="34" width="128" height="90" fill="url(#'+id+'glass)"/>'+
      '<path d="M48,46 C42,72 48,98 62,112" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity=".55"/>'+
      '<path d="M136,50 C140,74 134,98 122,112" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" opacity=".3"/>'+
    '</g>'+
    '<path d="'+bowl+'" fill="none" stroke="rgba(86,104,116,.7)" stroke-width="2.2" stroke-linejoin="round"/>'+
    '<ellipse cx="90" cy="42" rx="56" ry="7.6" fill="none" stroke="rgba(86,104,116,.6)" stroke-width="2.2"/>'+
    '<ellipse cx="90" cy="42" rx="56" ry="7.6" fill="#ffffff" opacity=".10"/>'+
    '<path d="M90,118 L90,168" stroke="url(#'+id+'glass)" stroke-width="6.5" stroke-linecap="round"/>'+
    '<path d="M87.6,122 L87.6,166" stroke="#ffffff" stroke-width="1.5" opacity=".6"/>'+
    '<ellipse cx="90" cy="120" rx="7" ry="3.2" fill="rgba(150,168,178,.35)"/>'+
    '<ellipse cx="90" cy="176" rx="34" ry="6.4" fill="url(#'+id+'base)" stroke="rgba(86,104,116,.55)" stroke-width="1.6"/>'+
    '<ellipse cx="90" cy="174.4" rx="24" ry="2.6" fill="#ffffff" opacity=".45"/>'+
  '</svg>';
}'''

def replace_func(s, name, new_body):
    i = s.index("function "+name+"(")
    j = s.index("{", i)
    depth = 0; k = j
    while k < len(s):
        ch = s[k]
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                k += 1; break
        k += 1
    return s[:i] + new_body + s[k:]

# ============ 2) 个人版专属改动 ============
def patch_personal(s):
    # 2a 替换高脚杯
    s = replace_func(s, "gobletSVG", NEW_GOBLET)

    # 2b aiPrevHTML 加「记住我的偏好」横排按钮（个人版才有）
    old_btns = ("'<div class=\"abtns\"><button class=\"breject\" id=\"aiReject\">拒 绝</button>'+\n"
                "    '<button class=\"bstart\" id=\"aiStart\">开 始</button></div></div></div>';")
    new_btns = ("'<div class=\"abtns abtns-3\"><button class=\"breject\" id=\"aiReject\">拒 绝</button>'+\n"
                "    '<button class=\"bpref\" id=\"aiSavePref\">记住我的偏好</button>'+\n"
                "    '<button class=\"bstart\" id=\"aiStart\">开 始</button></div></div></div>';")
    assert old_btns in s, "personal abtns block not found"
    s = s.replace(old_btns, new_btns, 1)

    # 2c 个人 present：点开始跳过配置页直接出成品；新增记住偏好按钮
    old_start = ("    if(st)st.onclick=function(){\n"
                 "      resetCst(psnap.temp);\n"
                 "      cst.milk=psnap.milk;cst.sugar=psnap.sugar;cst.extra.orange=psnap.orange;cst.temp=psnap.temp;\n"
                 "      ctx.isAI=true;ctx.aiName=psnap.name;ctx.aiDesc=psnap.desc;ctx.aiLead=psnap.lead;\n"
                 "      ctx.aiWhy=psnap.why;ctx.aiBenefit=psnap.benefit;ctx.aiLayers=psnap.layers;\n"
                 "      ctx.aiImg=psnap.img;ctx.aiType=psnap.temp;\n"
                 "      go(\"config\");\n"
                 "    };")
    new_start = ("    if(st)st.onclick=function(){\n"
                 "      resetCst(psnap.temp);\n"
                 "      cst.milk=psnap.milk;cst.sugar=psnap.sugar;cst.extra.orange=psnap.orange;cst.temp=psnap.temp;\n"
                 "      ctx.isAI=true;ctx.aiName=psnap.name;ctx.aiDesc=psnap.desc;ctx.aiLead=psnap.lead;\n"
                 "      ctx.aiWhy=psnap.why;ctx.aiBenefit=psnap.benefit;ctx.aiLayers=psnap.layers;\n"
                 "      ctx.aiImg=psnap.img;ctx.aiType=psnap.temp;\n"
                 "      personalFinish(null);\n"
                 "    };\n"
                 "    var pv=box.querySelector(\"#aiSavePref\");\n"
                 "    if(pv)pv.onclick=function(){\n"
                 "      PERSONAL.savePref({milk:psnap.milk,sugar:psnap.sugar,orange:psnap.orange,temp:psnap.temp});\n"
                 "      this.classList.add(\"saved\");this.textContent=\"✓ 已记住，以后照这个来\";\n"
                 "      flavorToast(\"已记住你的口味，下次默认这么调～\");\n"
                 "    };")
    assert old_start in s, "personal start handler not found"
    s = s.replace(old_start, new_start, 1)

    # 2d send() 两处：resetCst 后先套已记住的偏好，再被本次对话 mods/hardbans 覆盖
    anchor1 = ("var c=classify(t);var temp=d.temp||c.temp;resetCst(temp);if(temp)cst.temp=temp;\n"
               "        applyMods(d.mods);applyHardBans(t);if(d.price)ctx.aiPrice=d.price;")
    repl1 = ("var c=classify(t);var temp=d.temp||c.temp;resetCst(temp);if(temp)cst.temp=temp;applySavedPref();\n"
             "        applyMods(d.mods);applyHardBans(t);if(d.price)ctx.aiPrice=d.price;")
    assert anchor1 in s, "send site1 not found"
    s = s.replace(anchor1, repl1, 1)

    anchor2 = ("if(isOrder){var c2=classify(t);resetCst(c2.temp);if(c2.temp)cst.temp=c2.temp;applyMods(mods);applyHardBans(t);")
    repl2 = ("if(isOrder){var c2=classify(t);resetCst(c2.temp);if(c2.temp)cst.temp=c2.temp;applySavedPref();applyMods(mods);applyHardBans(t);")
    assert anchor2 in s, "send site2 not found"
    s = s.replace(anchor2, repl2, 1)

    # 2e 注入 applySavedPref + flavorToast（放到 resetCst 定义前）
    helper = (
"/* 下单前先套用已记住的偏好作为默认基底；本次对话里明确说的加减/不要，随后由 applyMods/applyHardBans 覆盖 */\n"
"function applySavedPref(){\n"
"  try{\n"
"    var rec=PERSONAL.calcRec();if(!rec)return;\n"
"    if(typeof rec.milk===\"number\")cst.milk=rec.milk;\n"
"    if(typeof rec.sugar===\"number\")cst.sugar=rec.sugar;\n"
"    if(typeof rec.orange===\"number\")cst.extra.orange=rec.orange;\n"
"    if(rec.temp)cst.temp=rec.temp;\n"
"  }catch(e){}\n"
"}\n"
"function flavorToast(msg){\n"
"  var t=document.createElement(\"div\");t.className=\"flavortoast\";t.textContent=msg;\n"
"  document.body.appendChild(t);\n"
"  setTimeout(function(){t.classList.add(\"show\");},10);\n"
"  setTimeout(function(){t.classList.remove(\"show\");setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},300);},1900);\n"
"}\n")
    anchor_rc = "function resetCst(temp){"
    assert anchor_rc in s
    s = s.replace(anchor_rc, helper + anchor_rc, 1)

    # 2f CSS：三按钮均分 + 记住偏好样式 + toast
    css = (
"  .aiprev .abtns-3{display:flex;gap:8px}\n"
"  .aiprev .abtns-3 button{flex:1;font-size:12.5px;letter-spacing:.5px;padding:0 6px}\n"
"  .aiprev .abtns .bpref{background:#fff;color:#6f8a5b;border:1px solid #c9d6bb;border-radius:99px;font-weight:600;cursor:pointer}\n"
"  .aiprev .abtns .bpref.saved{background:#eef5e6;color:#4f7a39;border-color:#bcd4a6}\n"
"  .flavortoast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%) translateY(16px);background:rgba(38,52,39,.94);color:#fff;font-size:13px;letter-spacing:.5px;padding:11px 20px;border-radius:99px;opacity:0;transition:all .3s;z-index:9999;box-shadow:0 8px 26px -8px rgba(0,0,0,.4);pointer-events:none;white-space:nowrap}\n"
"  .flavortoast.show{opacity:1;transform:translateX(-50%) translateY(0)}\n"
    )
    css_anchor = "  .aiprev .abtns{display:flex;gap:10px;margin-top:14px}"
    assert css_anchor in s
    s = s.replace(css_anchor, css + css_anchor, 1)
    return s

# ============ 3) 商用版专属改动 ============
def patch_commercial(s):
    s = replace_func(s, "gobletSVG", NEW_GOBLET)
    # 商用 bindPrevButtons：点开始跳过配置页，直接去付款（先按本杯快照定价）
    old = ("      if(snap.price)ctx.aiPrice=snap.price;\n"
           "      }\n"
           "      go(\"config\");\n"
           "    };")
    new = ("      if(snap.price)ctx.aiPrice=snap.price;\n"
           "      }\n"
           "      var _pr=calcPrice();ctx.lastPrice=_pr.total;\n"
           "      go(\"pay\");\n"
           "    };")
    assert old in s, "commercial start handler not found"
    s = s.replace(old, new, 1)
    return s

sp = io.open(P_PER, encoding="utf-8").read()
sp = patch_personal(sp)
io.open(P_PER, "w", encoding="utf-8").write(sp)
print("personal patched")

sc = io.open(P_COM, encoding="utf-8").read()
sc = patch_commercial(sc)
io.open(P_COM, "w", encoding="utf-8").write(sc)
print("commercial patched")
print("DONE")
