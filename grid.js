
(function(){
  "use strict";
  var STORE_KEY = "four_slot_storage_v1";
  var saveTimer = null;
  function flash(){var tip=document.getElementById("savedTip");tip.classList.add("on");clearTimeout(saveTimer);
    saveTimer=setTimeout(function(){tip.classList.remove("on");},1200);}
  function save(){var data={};document.querySelectorAll("#t .cell").forEach(function(td){data[td.getAttribute("data-key")]=td.textContent;});
    try{localStorage.setItem(STORE_KEY,JSON.stringify(data));}catch(e){}flash();}
  function load(){var raw=null;try{raw=localStorage.getItem(STORE_KEY);}catch(e){return;}if(!raw)return;
    try{var data=JSON.parse(raw);document.querySelectorAll("#t .cell").forEach(function(td){var k=td.getAttribute("data-key");
      if(typeof data[k]==="string")td.textContent=data[k];});}catch(e){}}
  document.addEventListener("DOMContentLoaded",function(){
    load();
    document.querySelectorAll("#t .cell").forEach(function(td){td.addEventListener("input",save);});
    document.getElementById("btnReset").addEventListener("click",function(){
      if(confirm("清空四个格子填写的内容？")){document.querySelectorAll("#t .cell").forEach(function(td){td.textContent="";});save();}
    });
  });
})();
