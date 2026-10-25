# -*- coding: utf-8 -*-
"""v26：
1) 两版全部聊天输入框：长按输入框语音输入（松开发送/上滑取消），左侧麦克风按钮兜底。
2) 商用版：进首页前强制登录/注册（账户名/密码/性别/年龄），localStorage 本地账号、自动登录、数据不丢。
3) 商用每日推荐：按 用户年龄/性别 + 节日/季节/时段 选品并生成甜话，不再纯随机。
"""
import io
BASE="/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/"

VOICE=r'''
/* ===== 语音输入 v1：长按输入框说话，松开发送，上滑取消；左麦克风按钮也可触发 ===== */
(function(){
  var css="#vMic{position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:18px;line-height:1;cursor:pointer;opacity:.72;z-index:3;padding:4px;-webkit-user-select:none;user-select:none;filter:grayscale(.05)}"+
  ".chatinput{position:relative!important}"+
  ".chatinput #chatinput{padding-left:36px!important;-webkit-touch-callout:none;touch-action:manipulation}"+
  "#vRec{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:99999;background:rgba(28,30,28,.92);color:#fff;padding:18px 22px;border-radius:16px;font-size:15px;text-align:center;max-width:80vw;box-shadow:0 12px 40px rgba(0,0,0,.35);backdrop-filter:blur(6px)}"+
  "#vRec .vd{font-size:30px;margin-bottom:8px;animation:vp 1s infinite ease-in-out}#vRec .vt{max-width:60vw;word-break:break-all;min-height:20px}#vRec .vc{margin-top:8px;font-size:12px;opacity:.75}@keyframes vp{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}"+
  "#vToast{position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:99999;background:rgba(28,30,28,.92);color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;max-width:82vw;text-align:center;opacity:0;transition:opacity .2s}#vToast.show{opacity:1}";
  var st=document.createElement("style");st.id="_vcss";st.textContent=css;(document.head||document.getElementsByTagName("head")[0]).appendChild(st);
})();
function _vtoast(msg){
  var t=document.getElementById("vToast");
  if(!t){t=document.createElement("div");t.id="vToast";document.body.appendChild(t);}
  t.textContent=msg;t.classList.add("show");
  clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove("show");},2200);
}
var _SR=window.SpeechRecognition||window.webkitSpeechRecognition||null;
function _vOverlay(initText){
  var d=document.createElement("div");d.id="vRec";
  d.innerHTML='<div class="vd">🎙️</div><div class="vt">'+(initText||"正在聆听…")+'</div><div class="vc">松开发送 · 上滑取消</div>';
  document.body.appendChild(d);return d;
}
/* 给页面内 #chatinput 绑定：长按说话；返回无（页面每次挂载调用一次） */
function _bindVoice(p){
  var input=p.querySelector("#chatinput"),sendBtn=p.querySelector("#chatsend");
  if(!input||input.__vbound)return;input.__vbound=1;
  var bar=input.parentNode;
  /* 左侧麦克风按钮（桌面/不便长按时兜底） */
  var mic=document.createElement("span");mic.id="vMic";mic.textContent="🎤";mic.title="按住说话";
  if(bar&&bar.className.indexOf("chatinput")>=0)bar.insertBefore(mic,input);else input.parentNode.appendChild(mic);
  var rec=null,ov=null,timer=null,fired=false,cancel=false,text="",startY=0;
  function supported(){ if(_SR)return true; _vtoast("当前浏览器不支持语音输入，请用 Chrome / Safari / 微信打开，或先用键盘输入～"); return false; }
  function begin(y){
    cancel=false;text="";startY=typeof y==="number"?y:0;
    try{input.setAttribute("readonly","readonly");}catch(e){}
    ov=_vOverlay("正在聆听…");
    rec=new _SR();rec.lang="zh-CN";rec.interimResults=true;rec.continuous=false;
    rec.onresult=function(e){
      var arr=[];for(var i=0;i<e.results.length;i++)arr.push(e.results[i][0].transcript);
      text=arr.join("").replace(/\s+/g,"");
      var vt=ov&&ov.querySelector(".vt");if(vt)vt.textContent=text||"正在聆听…";
    };
    rec.onerror=function(e){ finish(true); };
    rec.onend=function(){ /* 主动 stop 后统一在 finish 收口 */ };
    try{rec.start();}catch(e){ finish(true); }
  }
  function finish(forceCancel){
    if(timer){clearTimeout(timer);timer=null;}
    if(rec){try{rec.onresult=null;rec.onerror=null;rec.abort();}catch(e){}}
    try{input.removeAttribute("readonly");}catch(e){}
    if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);ov=null;
    var doCancel=forceCancel||cancel;
    var q=(text||"").trim();
    if(!doCancel&&q){input.value=q;if(sendBtn)sendBtn.click();}
    else if(doCancel&&q){_vtoast("已取消，未发送");}
    fired=false;cancel=false;text="";
  }
  /* —— 长按 420ms 触发 —— */
  function down(e){
    if(fired)return;
    var y=(e.touches&&e.touches[0])?e.touches[0].clientY:e.clientY;
    timer=setTimeout(function(){ fired=true; if(!supported()){fired=false;return;} begin(y); },420);
  }
  function move(e){
    if(!fired){if(timer)clearTimeout(timer);return;}
    var y=(e.touches&&e.touches[0])?e.touches[0].clientY:startY;
    cancel=(startY-y)>56;
    var vt=ov&&ov.querySelector(".vc");if(vt)vt.textContent=cancel?"松开手指取消":"松开发送 · 上滑取消";
  }
  function up(){
    if(!fired){if(timer)clearTimeout(timer);return;}   /* 普通点击：放行，正常弹键盘 */
    finish(false);
  }
  input.addEventListener("touchstart",down,{passive:true});
  input.addEventListener("touchmove",move,{passive:true});
  input.addEventListener("touchend",up);
  input.addEventListener("touchcancel",function(){if(fired)finish(true);});
  input.addEventListener("mousedown",down);
  window.addEventListener("mousemove",move);
  window.addEventListener("mouseup",up);
  input.addEventListener("contextmenu",function(e){if(fired)e.preventDefault();});
  /* 麦克风按钮：按下说话，松开发送（同逻辑） */
  mic.addEventListener("touchstart",function(e){e.preventDefault();if(!fired&&supported())begin(e.touches[0].clientY);},{passive:false});
  mic.addEventListener("touchmove",move,{passive:true});
  mic.addEventListener("touchend",function(){if(fired)finish(false);});
  mic.addEventListener("mousedown",function(e){e.preventDefault();if(!fired&&supported())begin(e.clientY);});
  window.addEventListener("mouseup",function(){/* 共用 up 处理 */});
}
'''

