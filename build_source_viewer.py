#!/usr/bin/env python3
# 生成"源码查看页" index.html：打开公开链接即看到该版本完整底层源代码，可复制/下载。
# 用法: python3 build_source_viewer.py <输出目录> <版本名> <运行界面链接> <文件1> [文件2 ...]
import sys, os, html, datetime

out_dir, title, run_link, *files = sys.argv[1:]
meta = []
for f in files:
    p = os.path.join(out_dir, "raw", f)
    data = open(p, "rb").read()
    txt = data.decode("utf-8", errors="replace")
    meta.append({"name": f, "lines": txt.count("\n") + 1, "bytes": len(data)})

files_json = ",\n      ".join('{name:"%s",lines:%d,bytes:%d}' % (m["name"], m["lines"], m["bytes"]) for m in meta)
updated = datetime.date.today().strftime("%Y-%m-%d")

tpl = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__ · 完整底层源代码</title>
<style>
:root{--bg:#0f1411;--panel:#161d18;--ink:#d7e2da;--mut:#8aa093;--line:#263129;--acc:#7fc79a;--acc2:#3d6b53;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;}
header{padding:22px 24px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#141b16,#0f1411);position:sticky;top:0;z-index:5;}
h1{font-size:19px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
h1 .tag{font-size:11px;font-weight:500;color:#0f1411;background:var(--acc);border-radius:5px;padding:2px 9px;letter-spacing:.05em;}
.sub{color:var(--mut);font-size:12.5px;margin-top:7px;line-height:1.7;}
.sub b{color:var(--ink);font-weight:600;}
.bar{display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap;}
.tabs{display:flex;gap:6px;flex-wrap:wrap;}
.tab{cursor:pointer;border:1px solid var(--line);background:var(--panel);color:var(--mut);border-radius:8px;padding:7px 13px;font-size:12.5px;font-family:ui-monospace,Menlo,Consolas,monospace;}
.tab.on{background:var(--acc2);border-color:var(--acc);color:#fff;}
.spacer{flex:1;}
.btn{cursor:pointer;border:1px solid var(--line);background:#1b241e;color:var(--ink);border-radius:8px;padding:7px 14px;font-size:12.5px;}
.btn:hover{border-color:var(--acc);color:var(--acc);}
a.run{color:var(--acc);text-decoration:none;border:1px solid var(--acc2);border-radius:8px;padding:7px 14px;font-size:12.5px;}
main{padding:18px 24px 60px;}
.meta{color:var(--mut);font-size:12px;margin:0 2px 10px;}
.wrap{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;}
pre{margin:0;padding:18px 20px;font-size:12.8px;line-height:1.65;white-space:pre;overflow:auto;max-height:none;tab-size:2;}
.status{color:var(--mut);font-size:13px;padding:30px;}
.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--acc);color:#0f1411;font-size:13px;font-weight:600;padding:9px 18px;border-radius:999px;opacity:0;transition:.25s;pointer-events:none;}
.toast.show{opacity:1;}
footer{color:var(--mut);font-size:12px;padding:0 24px 30px;}
@media (max-width:560px){pre{font-size:11.5px;}header{padding:18px;}}
</style>
</head>
<body>
<header>
  <h1>__TITLE__ <span class="tag">完整底层源代码</span></h1>
  <div class="sub">
    本页打开即是该版本程序的<b>全部底层源代码</b>（不是运行界面）。可直接全选复制，或点右上角下载原始文件。<br>
    最后同步：__UPDATED__ · 零 Key、零后端、纯静态单文件 · 程序更新后此链接内容会自动覆盖为最新版。
  </div>
  <div class="bar">
    <div class="tabs" id="tabs"></div>
    <span class="spacer"></span>
    <a class="run" href="__RUN__" target="_blank" rel="noopener">打开运行界面 ↗</a>
    <button class="btn" id="copyBtn">复制全部</button>
    <button class="btn" id="dlBtn">下载该文件</button>
  </div>
</header>
<main>
  <div class="meta" id="meta"></div>
  <div class="wrap"><pre id="code"><span class="status">正在加载源代码…</span></pre></div>
</main>
<footer>智能饮品配置机 · __TITLE__ · 源代码公开页</footer>
<div class="toast" id="toast"></div>
<script>
(function(){
  var FILES=[
      __FILES__
  ];
  var cur=FILES[0].name, text="";
  var tabs=document.getElementById("tabs"), code=document.getElementById("code"),
      meta=document.getElementById("meta"), toast=document.getElementById("toast");
  function showToast(m){toast.textContent=m;toast.classList.add("show");setTimeout(function(){toast.classList.remove("show");},1600);}
  function fmt(b){return b>=1024?(b/1024).toFixed(1)+" KB":b+" B";}
  function renderTabs(){
    tabs.innerHTML="";
    FILES.forEach(function(f){
      var t=document.createElement("div");t.className="tab"+(f.name===cur?" on":"");t.textContent=f.name;
      t.onclick=function(){cur=f.name;load();};tabs.appendChild(t);
    });
  }
  function load(){
    renderTabs();var f=FILES.filter(function(x){return x.name===cur;})[0];
    meta.textContent=f.name+" · "+f.lines+" 行 · "+fmt(f.bytes);
    code.innerHTML='<span class="status">正在加载 '+f.name+' …</span>';
    fetch("raw/"+encodeURIComponent(f.name),{cache:"no-store"}).then(function(r){
      if(!r.ok)throw new Error("HTTP "+r.status);return r.text();
    }).then(function(t){
      text=t;code.textContent=t;
    }).catch(function(e){code.innerHTML='<span class="status">加载失败：'+e.message+'，可直接访问 raw/'+f.name+'</span>';});
  }
  document.getElementById("copyBtn").onclick=function(){
    if(!text){showToast("代码还在加载");return;}
    function ok(){showToast("已复制全部代码");};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok,function(){fallback();});}
    else fallback();
    function fallback(){var ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();
      try{document.execCommand("copy");ok();}catch(e){showToast("复制失败，请手动全选");}document.body.removeChild(ta);}
  };
  document.getElementById("dlBtn").onclick=function(){
    var a=document.createElement("a");a.href="raw/"+encodeURIComponent(cur);a.download=cur;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  };
  load();
})();
</script>
</body>
</html>
"""
page = (tpl.replace("__TITLE__", title)
           .replace("__UPDATED__", updated)
           .replace("__RUN__", run_link)
           .replace("__FILES__", files_json))
open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8").write(page)
print("viewer written ->", os.path.join(out_dir, "index.html"), "files:", [m["name"] for m in meta])
