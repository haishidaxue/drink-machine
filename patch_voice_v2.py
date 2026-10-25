# -*- coding: utf-8 -*-
"""v27：语音交互重做 + AI回答自动朗读
- 麦克风：单击开始录音、再单击发送；录音中双击取消（不再长按输入框）
- 每次 AI 回答（普通回答/缺料拒绝/成品卡）自动用中文女声朗读；新提问会打断旧朗读
"""
import io
BASE="/Coze/Drive/扣子/所有对话/主对话/饮料机小程序/"

V2=r'''/* ===== 语音 v2：单击麦克风录入/再单击发送/双击取消；AI 回复自动朗读 ===== */
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
'''

def rep(s,old,new,n=1):
    c=s.count(old)
    assert c==n,"命中%d次(期望%d): %r"%(c,n,old[:60])
    return s.replace(old,new)

def replace_voice_block(s):
    start=s.index("/* ===== 语音输入 v1")
    end=s.index("function buildFlavor(rawText){",start)
    return s[:start]+V2+"\n"+s[end:]

ANCHOR='  p.querySelector("#chatsend").onclick=send;\n  input.addEventListener("keydown",function(e){if(e.key==="Enter")send();});\n  _bindVoice(p);'

def patch(path,n_chat):
    s=io.open(path,encoding="utf-8").read()
    s=replace_voice_block(s)
    new=ANCHOR+"\n  _watchChat(p);"
    s=rep(s,ANCHOR,new,n=n_chat)
    io.open(path,"w",encoding="utf-8").write(s)
    print("patched",path,"len",len(s))

if __name__=="__main__":
    import sys
    which=sys.argv[1] if len(sys.argv)>1 else "all"
    if which in ("all","personal"):patch(BASE+"公开展示_个人版v2/index.html",3)
    if which in ("all","commercial"):patch(BASE+"公开展示_商用版/index.html",2)