# 仅商用：登录/注册 + 个性化推荐
COMM=r'''
/* ===== 本地账号（零后端演示）：账户名/密码/性别/年龄，localStorage 持久化，自动登录，第二天数据不丢 ===== */
var AUTH={
  key:"drink_auth_v1",
  read:function(){try{return JSON.parse(localStorage.getItem(this.key)||'{}')||{};}catch(e){return {};}},
  write:function(o){try{localStorage.setItem(this.key,JSON.stringify(o));}catch(e){}},
  user:function(){var o=this.read();return o.current&&o.users&&o.users[o.current]?{name:o.current,gender:o.users[o.current].gender,age:o.users[o.current].age}:null;},
  ok:function(){return !!this.user();},
  register:function(name,pass,gender,age){name=(name||"").trim();var o=this.read();o.users=o.users||{};
    if(o.users[name])return {err:"这个账户名已经注册啦，直接登录或换一个名字吧～"};
    o.users[name]={pass:pass,gender:gender,age:age,created:Date.now()};o.current=name;this.write(o);return {ok:true};},
  login:function(name,pass){var o=this.read();var u=o.users&&o.users[name];
    if(!u)return {err:"还没有这个账户，先注册一下吧～"};
    if(u.pass!==pass)return {err:"密码不对，再想想看～"};
    o.current=name;this.write(o);return {ok:true};},
  logout:function(){var o=this.read();o.current=null;this.write(o);}
};
T.login=function(){
  return '<div class="authwrap" style="min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:30px 26px;box-sizing:border-box;background:linear-gradient(160deg,#f3f6ef 0%,#e8efe2 55%,#dfe8d8 100%)">'+
    '<div style="text-align:center;margin-bottom:22px"><div style="font-size:34px">🍵</div>'+
    '<div style="font-size:22px;font-weight:700;color:#34402f;letter-spacing:1px">AI 饮料机</div>'+
    '<div style="font-size:12px;color:#7c8875;margin-top:6px;letter-spacing:3px">一 杯 懂 你 的 好 茶</div></div>'+
    '<div style="background:#fff;border-radius:18px;padding:20px 18px;box-shadow:0 10px 34px rgba(80,100,70,.12)">'+
      '<div style="display:flex;gap:8px;margin-bottom:16px"><div id="tabLogin" style="flex:1;text-align:center;padding:9px;border-radius:10px;font-size:15px;font-weight:600">登录</div>'+
      '<div id="tabReg" style="flex:1;text-align:center;padding:9px;border-radius:10px;font-size:15px;font-weight:600">注册</div></div>'+
      '<input id="auName" maxlength="16" placeholder="账户名" style="width:100%;box-sizing:border-box;padding:12px 12px;margin-bottom:10px;border:1px solid #dfe6da;border-radius:10px;font-size:15px;outline:none">'+
      '<input id="auPass" type="password" maxlength="24" placeholder="密码" style="width:100%;box-sizing:border-box;padding:12px 12px;margin-bottom:10px;border:1px solid #dfe6da;border-radius:10px;font-size:15px;outline:none">'+
      '<div id="regExtra" style="display:none">'+
        '<div style="display:flex;gap:10px;margin-bottom:10px"><select id="auGender" style="flex:1;padding:12px;border:1px solid #dfe6da;border-radius:10px;font-size:15px;background:#fff;color:#333"><option value="女">女</option><option value="男">男</option></select>'+
        '<input id="auAge" type="number" min="3" max="120" placeholder="年龄" style="flex:1;padding:12px;border:1px solid #dfe6da;border-radius:10px;font-size:15px;outline:none"></div>'+
      '</div>'+
      '<div id="auErr" style="color:#d65a4a;font-size:13px;min-height:18px;margin-bottom:6px"></div>'+
      '<button id="auGo" style="width:100%;padding:13px;border:0;border-radius:12px;background:linear-gradient(135deg,#7c9a63,#5f7d49);color:#fff;font-size:16px;font-weight:700;letter-spacing:2px;box-shadow:0 8px 20px rgba(95,125,73,.3)">登 录</button>'+
      '<div style="text-align:center;font-size:12px;color:#9aa295;margin-top:12px">本机自动记住登录，下次打开不用再输；资料与记录都保存在这台手机里。</div>'+
    '</div></div>';
};
function _authEnter(){
  while(stack.length>0){var x=stack.pop();if(x.el.parentNode)x.el.parentNode.removeChild(x.el);}
  var el=mount("home");stack.push({name:"home",el:el});
  requestAnimationFrame(function(){el.classList.add("show");});chrome("home");
}
function bindLogin(p){
  var mode="login";
  var tabL=p.querySelector("#tabLogin"),tabR=p.querySelector("#tabReg"),extra=p.querySelector("#regExtra"),
      btn=p.querySelector("#auGo"),err=p.querySelector("#auErr"),
      nI=p.querySelector("#auName"),pI=p.querySelector("#auPass"),gI=p.querySelector("#auGender"),aI=p.querySelector("#auAge");
  function setMode(m){mode=m;
    var on={background:"#5f7d49",color:"#fff"},off={background:"#eef2ea",color:"#6a7563"};
    Object.assign(tabL.style,m==="login"?on:off);Object.assign(tabR.style,m==="reg"?on:off);
    extra.style.display=m==="reg"?"block":"none";
    btn.textContent=m==="reg"?"注 册 并 进 入":"登 录";err.textContent="";
  }
  tabL.onclick=function(){setMode("login");};tabR.onclick=function(){setMode("reg");};
  var hasAny=!!(AUTH.read().users&&Object.keys(AUTH.read().users).length);
  setMode(hasAny?"login":"reg");
  function go(){
    err.textContent="";
    var name=nI.value.trim(),pass=pI.value;
    if(!name){err.textContent="得先填个账户名哦～";return;}
    if(!pass){err.textContent="密码不能空着～";return;}
    if(mode==="reg"){
      var gender=gI.value,age=parseInt(aI.value,10);
      if(!(age>=3&&age<=120)){err.textContent="填一下真实年龄（3-120）～";return;}
      var r=AUTH.register(name,pass,gender,age);
      if(r.err){err.textContent=r.err;return;}
    }else{
      var l=AUTH.login(name,pass);
      if(l.err){err.textContent=l.err;return;}
    }
    _authEnter();
  }
  btn.onclick=go;
  pI.addEventListener("keydown",function(e){if(e.key==="Enter")go();});
}
/* ===== 每日推荐个性化：节日 + 季节 + 时段 + 年龄/性别 综合选品 ===== */
function _festival(){
  var n=new Date(),mm=n.getMonth()+1,dd=n.getDate();
  var fixed={"01-01":["元旦",5],"02-14":["情人节",3],"03-08":["女神节",2],"05-01":["劳动节",4],"06-01":["儿童节",3],"10-01":["国庆节",6],"12-24":["平安夜",3],"12-25":["圣诞节",5]};
  var lunar={};if(n.getFullYear()===2026){lunar={"02-17":["春节",7],"03-03":["元宵节",3],"06-19":["端午节",4],"09-25":["中秋节",5]};}
  var src=[];for(var k in fixed)src.push([k].concat(fixed[k]));for(var k2 in lunar)src.push([k2].concat(lunar[k2]));
  for(var i=0;i<src.length;i++){var parts=src[i][0].split("-"),a=+parts[0],b=+parts[1],win=src[i][2];
    var diff=Math.round(Math.abs(new Date(n.getFullYear(),mm-1,dd)-new Date(n.getFullYear(),a-1,b))/86400000);
    if(diff<=win)return {name:src[i][1],diff:diff};}
  return null;
}
function _season(){var m=new Date().getMonth()+1;if([12,1,2].indexOf(m)>=0)return "winter";if([3,4,5].indexOf(m)>=0)return "spring";if([6,7,8].indexOf(m)>=0)return "summer";return "autumn";}
function _daypart(){var h=new Date().getHours();if(h>=5&&h<11)return "morning";if(h>=11&&h<14)return "noon";if(h>=14&&h<18)return "afternoon";return "night";}
function _drinkTags(d){var s={};(d.parts||[]).forEach(function(n){s[_ingTag(n)]=1;});return s;}
function dailyPick(list){
  var u=AUTH.user(),fe=_festival(),se=_season(),dp=_daypart();
  var age=u?parseInt(u.age,10):30,g=u?u.gender:"";
  function score(d){
    var tg=_drinkTags(d),s=Math.random()*0.8;
    function has(){for(var i=0;i<arguments.length;i++)if(tg[arguments[i]])return true;return false;}
    /* 季节 */
    if(se==="summer"){if(has("c","orange"))s+=3;if(has("milk"))s-=1;}
    if(se==="winter"){if(has("milk"))s+=3.4;if(has("tea"))s+=2;if(has("c","orange"))s-=1;}
    if(se==="autumn"&&has("milk","tea"))s+=1.2;
    /* 时段 */
    if(dp==="morning"){if(has("tea","coffee"))s+=3;if(has("milk"))s+=1;}
    if(dp==="night"){if(has("milk"))s+=3.2;if(has("tea","coffee"))s-=3;}
    if(dp==="afternoon"&&has("c","orange","fruit"))s+=1.6;
    /* 节日 */
    if(fe){var fn=fe.name;
      if(/春节|中秋|元宵|端午/.test(fn)){if(has("milk","tea"))s+=3.2;}
      else if(/圣诞|情人|平安/.test(fn)){if(has("milk"))s+=2.6;if(has("orange","c"))s+=1;}
      else if(/儿童/.test(fn)){if(has("c","fruit","orange"))s+=4.4;if(has("tea","coffee"))s-=3;}
      else if(/女神/.test(fn)){if(has("fruit","milk","c"))s+=2.4;}
      else if(/国庆|劳动|元旦/.test(fn)){if(has("tea","c","orange"))s+=1.6;}
    }
    /* 性别（柔和倾向，仅作推荐微调） */
    if(g==="女"){if(has("fruit","c","milk"))s+=1.8;if(has("coffee"))s-=0.5;}
    else if(g==="男"){if(has("tea","milk"))s+=1;}
    /* 年龄 */
    if(age<18){if(has("c","fruit","orange"))s+=4;if(has("tea","coffee"))s-=4;}
    else if(age>=31&&age<=55){if(has("tea","milk"))s+=2;if(has("c"))s-=0.6;}
    if(age>55){if(has("tea","milk"))s+=3;if(has("coffee"))s-=2.4;if(has("c","orange"))s-=1.6;}
    return s;
  }
  var best=list[0],bs=-1e9;
  list.forEach(function(d){var sc=score(d);if(sc>bs){bs=sc;best=d;}});
  return best;
}
function dailyPitchText(d){
  var u=AUTH.user(),fe=_festival(),se=_season(),dp=_daypart();
  var age=u?parseInt(u.age,10):null,g=u?u.gender:"";
  var greet={morning:"早上好呀",noon:"中午好呀",afternoon:"下午好呀",night:"晚上好呀"}[dp];
  var who="";
  if(u){
    if(age!=null&&age<18)who="小可爱";
    else if(g==="女")who=(age>=40?"这位优雅的女士":"小姐姐");
    else if(g==="男")who=(age>=40?"这位先生":"小哥哥");
  }
  var lead=greet+(who?"，"+who:"")+"～";
  var mid="";
  if(fe){
    var ft={春节:"大过年的，喝口热乎甜润的最踏实",中秋:"月圆人团圆，柔柔一杯很应景",元宵:"团团圆圆的日子，配杯顺口的",端午:"佳节前后，清淡温润最舒服",圣诞:"圣诞的温柔氛围，正适合这一杯",平安夜:"平安夜，让奶香陪你慢下来",情人:"今天连空气都是甜的，给你一杯温柔的",儿童:"小朋友的快乐，就是要清爽果味、甜而不腻",女神:"愿你今天被宠着，喝杯轻盈好看的",国庆:"假期就该清清爽爽、开开心心",劳动:"辛苦啦，用一杯给你解解乏",元旦:"新年第一天，从一杯懂你的开始"}[fe.name]||("今天是"+fe.name+"，给你应个景");
    mid=ft+"。";
  }else{
    if(se==="summer"&&dp!=="night")mid="天热，给你挑了杯清爽提神的，一口下去整个人都亮了。";
    else if(se==="winter")mid="天凉，给你挑了杯温润暖手的，捧着喝刚刚好。";
    else if(dp==="night")mid="这个点不打扰你休息，给你挑了杯柔和不兴奋的，喝完松松地歇着。";
    else if(dp==="morning")mid="新的一天刚开始，给你挑了杯醒神的，帮你把状态打开。";
    else mid="照着你此刻的节奏，给你挑了这一杯，顺口才最重要。";
  }
  return lead+mid+d.reason;
}
'''

