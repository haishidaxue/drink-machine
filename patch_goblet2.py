# -*- coding: utf-8 -*-
import io
FILES=["公开展示_个人版v2/index.html","公开展示_商用版/index.html"]
NEW=r'''function gobletSVG(f){
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
}'''
def replace_func(s,name,body):
    i=s.index("function "+name+"(");j=s.index("{",i);d=0;k=j
    while k<len(s):
        if s[k]=="{":d+=1
        elif s[k]=="}":
            d-=1
            if d==0:k+=1;break
        k+=1
    return s[:i]+body+s[k:]
for f in FILES:
    s=io.open(f,encoding="utf-8").read()
    s=replace_func(s,"gobletSVG",NEW)
    io.open(f,"w",encoding="utf-8").write(s)
    print("updated",f)