def rep(s,old,new,n=1):
    c=s.count(old)
    assert c==n,"命中%d次(期望%d): %r"%(c,n,old[:70])
    return s.replace(old,new)

def patch_personal(path):
    s=io.open(path,encoding="utf-8").read()
    # 语音助手（buildFlavor 前注入一次）
    s=rep(s,"function buildFlavor(rawText){",VOICE+"\nfunction buildFlavor(rawText){")
    # 三个聊天入口（个人AI / 数据库 / 旧通用）都绑定语音
    anchor='  p.querySelector("#chatsend").onclick=send;\n  input.addEventListener("keydown",function(e){if(e.key==="Enter")send();});'
    s=rep(s,anchor,anchor+"\n  _bindVoice(p);",n=3)
    io.open(path,"w",encoding="utf-8").write(s)
    print("personal patched",len(s))

def patch_commercial(path):
    s=io.open(path,encoding="utf-8").read()
    s=rep(s,"function buildFlavor(rawText){",VOICE+"\n"+COMM+"\nfunction buildFlavor(rawText){")
    anchor='  p.querySelector("#chatsend").onclick=send;\n  input.addEventListener("keydown",function(e){if(e.key==="Enter")send();});'
    s=rep(s,anchor,anchor+"\n  _bindVoice(p);",n=2)
    # 首页 META 增加 login
    s=rep(s,'  home:{t:"",bar:false,noBack:true},',
            '  login:{t:"",bar:false,noBack:true},\n  home:{t:"",bar:false,noBack:true},')
    # bind 分发
    s=rep(s,'  else if(name==="home")bindHome(p);',
            '  else if(name==="login")bindLogin(p);\n  else if(name==="home")bindHome(p);')
    # 启动：未登录先进 login
    s=rep(s,'var _bootName=BUILD_MODE==="personal"?"personalAi":BUILD_MODE==="commercial"?"home":"landing";',
            'var _bootName=BUILD_MODE==="personal"?"personalAi":BUILD_MODE==="commercial"?(AUTH.ok()?"home":"login"):"landing";')
    # 每日推荐选品个性化
    s=rep(s,"  var dl=drinkList();var d=dl[dailyIndex()%dl.length];ctx.drinkId=d.id;",
            "  var dl=drinkList();var d=dailyPick(dl);ctx.drinkId=d.id;")
    # 默认甜话改为个性化文案（模型增强仍可覆盖）
    s=rep(s,"<div class=\"prose\"><div class=\"lab\">今日推荐</div><p id=\"dailyPitch\">'+d.reason+'</p></div>",
            "<div class=\"prose\"><div class=\"lab\">今日推荐</div><p id=\"dailyPitch\">'+dailyPitchText(d)+'</p></div>")
    # 首页加账号胶囊（显示名 + 点击退出登录）
    homeAnchor='function bindHome(p){\n  p.querySelectorAll(".hopt[data-go], [data-go]").forEach(function(el){\n    el.onclick=function(){go(el.getAttribute("data-go"));};\n  });'
    homeNew=homeAnchor+'''
  (function(){
    var u=AUTH.user();if(!u)return;
    var chip=document.createElement("div");
    chip.textContent="👤 "+u.name+" · 点此退出";
    chip.style.cssText="position:fixed;right:12px;top:12px;z-index:50;font-size:12px;color:#5f6b57;background:rgba(255,255,255,.82);padding:6px 10px;border-radius:999px;box-shadow:0 4px 14px rgba(80,100,70,.15)";
    chip.onclick=function(){if(confirm("退出当前账号？数据仍保留在本机，下次登录还在。")){AUTH.logout();while(stack.length>0){var x=stack.pop();if(x.el.parentNode)x.el.parentNode.removeChild(x.el);}var el=mount("login");stack.push({name:"login",el:el});requestAnimationFrame(function(){el.classList.add("show");});chrome("login");}};
    p.appendChild(chip);
  })();'''
    s=rep(s,homeAnchor,homeNew)
    io.open(path,"w",encoding="utf-8").write(s)
    print("commercial patched",len(s))

if __name__=="__main__":
    import sys
    which=sys.argv[1] if len(sys.argv)>1 else "all"
    if which in ("all","personal"):patch_personal(BASE+"公开展示_个人版v2/index.html")
    if which in ("all","commercial"):patch_commercial(BASE+"公开展示_商用版/index.html")
